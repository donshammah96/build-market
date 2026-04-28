/**
 * Shared route handler factory for professional-portal API routes.
 * Encapsulates: withAuth, rate limit, validation, resilientExecutor, response mapping.
 * Reduces boilerplate in route files.
 */
import { NextRequest } from "next/server";
import type { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import type { UserRole } from "@build/db";
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

type ProfessionalPortalAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request";

function getRoutePattern(req: NextRequest): string {
  try {
    return req.nextUrl.pathname;
  } catch {
    return new URL(req.url).pathname;
  }
}

function createProfessionalPortalOutcomeLogger(params: {
  req: NextRequest;
  correlationId: string;
  operationName: string;
  actorRole: UserRole;
  requestStartedAt: number;
}) {
  const { req, correlationId, operationName, actorRole, requestStartedAt } =
    params;
  const routePattern = getRoutePattern(req);

  return (
    outcome: ProfessionalPortalAdapterOutcome,
    httpStatus: number,
    additional: Record<string, unknown> = {},
  ) => {
    logger.info("Professional portal adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      additionalContext: additional,
    });
  };
}

export interface GetRouteConfig<TQuery = Record<string, never>> {
  rateLimitKey: string;
  rateLimitType?: RateLimitType;
  querySchema?: z.ZodType<TQuery>;
  parseQuery?: (req: NextRequest) => Record<string, unknown>;
  handler: (ctx: {
    dbUserId: string;
    clerkId: string;
    userRole: UserRole;
    query: TQuery;
  }) => Promise<unknown>;
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

  return withAuth(async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const logOutcome = createProfessionalPortalOutcomeLogger({
      req,
      correlationId,
      operationName,
      actorRole: userRole,
      requestStartedAt,
    });

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `${rateLimitKey}:${identifier}`,
      limit,
      window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
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
          actorRole: userRole,
          operationName,
          issueCount: validation.error.issues.length,
        });
        logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
          validationIssueCount: validation.error.issues.length,
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

    logOutcome("started", HttpStatus.OK);

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => handler({ dbUserId, clerkId, userRole, query }),
      { operationName },
    );

    if (result.success && result.data !== undefined) {
      logOutcome("succeeded", HttpStatus.OK);
      return apiSuccess(result.data, HttpStatus.OK);
    }

    logger.error(errorMessage, result.error, {
      correlationId,
      actorRole: userRole,
      operationName,
      httpMethod: req.method,
      routePattern: getRoutePattern(req),
      outcome: "failed",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: Date.now() - requestStartedAt,
    });
    logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
    return apiError(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  });
}

export interface PostRouteConfig<TBody = unknown> {
  rateLimitKey: string;
  rateLimitType?: RateLimitType;
  bodySchema?: z.ZodType<TBody>;
  handler: (ctx: {
    dbUserId: string;
    clerkId: string;
    userRole: UserRole;
    body: TBody;
  }) => Promise<unknown>;
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

  return withAuth(async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const logOutcome = createProfessionalPortalOutcomeLogger({
      req,
      correlationId,
      operationName,
      actorRole: userRole,
      requestStartedAt,
    });

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `${rateLimitKey}:${identifier}`,
      limit,
      window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let body: TBody;
    try {
      const raw = await req.json();
      if (bodySchema) {
        const validation = bodySchema.safeParse(raw);
        if (!validation.success) {
          logger.warn("Body validation failed", {
            correlationId,
            actorRole: userRole,
            operationName,
            issueCount: validation.error.issues.length,
          });
          logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
            validationIssueCount: validation.error.issues.length,
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
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    logOutcome("started", HttpStatus.OK);

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => handler({ dbUserId, clerkId, userRole, body }),
      { operationName },
    );

    if (result.success && result.data !== undefined) {
      logOutcome("succeeded", successStatus);
      return apiSuccess(result.data, successStatus);
    }

    logger.error(errorMessage, result.error, {
      correlationId,
      actorRole: userRole,
      operationName,
      httpMethod: req.method,
      routePattern: getRoutePattern(req),
      outcome: "failed",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: Date.now() - requestStartedAt,
    });
    logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
    return apiError(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  });
}
