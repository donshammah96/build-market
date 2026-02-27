/**
 * Shared route handler factory for professional-portal API routes.
 * Encapsulates: withAuth, rate limit, validation, resilientExecutor, response mapping.
 * Reduces boilerplate in route files.
 */
import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import { apiError, apiSuccess } from "@/app/lib/api/resilient-api";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";

const logger = getClientLogger();

type RateLimitType = "read" | "write";

const RATE_LIMIT_CONFIG = {
  read: { limit: RateLimits.READ.limit, window: RateLimits.READ.window },
  write: { limit: RateLimits.WRITE.limit, window: RateLimits.WRITE.window },
} as const;

export interface GetRouteConfig<TQuery = Record<string, never>> {
  rateLimitKey: string;
  rateLimitType?: RateLimitType;
  querySchema?: z.ZodType<TQuery>;
  parseQuery?: (req: NextRequest) => Record<string, unknown>;
  handler: (ctx: { dbUserId: string; query: TQuery }) => Promise<unknown>;
  operationName: string;
  errorMessage?: string;
}

/**
 * Create a GET route handler for professional-portal.
 * Handles: auth, rate limit, query validation, resilient execution, response.
 */
export function createProfessionalPortalGet<TQuery = Record<string, never>>(
  config: GetRouteConfig<TQuery>,
) {
  const {
    rateLimitKey,
    rateLimitType = "read",
    querySchema,
    parseQuery,
    handler,
    operationName,
    errorMessage = "Request failed",
  } = config;

  const { limit, window } = RATE_LIMIT_CONFIG[rateLimitType];

  return withAuth(async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `${rateLimitKey}:${identifier}`,
      limit,
      window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let query: TQuery;
    if (querySchema) {
      const rawQuery = parseQuery
        ? parseQuery(req)
        : Object.fromEntries(new URL(req.url).searchParams.entries());
      const validation = querySchema.safeParse(rawQuery);
      if (!validation.success) {
        logger.warn("Query validation failed", {
          correlationId,
          userId: dbUserId,
          errors: validation.error.issues,
        });
        return apiError(
          "Invalid query parameters",
          HttpStatus.BAD_REQUEST,
          validation.error.issues,
        );
      }
      query = validation.data;
    } else {
      query = {} as TQuery;
    }

    logger.info(`Executing ${operationName}`, {
      correlationId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => handler({ dbUserId, query }),
      { operationName },
    );

    if (result.success && result.data !== undefined) {
      return apiSuccess(result.data, HttpStatus.OK);
    }

    logger.error(errorMessage, result.error, {
      correlationId,
      userId: dbUserId,
    });
    return apiError(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  });
}

export interface PostRouteConfig<TBody = unknown> {
  rateLimitKey: string;
  rateLimitType?: RateLimitType;
  bodySchema?: z.ZodType<TBody>;
  handler: (ctx: { dbUserId: string; body: TBody }) => Promise<unknown>;
  operationName: string;
  errorMessage?: string;
  successStatus?: number;
}

/**
 * Create a POST route handler for professional-portal (no idempotency).
 * For routes that need idempotency, use the full pattern in the route file.
 */
export function createProfessionalPortalPost<TBody = unknown>(
  config: PostRouteConfig<TBody>,
) {
  const {
    rateLimitKey,
    rateLimitType = "write",
    bodySchema,
    handler,
    operationName,
    errorMessage = "Request failed",
    successStatus = HttpStatus.CREATED,
  } = config;

  const { limit, window } = RATE_LIMIT_CONFIG[rateLimitType];

  return withAuth(async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    let body: TBody;
    try {
      const raw = await req.json();
      if (bodySchema) {
        const validation = bodySchema.safeParse(raw);
        if (!validation.success) {
          logger.warn("Body validation failed", {
            correlationId,
            userId: dbUserId,
            errors: validation.error.issues,
          });
          return apiError(
            "Invalid input",
            HttpStatus.BAD_REQUEST,
            validation.error.issues,
          );
        }
        body = validation.data;
      } else {
        body = raw as TBody;
      }
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `${rateLimitKey}:${identifier}`,
      limit,
      window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info(`Executing ${operationName}`, {
      correlationId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => handler({ dbUserId, body }),
      { operationName },
    );

    if (result.success && result.data !== undefined) {
      return apiSuccess(result.data, successStatus);
    }

    logger.error(errorMessage, result.error, {
      correlationId,
      userId: dbUserId,
    });
    return apiError(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  });
}
