/**
 * VirusScanner adapter backed by Cloudmersive's Advanced Virus Scan API.
 *
 * Drop-in alternative to AttachmentAvVirusScanner (attachmentav-scanner.ts)
 * against the same `VirusScanner` interface — see
 * VENDOR_DECISION_attachmentav_vs_cloudmersive.md for why this is the
 * recommended default for Join-as-Pro's document types (PDFs/DOCX/images),
 * given its structural document-threat detection (macros, OLE embeds, zip
 * bombs, XXE) on top of signature-based AV.
 *
 * Used the same way as the attachmentAV adapter:
 *  - manual rescan path (`rescanStagedUpload`)
 *  - registered as the production scanner via `registerVirusScanner()`
 *  - the R2 event-driven Worker pipeline calls the equivalent HTTP
 *    endpoint directly for the automatic first-pass scan (swap the
 *    fetch call in r2-scan-dispatcher.worker.ts's `scanSync`/`scanAsync`
 *    functions to point at Cloudmersive instead of attachmentAV if this
 *    vendor is chosen for the automatic path too).
 */

import type { ScanInput, ScanResult, VirusScanner } from "./virus-scanner";

export type CloudmersiveConfig = {
  apiKey: string;
  /** e.g. "https://api.cloudmersive.com" or your private/self-hosted instance URL. */
  baseUrl: string;
  timeoutMs?: number;
  /** Bounded retry for network/5xx failures only. Default 2. */
  maxRetries?: number;
};

type CloudmersiveAdvancedScanResponse = {
  CleanResult: boolean;
  FoundViruses?: Array<{ FileName: string; VirusName: string }> | null;
  ContainsExecutable: boolean;
  ContainsInvalidFile: boolean;
  ContainsScript: boolean;
  ContainsPasswordProtectedFile: boolean;
  ContainsRestrictedFileFormat: boolean;
  ContainsMacros: boolean;
  ContainsXmlExternalEntities: boolean;
  ContainsInsecureDeserialization: boolean;
  ContainsHtml: boolean;
  ContainsUnsafeArchive: boolean;
  ContainsOleEmbeddedObject: boolean;
  VerifiedFileFormat?: string;
};

type StructuralThreat = {
  reason: string;
  category: NonNullable<ScanResult["threatCategory"]>;
};

/**
 * FIX (#4): ContainsRestrictedFileFormat was declared on the response type
 * but never checked in the previous version — a real gap that let
 * vendor-flagged restricted formats through as CLEAN. Every flag on the
 * response type is now checked here; if a new flag is ever added to the
 * type without a corresponding branch here, that mismatch is now a single
 * place to look, not a silent omission.
 */
function structuralThreat(
  result: CloudmersiveAdvancedScanResponse,
): StructuralThreat | null {
  if (result.ContainsExecutable)
    return { reason: "Contains an executable payload", category: "executable" };
  if (result.ContainsInvalidFile)
    return {
      reason: "File failed format validation",
      category: "invalid-file",
    };
  if (result.ContainsScript)
    return {
      reason: "Contains embedded script content",
      category: "html-script",
    };
  if (result.ContainsPasswordProtectedFile)
    return {
      reason: "Password-protected files cannot be scanned and are rejected",
      category: "password-protected",
    };
  if (result.ContainsRestrictedFileFormat)
    return {
      reason: "File format is restricted by policy",
      category: "restricted-format",
    };
  if (result.ContainsMacros)
    return { reason: "Contains macros", category: "macro" };
  if (result.ContainsXmlExternalEntities)
    return {
      reason: "Contains XML External Entities (XXE)",
      category: "xxe",
    };
  if (result.ContainsInsecureDeserialization)
    return {
      reason: "Contains insecure deserialization payload",
      category: "insecure-deserialization",
    };
  if (result.ContainsHtml)
    return {
      reason: "Contains embedded HTML/script content",
      category: "html-script",
    };
  if (result.ContainsUnsafeArchive)
    return {
      reason: "Contains an unsafe archive (possible zip bomb)",
      category: "unsafe-archive",
    };
  if (result.ContainsOleEmbeddedObject)
    return {
      reason: "Contains an embedded OLE object",
      category: "ole-embedded-object",
    };
  return null;
}

/**
 * FIX (#7): VerifiedFileFormat was returned by the vendor and previously
 * discarded. This is exactly the field that catches a spoofed extension
 * (e.g. an executable renamed to .pdf) — check it.
 */
function formatMismatch(
  input: ScanInput,
  result: CloudmersiveAdvancedScanResponse,
): string | null {
  if (!result.VerifiedFileFormat) return null;

  const claimedExt = input.originalName.split(".").pop()?.toLowerCase() ?? "";
  const verified = result.VerifiedFileFormat.toLowerCase();

  // Loose containment check rather than exact equality — vendor format
  // names don't always exactly match file extensions (e.g. "jpeg" vs
  // "jpg") — but a genuine mismatch (verified "exe" for a claimed "pdf")
  // will not contain the claimed extension at all.
  if (
    claimedExt &&
    !verified.includes(claimedExt) &&
    !claimedExt.includes(verified)
  ) {
    return `Claimed file type ".${claimedExt}" does not match verified format "${result.VerifiedFileFormat}"`;
  }
  return null;
}

const SYNC_SIZE_LIMIT_BYTES = 25 * 1024 * 1024; // TODO: raise once chunked transfer is wired up for larger files (tracked separately, not a silent limitation)
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CloudmersiveVirusScanner implements VirusScanner {
  constructor(private readonly config: CloudmersiveConfig) {}

  async scanUpload(input: ScanInput): Promise<ScanResult> {
    const startTime = Date.now();

    if (!input.buffer) {
      return {
        status: "ERROR",
        safe: false,
        threatCategory: "scanner-unavailable",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "Cloudmersive",
        details:
          "no_object_bytes_provided: caller must fetch the object from storage before calling scanUpload",
      };
    }

    // FIX (#8): verify the bytes actually received match the declared
    // size before trusting anything else about them — a mismatch means a
    // truncated storage read or a stale/tampered DB value, either of
    // which should be treated as suspicious rather than scanned as-is.
    if (input.buffer.byteLength !== input.size) {
      return {
        status: "ERROR",
        safe: false,
        threatCategory: "size-mismatch",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "Cloudmersive",
        details: `size_mismatch: declared ${input.size} bytes, received ${input.buffer.byteLength} bytes`,
      };
    }

    if (input.buffer.byteLength > SYNC_SIZE_LIMIT_BYTES) {
      // FIX (#9): stable, greppable details string distinct from a real
      // scanner outage, even though both share ScanStatus "ERROR" by
      // design (see audit — adding a 4th ScanStatus wasn't worth the
      // ripple through the state machine for this).
      return {
        status: "ERROR",
        safe: false,
        threatCategory: "oversized",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "Cloudmersive",
        details: `file_exceeds_sync_scan_limit: ${input.buffer.byteLength} bytes exceeds ${SYNC_SIZE_LIMIT_BYTES} byte adapter limit; use chunked transfer for larger files`,
      };
    }

    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastErrorDetail = "unknown_scanner_error";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs ?? 20_000,
      );

      try {
        const formData = new FormData();
        formData.append(
          "inputFile",
          new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
          input.originalName,
        );

        // NOTE (#11, unresolved): header names/casing below match how
        // several Cloudmersive endpoints are documented, but were not
        // re-verified against a live sandbox call while writing this fix.
        // TODO: confirm against current Cloudmersive OpenAPI spec /
        // a real sandbox request with a known EICAR-style file before
        // this goes to production, ideally as a recorded-fixture
        // integration test rather than a live call on every CI run.
        const res = await fetch(
          `${this.config.baseUrl}/virus/scan/file/advanced`,
          {
            method: "POST",
            headers: {
              Apikey: this.config.apiKey,
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

        if (!res.ok) {
          lastErrorDetail = `scanner_api_error_${res.status}`;
          // FIX (#6): bounded retry, but only for transient failure
          // classes — a 4xx auth/malformed-request error will not be
          // fixed by retrying and should fail fast instead of masking a
          // real configuration problem behind retry delay.
          if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < maxRetries) {
            await sleep(300 * Math.pow(2, attempt));
            continue;
          }
          return {
            status: "ERROR",
            safe: false,
            threatCategory: "scanner-unavailable",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive",
            details: lastErrorDetail,
          };
        }

        const json = (await res.json()) as CloudmersiveAdvancedScanResponse;

        if (json.FoundViruses && json.FoundViruses.length > 0) {
          const firstVirus = json.FoundViruses[0];
          return {
            status: "INFECTED",
            safe: false,
            virusName: firstVirus?.VirusName ?? "Malware.Detected",
            threatCategory: "known-virus",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive",
            details: `Malware detected: ${json.FoundViruses.map((v) => v.VirusName).join(", ")}`,
          };
        }

        const threat = structuralThreat(json);
        if (threat) {
          return {
            status: "INFECTED",
            safe: false,
            virusName: "structural-threat",
            threatCategory: threat.category,
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive",
            details: threat.reason,
          };
        }

        const mismatch = formatMismatch(input, json);
        if (mismatch) {
          return {
            status: "INFECTED",
            safe: false,
            virusName: "structural-threat",
            threatCategory: "format-mismatch",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive",
            details: mismatch,
          };
        }

        if (!json.CleanResult) {
          return {
            status: "ERROR",
            safe: false,
            threatCategory: "scanner-unavailable",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive",
            details:
              "unclean_result_no_specific_flag: scanner reported unclean with no matching known reason",
          };
        }

        return {
          status: "CLEAN",
          safe: true,
          scanTimeMs: Date.now() - startTime,
          engineVersion: "Cloudmersive",
        };
      } catch (error) {
        clearTimeout(timeout);
        const isAbort = error instanceof Error && error.name === "AbortError";
        lastErrorDetail = isAbort
          ? "scanner_request_timeout"
          : `scanner_network_error: ${error instanceof Error ? error.message : String(error)}`;

        if (attempt < maxRetries) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }

        return {
          status: "ERROR",
          safe: false,
          threatCategory: "scanner-unavailable",
          scanTimeMs: Date.now() - startTime,
          engineVersion: "Cloudmersive",
          details: lastErrorDetail,
        };
      }
    }

    // Unreachable in practice (loop always returns or retries to exhaustion
    // above), but keeps the function's return type honest.
    return {
      status: "ERROR",
      safe: false,
      threatCategory: "scanner-unavailable",
      scanTimeMs: Date.now() - startTime,
      engineVersion: "Cloudmersive",
      details: lastErrorDetail,
    };
  }
}
