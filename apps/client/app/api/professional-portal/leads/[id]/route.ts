import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdateLeadSchema } from "@/app/lib/validation/leads-validation";
import { LEAD_CONFIG } from "@/app/lib/config/lead.config";
import { leadsService } from "@/app/lib/domains/leads";
import { normalizeRole } from "@/app/lib/security/roles";

// Union narrowing: For { success: true; data } | { success: false; error } results,
// use `if (data.success === false)` + explicit `else` for the success path so
// TypeScript narrows correctly. See API-TO-FRONTEND-ARCHITECTURE.md Step 7.

type LeadParams = { id: string };

/**
 * GET /api/professional-portal/leads/[id]
 * Get a specific lead by ID (owner only).
 */
export const GET = withAuth<LeadParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    initializeCorrelationId(req);

    const leadId = params?.id;

    if (!leadId || !isValidId(leadId)) {
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `leads-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        leadsService.getProfessionalLeadById(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          leadId,
        ),
      { operationName: "get_lead_detail" },
    );

    if (!result.success || !result.data) {
      return apiError("Failed to fetch lead", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const data = result.data;
    if (!data.ok) {
      if (data.error === "not_found")
        return apiError("Lead not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/leads/[id]
 * Update a lead (owner only).
 */
export const PATCH = withAuth<LeadParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const leadId = params?.id;

    if (!leadId || !isValidId(leadId)) {
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, LEAD_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateLeadSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        leadId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "lead",
      dbUserId,
      "PATCH",
    );
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `leads-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Updating lead", {
      correlationId,
      leadId,
      fields: Object.keys(updateData),
      actorRole: normalizeRole(String(userRole)),
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        leadsService.updateProfessionalLead(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          leadId,
          updateData,
        ),
      { operationName: "update_lead" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update lead",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Lead not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/leads/[id]
 * Delete a lead (owner only).
 */
export const DELETE = withAuth<LeadParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const leadId = params?.id;

    if (!leadId || !isValidId(leadId)) {
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // ignore
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", {
        leadId,
        ...(body && typeof body === "object" ? body : {}),
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "lead",
      dbUserId,
      "DELETE",
    );
    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `leads-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Deleting lead", {
      correlationId,
      leadId,
      actorRole: normalizeRole(String(userRole)),
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        leadsService.deleteProfessionalLead(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          leadId,
        ),
      { operationName: "delete_lead" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete lead",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Lead not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);
