/**
 * GET /api/uploads/staged/[id]/download
 *
 * FIX (C3): this route had regressed to the pre-fix vulnerable version —
 * only QUARANTINED was blocked (SCAN_PENDING/SCAN_FAILED downloadable),
 * and objects were read with visibility: "public" despite
 * stageOnboardingUpload now storing them as "private". Both restored
 * here. See AUDIT_4_full_subsystem.md, finding C3, for why this class of
 * regression is worth a standing test, not just a one-time fix.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { sanitizeFilename } from "@/app/lib/validation/file-validation";
import { uploadRepository } from "@/app/lib/domains/uploads";
import { getStorageProvider } from "@/app/lib/infrastructure/storage";
import { recordAuditLog } from "@/app/lib/audit/audit-logger";

const ROUTE_PATTERN = "/api/uploads/staged/[id]/download";

// FIX (C3): explicit allow-list, not a single QUARANTINED deny-check.
// Only statuses reachable after a completed, clean scan permit download.
const DOWNLOADABLE_STATUSES = new Set(["STAGED", "ATTACHED", "CONSUMED"]);

export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, clerkId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { id: uploadId } = params!;
    const operationName = "download_staged_document";

    const logOutcome = (
      outcome:
        "started" | "succeeded" | "failed" | "rate_limited" | "forbidden",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Staged document download adapter outcome", {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole: userRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - requestStartedAt,
        additionalContext: additional,
      });
    };

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `staged_download:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { uploadId });
      return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, { uploadId });

    const staged = await uploadRepository.findStagedUploadById(uploadId);
    if (!staged) {
      logOutcome("failed", HttpStatus.NOT_FOUND, { uploadId });
      return apiError("Document not found", HttpStatus.NOT_FOUND);
    }

    const isOwner = staged.clerkId === clerkId;
    const isAdmin =
      (userRole as string) === "ADMIN" ||
      (userRole as string) === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      logOutcome("forbidden", HttpStatus.FORBIDDEN, { uploadId, clerkId });
      return apiError("Unauthorized access to document", HttpStatus.FORBIDDEN);
    }

    // FIX (C3): fail closed on anything that isn't a known-clean status.
    if (!DOWNLOADABLE_STATUSES.has(staged.status)) {
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        uploadId,
        status: staged.status,
      });
      return apiError(
        staged.status === "QUARANTINED"
          ? "Document is quarantined due to malware scan failure"
          : `Document is not currently available for download (status: ${staged.status})`,
        HttpStatus.FORBIDDEN,
      );
    }

    const storage = getStorageProvider();
    try {
      // FIX (C3): private, matching how stageOnboardingUpload now stores
      // these objects. Reading as "public" for a private object either
      // fails or (depending on the storage provider's implementation)
      // silently ignores the visibility mismatch — neither is acceptable
      // for a route whose entire job is enforcing who can read this file.
      const fileBuffer = await storage.readObject(staged.storageKey, {
        visibility: "private",
      });

      await recordAuditLog({
        action: "DOCUMENT_DOWNLOADED",
        actorId: dbUserId,
        actorRole: userRole,
        resourceId: uploadId,
        resourceType: "StagedOnboardingUpload",
        correlationId,
        metadata: {
          originalName: staged.originalName,
          mimeType: staged.mimeType,
          size: staged.size,
          downloadedByAdmin: isAdmin && !isOwner,
        },
      });

      logOutcome("succeeded", HttpStatus.OK, { uploadId });

      const safeName = sanitizeFilename(staged.originalName).replace(
        /["\r\n]/g,
        "",
      );
      const encodedName = encodeURIComponent(safeName);

      const headers = new Headers({
        "Content-Type": staged.mimeType || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      });

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: HttpStatus.OK,
        headers,
      });
    } catch (error) {
      getClientLogger().error(
        "Failed to download document from storage",
        error instanceof Error ? error : new Error(String(error)),
      );
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        uploadId,
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError(
        "Failed to download document from storage",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
