import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { HttpStatus } from "@/app/lib/api/api-response";
import { apiError } from "@/app/lib/api/resilient-api";
import {
  RateLimits,
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { safeParseJsonBody } from "@/app/lib/api/request-utils";

export async function checkProfileCompleteRateLimit(
  req: NextRequest,
  dbUserId: string,
): Promise<{ success: true } | { success: false; retryAfterSeconds: number }> {
  const rateLimitId = `${getRateLimitIdentifier(req)}-${dbUserId}-profile-complete`;
  const rateLimitResult = await checkRateLimit(
    rateLimitId,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (rateLimitResult.success) {
    return { success: true };
  }

  return {
    success: false,
    retryAfterSeconds: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
  };
}

export async function parseAndValidateProfileCompleteBody<
  TSchema extends z.ZodType<Record<string, unknown>>,
>(
  req: NextRequest,
  schema: TSchema,
  params: {
    logger: {
      warn: (message: string, context?: Record<string, unknown>) => void;
    };
    correlationId: string;
    target: "client" | "professional";
  },
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: NextResponse }
> {
  const parseResult = await safeParseJsonBody<Record<string, unknown>>(req);
  if (!parseResult.success) {
    return {
      success: false,
      response: apiError(
        parseResult.error || "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
      ),
    };
  }

  const validationResult = schema.safeParse(parseResult.data);
  if (!validationResult.success) {
    params.logger.warn("Profile complete validation failed", {
      correlationId: params.correlationId,
      target: params.target,
      operationName: "route_profile_complete",
      errors: validationResult.error.issues,
    });
    return {
      success: false,
      response: apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      ),
    };
  }

  return { success: true, data: validationResult.data };
}

type DomainOkResult<TData> = {
  ok: true;
  data: TData;
};

type DomainErrorResult = {
  ok: false;
  message?: string;
  status?: number;
};

type ResilientExecutionResult<TData> = {
  success: boolean;
  data?: DomainOkResult<TData> | DomainErrorResult;
  error?: unknown;
};

export async function executeProfileCompleteOperation<TData>(params: {
  executor: {
    execute: (
      operation: () => Promise<DomainOkResult<TData> | DomainErrorResult>,
      options: {
        timeout: "normal";
        retry: { maxAttempts: number };
        circuitBreaker: boolean;
        operationName: string;
      },
    ) => Promise<ResilientExecutionResult<TData>>;
  };
  operationName: string;
  operation: () => Promise<DomainOkResult<TData> | DomainErrorResult>;
  logger: {
    error: (
      message: string,
      error: Error,
      context?: Record<string, unknown>,
    ) => void;
  };
  correlationId: string;
  target: "client" | "professional";
  failureMessage: string;
}): Promise<
  { success: true; data: TData } | { success: false; response: NextResponse }
> {
  const result = await params.executor.execute(params.operation, {
    timeout: "normal",
    retry: { maxAttempts: 3 },
    circuitBreaker: true,
    operationName: params.operationName,
  });

  if (!result.success || !result.data) {
    const unknownError =
      result.error instanceof Error ? result.error : new Error("Unknown error");

    params.logger.error(params.failureMessage, unknownError, {
      correlationId: params.correlationId,
      target: params.target,
      operationName: params.operationName,
      outcome: "failed",
    });

    return {
      success: false,
      response: apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    };
  }

  if (!result.data.ok) {
    return {
      success: false,
      response: apiError(
        result.data.message || "Failed to update profile",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    };
  }

  return { success: true, data: result.data.data };
}
