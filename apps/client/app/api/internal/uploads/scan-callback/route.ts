/**
 * POST /api/internal/uploads/scan-callback
 *
 * Single, consolidated callback endpoint for the R2 malware-scanning
 * pipeline. This REPLACES both prior routes:
 *   - the old /api/internal/uploads/scan-callback (HMAC design, but never
 *     actually called — payload shape didn't match the Worker)
 *   - the old /api/uploads/staged/scan-callback (shared-secret header,
 *     fail-open when INTERNAL_API_SECRET was unset — see audit finding C2)
 *
 * NOT behind Clerk auth: the caller is a Cloudflare Worker, not a browser
 * session. Auth is HMAC-over-raw-body, verified against a secret shared
 * only between this app and r2-scan-worker.ts. Fails CLOSED: an
 * unconfigured secret is a 500, never an open door.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { env } from "@/app/lib/infrastructure/env";
import { uploadRepository } from "@/app/lib/domains/uploads/repository";
import { InvalidStatusTransitionError } from "@/app/lib/domains/uploads/repository";
import { prisma } from "@build/db";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // reject anything older than 5 min

// Matches the flat payload r2-scan-worker.ts's signCallbackBody() sends.
// stagedKey is accepted for logging only — it plays no role in auth or
// idempotency, so a caller can't influence behavior by manipulating it.
const VerdictSchema = z.object({
  uploadId: z.string().min(1),
  stagedKey: z.string().min(1),
  status: z.enum(["CLEAN", "INFECTED", "ERROR"]),
  virusName: z.string().optional(),
  engineVersion: z.string(),
  scanRequestId: z.string().min(1),
  timestamp: z.number(),
});

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;

  // FIX (H5): read through the env module, not raw process.env, and rely
  // on env.ts validation to guarantee this is set outside test/dev
  // rather than discovering it's missing at request time.
  const secret = env.services.scanCallbackHmacSecret;
  if (!secret) {
    // Fail closed: an unconfigured secret must never be treated as "no
    // auth required." (This is the bug that made the old shared-secret
    // route exploitable — see audit finding C2. Don't repeat it here.)
    throw new Error("SCAN_CALLBACK_HMAC_SECRET is not configured");
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signatureHeader, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function statusForVerdict(status: "CLEAN" | "INFECTED" | "ERROR") {
  if (status === "INFECTED") return "QUARANTINED" as const;
  if (status === "ERROR") return "SCAN_FAILED" as const;
  // CLEAN -> STAGED. This relies on uploads being created at SCAN_PENDING
  // (see repository.fix.ts / audit finding C1) so that STAGED
  // unambiguously means "scanned and cleared," never "just created."
  return "STAGED" as const;
}

export async function POST(req: NextRequest) {
  const logger = getClientLogger();
  const rawBody = await req.text();
  const signature = req.headers.get("X-Scan-Signature");

  let signatureValid: boolean;
  try {
    signatureValid = verifySignature(rawBody, signature);
  } catch (error) {
    logger.error(
      "scan_callback_misconfigured",
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  if (!signatureValid) {
    logger.warn("scan_callback_auth_failure", {
      hasSignatureHeader: Boolean(signature),
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = VerdictSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn("scan_callback_invalid_payload", {
      issues: parsed.error.issues,
    });
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const verdict = parsed.data;

  if (Math.abs(Date.now() - verdict.timestamp) > MAX_CLOCK_SKEW_MS) {
    logger.warn("scan_callback_stale_timestamp", {
      uploadId: verdict.uploadId,
      timestamp: verdict.timestamp,
    });
    return NextResponse.json({ error: "stale request" }, { status: 400 });
  }

  // Idempotency: a scanRequestId we've already applied is a no-op success,
  // not an error — Queue/webhook redelivery (including our own worker's
  // retry-on-callback-failure behavior) is expected, not exceptional.
  const already = await prisma.uploadScanEvent.findUnique({
    where: { scanRequestId: verdict.scanRequestId },
  });
  if (already) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const nextStatus = statusForVerdict(verdict.status);

  try {
    await prisma.$transaction(async (tx) => {
      await uploadRepository.transitionStagedUploadStatus(
        verdict.uploadId,
        nextStatus,
        tx,
      );
      await tx.uploadScanEvent.create({
        data: {
          scanRequestId: verdict.scanRequestId,
          uploadId: verdict.uploadId,
          status: verdict.status,
          virusName: verdict.virusName,
          engineVersion: verdict.engineVersion,
        },
      });
    });
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      // Row isn't SCAN_PENDING anymore — already resolved by an earlier
      // delivery, or moved on for some other reason. Log as an anomaly
      // for investigation, but return 200 so the Worker doesn't
      // retry-storm on a transition that will never become valid.
      logger.warn("scan_callback_invalid_transition", {
        uploadId: verdict.uploadId,
        attemptedStatus: nextStatus,
        error: error.message,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    logger.error(
      "scan_callback_persist_failed",
      error instanceof Error ? error : new Error(String(error)),
      { uploadId: verdict.uploadId },
    );
    // 500 so the Worker retries a genuine persistence failure. The
    // worker only deletes the staged object AFTER a successful callback
    // (see r2-scan-worker.fix.ts), so a 500 here is safe to retry: the
    // object is still present at both the staged and verified/quarantine
    // keys, and re-running the promotion is an idempotent overwrite.
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
