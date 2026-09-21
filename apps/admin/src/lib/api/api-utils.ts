/**
 * API Utilities
 *
 * Shared utilities for API routes including:
 * - Pagination parsing
 * - Status mapping
 * - Rate-limited middleware wrapper
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthContext } from "./api-middleware";
import { apiError, HttpStatus } from "./api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "./resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "./rate-limit";

const logger = getClientLogger();

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = options;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      parseInt(searchParams.get("limit") || String(defaultLimit), 10),
    ),
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build pagination response object
 */
export function buildPaginationResponse(
  page: number,
  limit: number,
  total: number,
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================================
// STATUS MAPPING UTILITIES
// ============================================================================

/**
 * Generic status mapper that converts lowercase query params to enum values
 */
export function createStatusMapper<T extends string>(
  statusMap: Record<string, T>,
): (value: string | null) => T | undefined {
  return (value: string | null) => {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    return statusMap[normalized];
  };
}

/**
 * Parse comma-separated status values into filter object
 */
export function parseStatusFilter<T extends string>(
  statusParam: string | null,
  statusMap: Record<string, T>,
): T | { in: T[] } | undefined {
  if (!statusParam) return undefined;

  const statusValues: T[] = statusParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .map((s) => statusMap[s])
    .filter((s): s is T => s !== undefined);

  if (statusValues.length === 0) return undefined;
  if (statusValues.length === 1) return statusValues[0];
  return { in: statusValues };
}

// ============================================================================
// RATE-LIMITED HANDLER CONTEXT
// ============================================================================

export interface RateLimitedContext extends AuthContext {
  correlationId: string;
}

export type RateLimitedHandler<TParams = unknown> = (
  req: NextRequest,
  context: RateLimitedContext,
  params?: TParams,
) => Promise<NextResponse | unknown>;

export interface RateLimitedOptions {
  /** Operation name for logging and resilience tracking */
  operationName: string;
  /** Rate limit type: 'read' or 'write' */
  rateLimit?: "read" | "write";
  /** Custom rate limit key prefix */
  rateLimitKeyPrefix?: string;
}

/**
 * Execute a handler with rate limiting, correlation ID, and resilience wrapper
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, { dbUserId }) => {
 *   return withRateLimitedExecution(req, dbUserId, {
 *     operationName: "get_items",
 *     rateLimit: "read",
 *   }, async (correlationId) => {
 *     // Your handler logic here
 *     const items = await prisma.item.findMany({ where: { userId: dbUserId } });
 *     return { data: items };
 *   });
 * });
 * ```
 */
export async function withRateLimitedExecution<T>(
  req: NextRequest,
  userId: string,
  options: RateLimitedOptions,
  handler: (correlationId: string) => Promise<T>,
): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);
  const { operationName, rateLimit = "read", rateLimitKeyPrefix } = options;

  // Check rate limit
  const identifier = rateLimitKeyPrefix
    ? `${rateLimitKeyPrefix}:${getRateLimitIdentifier(req)}`
    : getRateLimitIdentifier(req);

  const rateLimitConfig =
    rateLimit === "write" ? RateLimits.WRITE : RateLimits.READ;
  const { success } = await checkRateLimit(
    identifier,
    rateLimitConfig.limit,
    rateLimitConfig.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info(`Starting ${operationName}`, {
    correlationId,
  });

  return executeResilient(
    async () => {
      const result = await handler(correlationId);
      logger.info(`Completed ${operationName}`, {
        correlationId,
      });
      return result;
    },
    {
      operationName,
      successStatus: rateLimit === "write" ? HttpStatus.CREATED : HttpStatus.OK,
    },
  );
}

// ============================================================================
// COMMON STATUS MAPS
// ============================================================================

export const LEAD_STATUS_MAP = {
  new: "NEW" as const,
  contacted: "CONTACTED" as const,
  proposal: "PROPOSAL" as const,
  won: "WON" as const,
  lost: "LOST" as const,
};

export const ORDER_STATUS_MAP = {
  pending: "pending" as const,
  processing: "paid" as const, // "processing" maps to "paid" in OrderStatus enum
  paid: "paid" as const,
  shipped: "shipped" as const,
  delivered: "delivered" as const,
  cancelled: "cancelled" as const,
};

export const INQUIRY_STATUS_MAP = {
  new: "NEW" as const,
  contacted: "CONTACTED" as const,
  viewing_scheduled: "VIEWING_SCHEDULED" as const,
  offer_made: "OFFER_MADE" as const,
  closed: "CLOSED" as const,
};

export const PROJECT_STATUS_MAP = {
  planning: "planning" as const,
  in_progress: "in_progress" as const,
  completed: "completed" as const,
  archived: "archived" as const,
};
