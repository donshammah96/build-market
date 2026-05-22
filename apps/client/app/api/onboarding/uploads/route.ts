/**
 * POST /api/onboarding/uploads
 * app/api/onboarding/uploads/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. RESULT PATTERN replaces fragile discriminant union
 *    Original: inner executor returned UploadExecutionData | UploadExecutionError,
 *    discriminated by "errorCode" in result.data. If the executor's result.data
 *    shape ever changed (e.g. the domain added an errorCode field to a success
 *    response), the discriminant would silently match the wrong branch.
 *    Fixed: use the ok/err Result<T,E> pattern already established across the domain.
 *
 * No Clerk ordering issue here — this route has no IdempotencyService calls
 * and no Clerk metadata update. It is upload-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import {
  apiSuccess,
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { validateFile } from "@/app/lib/validation/file-validation";
import { uploadService } from "@/app/lib/domains/uploads";
import { ok, err, isOk, type Result } from "@/app/lib/errors/result";

const ROUTE_PATTERN = "/api/onboarding/uploads";
const OPERATION_NAME = "onboarding_upload";

// =============================================================================
// Security Configuration
// =============================================================================

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_REQUEST = 5;

const ONBOARDING_VALIDATION_CONFIG = {
  maxFileSize: MAX_FILE_SIZE,
  allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  allowedExtensions: Array.from(ALLOWED_EXTENSIONS),
  checkMagicNumbers: true,
} as const;

// =============================================================================
// Types
// =============================================================================

type UploadedFileResponse = {
  originalName: string;
  uploadId: string;
  previewUrl: string;
};

type UploadSuccessData = {
  uploaded: Record<string, UploadedFileResponse[]>;
};

type UploadErrorData = {
  code: "invalid_input" | "processing_failed";
  message: string;
};

function mapUploadErrorCodeToStatus(code: UploadErrorData["code"]): number {
  switch (code) {
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestStartedAt = Date.now();
  const correlationId = initializeCorrelationId(req);
  let actorRole: "anonymous" | "authenticated" = "anonymous";

  const logOutcome = (
    outcome:
      | "succeeded"
      | "failed"
      | "rate_limited"
      | "unauthorized"
      | "bad_request",
    httpStatus: number,
    // Additional fields are explicit named keys, never a spread bag.
    // ADR-005: log events must carry the minimum stable field set.
    extra?: { errorCode?: string; fileGroupCount?: number },
  ) => {
    getClientLogger().info("Onboarding uploads adapter outcome", {
      correlationId,
      operationName: OPERATION_NAME,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(extra?.errorCode !== undefined && { errorCode: extra.errorCode }),
      ...(extra?.fileGroupCount !== undefined && {
        fileGroupCount: extra.fileGroupCount,
      }),
    });
  };

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    logOutcome("unauthorized", HttpStatus.UNAUTHORIZED);
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }
  actorRole = "authenticated";

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding-uploads:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
    return apiError(
      "Too many upload requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async (): Promise<Result<UploadSuccessData, UploadErrorData>> => {
      const form = await req.formData();

      const files: Array<{ key: string; file: File; buffer: Buffer }> = [];
      for (const [key, value] of form.entries()) {
        if (
          typeof value === "object" &&
          "arrayBuffer" in value &&
          typeof (value as File).name === "string"
        ) {
          const file = value as File;
          const buffer = Buffer.from(await file.arrayBuffer());
          files.push({ key, file, buffer });
        }
      }

      if (files.length === 0) {
        return err({ code: "invalid_input", message: "No files provided" });
      }
      if (files.length > MAX_FILES_PER_REQUEST) {
        return err({
          code: "invalid_input",
          message: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} files per request.`,
        });
      }

      // Validate all files before storing any (fail-fast).
      const validationErrors: string[] = [];
      for (const { file, buffer } of files) {
        const validResult = validateFile(
          { name: file.name, size: file.size, type: file.type },
          buffer,
          ONBOARDING_VALIDATION_CONFIG,
        );
        if (!validResult.valid && validResult.error) {
          validationErrors.push(validResult.error);
        }
      }
      if (validationErrors.length > 0) {
        getClientLogger().warn("Upload validation failed", {
          correlationId,
          actorRole,
          errors: validationErrors,
        });
        return err({
          code: "invalid_input",
          message: validationErrors.join("; "),
        });
      }

      const uploaded: Record<string, UploadedFileResponse[]> = {};

      for (const { key, file, buffer } of files) {
        const stageResult = await uploadService.stageOnboardingUpload({
          actor: { clerkId, correlationId },
          file: {
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            buffer,
          },
        });

        if (!stageResult.ok) {
          return err({
            code:
              stageResult.error === "invalid_input"
                ? "invalid_input"
                : "processing_failed",
            message: stageResult.message || "File upload failed",
          });
        }

        if (!uploaded[key]) uploaded[key] = [];
        uploaded[key].push({
          originalName: stageResult.data.originalName,
          uploadId: stageResult.data.uploadId,
          previewUrl: stageResult.data.previewUrl,
        });
      }

      getClientLogger().info("Onboarding files uploaded successfully", {
        correlationId,
        actorRole,
        fileCount: files.length,
        fieldNames: Object.keys(uploaded),
      });

      return ok({ uploaded });
    },
    { operationName: "onboarding_upload" },
  );

  if (!result.success || !result.data) {
    getClientLogger().error("Onboarding upload executor failed", result.error, {
      correlationId,
      operationName: OPERATION_NAME,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome: "failed",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: Date.now() - requestStartedAt,
    });
    return apiError("File upload failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // result.data is typed as T in OperationResult<T>. The stale .d.ts may
  // collapse T to unknown when the package hasn't been rebuilt. We know the
  // concrete type from the typed operation signature above, so we assert it
  // explicitly at this boundary. After `pnpm --filter="@build/resilience" run
  // build` this assertion becomes redundant but remains harmless.
  const innerResult = result.data as Result<UploadSuccessData, UploadErrorData>;
  if (!isOk(innerResult)) {
    const mappedStatus = mapUploadErrorCodeToStatus(innerResult.code);
    const outcome =
      mappedStatus === HttpStatus.BAD_REQUEST ? "bad_request" : "failed";
    logOutcome(outcome, mappedStatus, { errorCode: innerResult.code });
    return apiError(innerResult.message ?? "Upload failed", mappedStatus);
  }

  logOutcome("succeeded", HttpStatus.OK, {
    fileGroupCount: Object.keys(innerResult.data.uploaded).length,
  });

  return apiSuccess(innerResult.data, HttpStatus.OK);
}
