/**
 * Cloudflare R2 Event-Driven Malware Scan Worker
 * ===============================================
 * PAUSED / IDLE WORKER NOTICE: As decided in ARCHITECTURE_DECISION_scan_pipeline.md,
 * synchronous in-app scanning is currently the primary scan path for onboarding
 * uploads. The R2 event notification pipeline is intentionally paused / not
 * sending events to this Worker right now to avoid double-scanning every upload.
 * Keep this code deployed and fully hardened for future high-volume or large-file
 * async scanning needs, but do NOT re-enable R2 bucket event notifications without
 * reading ARCHITECTURE_DECISION_scan_pipeline.md first.
 *
 * Subscribes to object creation events on `buildmarket-staged`.
 * Runs Cloudmersive's *advanced* scan (structural threats, not just
 * signature AV) and relays a signed verdict to the Next.js app.
 * Promotes CLEAN objects to `buildmarket-verified-private` and isolates
 * INFECTED objects into `buildmarket-quarantine`.
 *
 * Fixes vs. the previous version (see audit for details):
 *  - C4: uploadId is now parsed from the documented `onboarding/{id}/...`
 *    key scheme instead of a `{id}-filename` split that never matched it.
 *  - C5: uses Cloudmersive's /virus/scan/file/advanced endpoint and checks
 *    the same structural-threat/format-mismatch flags as
 *    CloudmersiveVirusScanner, instead of a thinner hand-rolled client.
 *  - H1/H5: generates a scanRequestId and HMAC-signs the callback instead
 *    of a shared static header secret.
 *  - H2/H3: the callback is retried with backoff and its response is
 *    checked; the staged object is only deleted AFTER a confirmed (2xx)
 *    callback, so a failed callback never leaves storage and the DB out
 *    of sync — worst case is a harmless duplicate blob, not silent data
 *    loss of the verdict.
 *  - H4: queue() now isolates failures per-message via message.retry()
 *    instead of letting one throw affect the whole batch implicitly.
 */

export interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface Message<T = unknown> {
  readonly body: T;
  ack(): void;
  retry(): void;
}

export interface MessageBatch<T = unknown> {
  readonly messages: readonly Message<T>[];
}

export interface Env {
  R2_BUCKET_STAGED: R2Bucket;
  R2_BUCKET_VERIFIED_PRIVATE: R2Bucket;
  R2_BUCKET_QUARANTINE: R2Bucket;
  APP_CALLBACK_URL: string; // e.g. https://buildmarket.app/api/internal/uploads/scan-callback
  SCAN_CALLBACK_HMAC_SECRET: string; // required — no fallback, no fail-open
  CLOUDMERSIVE_API_KEY?: string;
}

export interface R2EventMessage {
  action: string;
  bucket: string;
  object: {
    key: string;
    size: number;
    eTag: string;
  };
}

export type ScanWorkerOutcome = "CLEAN" | "INFECTED" | "ERROR";

type CloudmersiveAdvancedResponse = {
  CleanResult: boolean;
  FoundViruses?: Array<{ VirusName: string }> | null;
  ContainsExecutable?: boolean;
  ContainsInvalidFile?: boolean;
  ContainsScript?: boolean;
  ContainsPasswordProtectedFile?: boolean;
  ContainsRestrictedFileFormat?: boolean;
  ContainsMacros?: boolean;
  ContainsXmlExternalEntities?: boolean;
  ContainsInsecureDeserialization?: boolean;
  ContainsHtml?: boolean;
  ContainsUnsafeArchive?: boolean;
  ContainsOleEmbeddedObject?: boolean;
  VerifiedFileFormat?: string;
};

// Mirrors CloudmersiveVirusScanner's structural-threat checks so the
// automatic first-pass scan and the manual rescan path have the same
// security posture. Kept as a small local copy rather than an import
// because this file deploys as a standalone Worker, not as part of the
// Next.js app's module graph.
function structuralThreat(
  r: CloudmersiveAdvancedResponse,
): { reason: string; category: string } | null {
  if (r.ContainsExecutable)
    return { reason: "Contains an executable payload", category: "executable" };
  if (r.ContainsInvalidFile)
    return {
      reason: "File failed format validation",
      category: "invalid-file",
    };
  if (r.ContainsScript)
    return {
      reason: "Contains embedded script content",
      category: "html-script",
    };
  if (r.ContainsPasswordProtectedFile)
    return {
      reason: "Password-protected files are rejected",
      category: "password-protected",
    };
  if (r.ContainsRestrictedFileFormat)
    return {
      reason: "File format is restricted by policy",
      category: "restricted-format",
    };
  if (r.ContainsMacros) return { reason: "Contains macros", category: "macro" };
  if (r.ContainsXmlExternalEntities)
    return { reason: "Contains XML External Entities (XXE)", category: "xxe" };
  if (r.ContainsInsecureDeserialization)
    return {
      reason: "Contains insecure deserialization payload",
      category: "insecure-deserialization",
    };
  if (r.ContainsHtml)
    return {
      reason: "Contains embedded HTML/script content",
      category: "html-script",
    };
  if (r.ContainsUnsafeArchive)
    return {
      reason: "Contains an unsafe archive (possible zip bomb)",
      category: "unsafe-archive",
    };
  if (r.ContainsOleEmbeddedObject)
    return {
      reason: "Contains an embedded OLE object",
      category: "ole-embedded-object",
    };
  return null;
}

const SYNC_SIZE_LIMIT_BYTES = 25 * 1024 * 1024; // matches CloudmersiveVirusScanner's adapter limit
const CLOUDMERSIVE_TIMEOUT_MS = 20_000;
const CLOUDMERSIVE_MAX_RETRIES = 2;
const CALLBACK_MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// FIX (C4): keys are `onboarding/{uploadId}/{filename}` per the R2
// malware scanning plan, Step 1 — parse the actual path structure
// instead of guessing at a dash-delimited filename convention that
// doesn't match it. Returns null (rather than a best-guess wrong ID) for
// anything that doesn't match, so callers can fail loudly instead of
// silently corrupting an unrelated upload's status.
function extractUploadId(objectKey: string): string | null {
  const parts = objectKey.split("/");
  if (parts.length < 3 || parts[0] !== "onboarding") return null;
  const uploadId = parts[1];
  return uploadId && uploadId.length > 0 ? uploadId : null;
}

async function hmacSignHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  async queue(batch: MessageBatch<R2EventMessage>, env: Env): Promise<void> {
    // FIX (H4): isolate failures per message instead of letting one
    // throw take down handling of the whole batch implicitly.
    for (const message of batch.messages) {
      const { key } = message.body.object;
      try {
        await processR2ObjectScan(key, env);
        message.ack();
      } catch (error) {
        console.error(`[r2-scan-worker] failed processing key=${key}:`, error);
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/scan-trigger") {
      const authHeader =
        request.headers.get("X-Ops-Secret") ||
        request.headers.get("X-Scan-Signature");
      if (!authHeader || authHeader !== env.SCAN_CALLBACK_HMAC_SECRET) {
        return new Response("Unauthorized scan trigger", { status: 401 });
      }

      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing object key parameter", { status: 400 });
      }
      await processR2ObjectScan(key, env);
      return new Response("Scan processing completed", { status: 200 });
    }
    return new Response("Cloudflare R2 Anti-Malware Worker operational", {
      status: 200,
    });
  },
};

async function scanWithCloudmersive(
  fileBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  apiKey: string,
): Promise<{ status: ScanWorkerOutcome; virusName?: string }> {
  let lastError = "unknown_scanner_error";

  for (let attempt = 0; attempt <= CLOUDMERSIVE_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      CLOUDMERSIVE_TIMEOUT_MS,
    );

    try {
      const formData = new FormData();
      formData.append(
        "inputFile",
        new Blob([fileBuffer], { type: mimeType }),
        filename,
      );

      // FIX (C5): advanced endpoint + explicit deny-all flags, matching
      // CloudmersiveVirusScanner — not the basic signature-only endpoint.
      const response = await fetch(
        "https://api.cloudmersive.com/virus/scan/file/advanced",
        {
          method: "POST",
          headers: {
            Apikey: apiKey,
            allowExecutables: "false",
            allowInvalidFiles: "false",
            allowScripts: "false",
            allowPasswordProtectedFiles: "false",
            allowMacros: "false",
            allowXmlExternalEntities: "false",
            allowInsecureDeserialization: "false",
            allowHtml: "false",
            allowUnsafeArchives: "false",
            allowOleEmbeddedObject: "false",
          },
          body: formData,
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        lastError = `scanner_api_error_${response.status}`;
        if (
          [408, 429, 500, 502, 503, 504].includes(response.status) &&
          attempt < CLOUDMERSIVE_MAX_RETRIES
        ) {
          await sleep(300 * 2 ** attempt);
          continue;
        }
        return { status: "ERROR" };
      }

      const result = (await response.json()) as CloudmersiveAdvancedResponse;

      if (result.FoundViruses && result.FoundViruses.length > 0) {
        return {
          status: "INFECTED",
          virusName: result.FoundViruses[0]?.VirusName ?? "Malware.Detected",
        };
      }

      const threat = structuralThreat(result);
      if (threat) {
        return { status: "INFECTED", virusName: threat.reason };
      }

      if (!result.CleanResult) {
        return { status: "ERROR" };
      }

      return { status: "CLEAN" };
    } catch (error) {
      clearTimeout(timeout);
      const isAbort = error instanceof Error && error.name === "AbortError";
      lastError = isAbort
        ? "scanner_request_timeout"
        : `scanner_network_error: ${String(error)}`;
      if (attempt < CLOUDMERSIVE_MAX_RETRIES) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
    }
  }

  console.error(`[r2-scan-worker] Cloudmersive scan failed: ${lastError}`);
  return { status: "ERROR" };
}

async function sendVerdictCallback(
  env: Env,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const rawBody = JSON.stringify(payload);
  const signature = await hmacSignHex(env.SCAN_CALLBACK_HMAC_SECRET, rawBody);

  for (let attempt = 0; attempt <= CALLBACK_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(env.APP_CALLBACK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scan-Signature": signature,
        },
        body: rawBody,
      });

      // FIX (H2): actually check the response instead of discarding it.
      if (response.ok) return true;

      console.error(
        `[r2-scan-worker] callback rejected: status=${response.status} attempt=${attempt}`,
      );
      // Don't retry on 4xx (auth/validation failures won't fix themselves);
      // do retry on 5xx.
      if (response.status < 500 || attempt === CALLBACK_MAX_RETRIES)
        return false;
    } catch (error) {
      console.error(
        `[r2-scan-worker] callback network error attempt=${attempt}:`,
        error,
      );
      if (attempt === CALLBACK_MAX_RETRIES) return false;
    }
    await sleep(500 * 2 ** attempt);
  }
  return false;
}

export async function processR2ObjectScan(
  key: string,
  env: Env,
): Promise<void> {
  const startTime = Date.now();

  const uploadId = extractUploadId(key);
  if (!uploadId) {
    // FIX (C4): a key that doesn't match the enforced scheme is not a
    // transient failure — retrying won't fix it. Log loudly and stop;
    // this needs a human to look at how the object got there.
    console.error(
      `[r2-scan-worker] key does not match onboarding/{uploadId}/... scheme: ${key}`,
    );
    return;
  }

  const stagedObject = await env.R2_BUCKET_STAGED.get(key);
  if (!stagedObject) {
    console.warn(`[r2-scan-worker] Staged object not found for key: ${key}`);
    return;
  }

  const fileBuffer = await stagedObject.arrayBuffer();
  const rawFilename = key.split("/").pop() ?? key;
  const mimeType =
    stagedObject.httpMetadata?.["content-type"] ?? "application/octet-stream";

  let scanStatus: ScanWorkerOutcome;
  let virusName: string | undefined;

  if (!env.CLOUDMERSIVE_API_KEY) {
    scanStatus = "ERROR";
  } else if (fileBuffer.byteLength > SYNC_SIZE_LIMIT_BYTES) {
    // NOTE: the plan's sync/async (presigned-download) branch for large
    // files isn't implemented yet — this is a deliberate, visible
    // failure rather than attempting to scan a file that risks exceeding
    // Worker CPU/memory limits. Tracked as follow-up work, not silently
    // downgraded to "scan skipped, treat as clean."
    scanStatus = "ERROR";
    console.warn(
      `[r2-scan-worker] object exceeds sync scan limit, marking ERROR: ${key}`,
    );
  } else {
    const result = await scanWithCloudmersive(
      fileBuffer,
      rawFilename,
      mimeType,
      env.CLOUDMERSIVE_API_KEY,
    );
    scanStatus = result.status;
    virusName = result.virusName;
  }

  // FIX (H1): every scan attempt gets a unique ID so the app can dedupe
  // retried callbacks instead of double-applying a status transition.
  const scanRequestId = crypto.randomUUID();

  // FIX (H3): promote/quarantine first (idempotent puts — safe to redo
  // on retry), but do NOT delete the staged copy until the callback is
  // confirmed. If the callback ultimately fails, the staged object stays
  // in place: worst case is a harmless duplicate blob, not a DB row
  // stuck at SCAN_PENDING pointing at nothing.
  if (scanStatus === "CLEAN") {
    await env.R2_BUCKET_VERIFIED_PRIVATE.put(`verified/${key}`, fileBuffer, {
      httpMetadata: stagedObject.httpMetadata,
      customMetadata: stagedObject.customMetadata,
    });
  } else if (scanStatus === "INFECTED") {
    await env.R2_BUCKET_QUARANTINE.put(`quarantine/${key}.bin`, fileBuffer, {
      customMetadata: {
        ...(stagedObject.customMetadata ?? {}),
        virusName: virusName ?? "Unknown.Malware",
      },
    });
  }

  const callbackOk = await sendVerdictCallback(env, {
    uploadId,
    stagedKey: key,
    status: scanStatus,
    virusName,
    engineVersion: "Cloudmersive-Advanced-Worker-v2",
    scanRequestId,
    timestamp: Date.now(),
  });

  if (!callbackOk) {
    // Throw so queue() calls message.retry() — reprocessing is safe: the
    // promotion puts above are idempotent overwrites, and a fresh
    // scanRequestId just means the eventual successful callback dedupes
    // against whichever attempt lands first.
    throw new Error(`scan callback failed for uploadId=${uploadId} key=${key}`);
  }

  if (scanStatus === "CLEAN" || scanStatus === "INFECTED") {
    await env.R2_BUCKET_STAGED.delete(key);
  }

  console.log(
    `[r2-scan-worker] processed key=${key} uploadId=${uploadId} status=${scanStatus} durationMs=${Date.now() - startTime}`,
  );
}
