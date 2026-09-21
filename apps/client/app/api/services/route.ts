import { NextRequest } from "next/server";
import { z } from "zod";
import { withRole } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { professionalSettingsService } from "@/app/lib/domains/professional-settings";
import { ProfessionSchema } from "@/app/lib/validation/profile-validation";

// Allowed sort fields to prevent arbitrary column injection
const ALLOWED_SORT_FIELDS = [
  "createdAt",
  "name",
  "sortOrder",
  "updatedAt",
] as const;
type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

// Validation schemas — use z.nativeEnum() with Prisma enums per conventions
const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  imageUrl: z.string().url().max(500).optional(),
  professionType: ProfessionSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().max(150).optional(),
  metaDescription: z.string().max(300).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  sort: z.string().optional().default("createdAt:desc"),
  search: z.string().optional().default(""),
  professionType: ProfessionSchema.optional(),
});

/**
 * GET /api/services
 * Get all service categories with optional filtering and pagination
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);
  const logger = getClientLogger();

  const identifier = getRateLimitIdentifier(request);
  const { success } = await checkRateLimit(
    `services-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const { searchParams } = new URL(request.url);
  const queryParams = {
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "10",
    sort: searchParams.get("sort") || "createdAt:desc",
    search: searchParams.get("search") || "",
    professionType: searchParams.get("professionType") || undefined,
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    logger.warn("Service query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  const { page, limit, sort, search, professionType } = queryValidation.data;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);

  // Parse and validate sort parameter
  const [rawSortField = "createdAt", sortDirection] = sort.split(":");
  const sortField: SortField = ALLOWED_SORT_FIELDS.includes(
    rawSortField as SortField,
  )
    ? (rawSortField as SortField)
    : "createdAt";
  const sortDirectionValue = sortDirection === "asc" ? "asc" : "desc";

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      professionalSettingsService.listServiceCategoriesPage({
        page: pageNum,
        limit: limitNum,
        sortField,
        sortDirection: sortDirectionValue,
        search: search || undefined,
        professionType,
      }),
    { operationName: "get_services" },
  );

  if (!result.success) {
    return apiError(
      "Failed to fetch services",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  if (!result.data?.ok) {
    return apiError(
      "Failed to fetch services",
      result.data?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return apiSuccess(result.data.data);
}

/**
 * POST /api/services
 * Create a new service category
 * Admin only endpoint — protected by withRole middleware
 */
export const POST = withRole(["ADMIN"])(async (
  request: NextRequest,
  { dbUserId },
) => {
  const correlationId = initializeCorrelationId(request);
  const logger = getClientLogger();

  const { success } = await checkRateLimit(
    getRateLimitIdentifier(request),
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Body size guard
  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = await request.json();
  const validation = createServiceSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Service creation validation failed", {
      correlationId,
      actorRole: "ADMIN",
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const {
    name,
    description,
    icon,
    imageUrl,
    professionType,
    sortOrder,
    isFeatured,
    metaTitle,
    metaDescription,
    keywords,
  } = validation.data;

  // Idempotency check
  const idempotencyKey =
    request.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST:service", { name });
  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "service",
    dbUserId,
    "POST",
  );

  if (idempotencyCheck?.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }
  if (idempotencyCheck?.status === "pending") {
    return apiError("Request already in progress", HttpStatus.CONFLICT);
  }

  logger.info("Creating service category", {
    correlationId,
    actorRole: "ADMIN",
    name,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      professionalSettingsService.createServiceCategory({
        name,
        description,
        icon,
        imageUrl,
        professionType,
        sortOrder,
        isFeatured,
        metaTitle,
        metaDescription,
        keywords,
      }),
    { operationName: "create_service" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create service category",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    if (result.data.error === "conflict") {
      return apiError(
        "A service with this name already exists",
        HttpStatus.CONFLICT,
      );
    }
    return apiError(
      "Failed to create service category",
      result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const service = result.data.data;

  logger.info("Service category created successfully", {
    correlationId,
    actorRole: "ADMIN",
    serviceId: service.id,
  });

  try {
    await IdempotencyService.complete(idempotencyKey, service);
  } catch (error) {
    await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
    logger.error(
      "Idempotency completion failed",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, outcome: "idempotency_complete_failed" },
    );
  }
  return apiSuccess(service, HttpStatus.CREATED);
});
