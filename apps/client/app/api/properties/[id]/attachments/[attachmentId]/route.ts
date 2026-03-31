import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import {
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { propertiesService } from "@/app/lib/domains/properties";
import { updateAttachmentSchema } from "@/app/lib/domains/properties/contracts";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

const AUDIT_ACTION_PROFILE_UPDATED = "PROFILE_UPDATED";
const AUDIT_ACTION_DATA_RECTIFIED = "DATA_RECTIFIED";

export const GET = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "get_property_attachment";
    const actorRole = actorRoleLabel(userRole);
    const propertyId = params!.id;
    const attachmentId = params!.attachmentId;

    if (!isValidId(propertyId) || !isValidId(attachmentId)) {
      const response = apiError(
        "Invalid property or attachment ID",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!success) {
      const response = apiError(
        "Too many requests",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.getPropertyAttachmentById(propertyId, attachmentId, {
          userId: dbUserId,
          role: userRole,
        }),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to fetch property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const domainResult = result.data;

    if (!domainResult.ok) {
      const errorResponse = domainResultToErrorResponse(
        domainResult,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return errorResponse!;
    }

    const response = apiSuccess(
      domainResult.data,
      HttpStatus.OK,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "propertyAttachment",
      resourceId: attachmentId,
    });
    return response;
  },
);

export const PATCH = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "update_property_attachment";
    const actorRole = actorRoleLabel(userRole);
    const propertyId = params!.id;
    const attachmentId = params!.attachmentId;

    if (!isValidId(propertyId) || !isValidId(attachmentId)) {
      const response = apiError(
        "Invalid property or attachment ID",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!success) {
      const response = apiError(
        "Too many requests",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const bodyError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (bodyError) {
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: bodyError.status,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return bodyError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const response = apiError(
        "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const payload =
      body && typeof body === "object"
        ? { ...(body as Record<string, unknown>), attachmentId }
        : { attachmentId };

    const validation = updateAttachmentSchema.safeParse(payload);
    if (!validation.success) {
      const response = apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    if (
      validation.data.title === undefined &&
      validation.data.assetId === undefined &&
      validation.data.type === undefined &&
      validation.data.notes === undefined
    ) {
      const response = apiError(
        "At least one attachment field must be provided",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.updatePropertyAttachment(
          propertyId,
          { userId: dbUserId, role: userRole },
          validation.data,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to update property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const domainResult = result.data;

    if (!domainResult.ok) {
      const errorResponse = domainResultToErrorResponse(
        domainResult,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return errorResponse!;
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AUDIT_ACTION_PROFILE_UPDATED,
      "PropertyAttachment",
      attachmentId,
      {
        propertyId,
        action: "UPDATE",
        changes: {
          title: validation.data.title,
          type: validation.data.type,
          assetId: validation.data.assetId,
          notes: validation.data.notes,
        },
      },
    ).catch(() => {});

    const response = apiSuccess(
      domainResult.data,
      HttpStatus.OK,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "propertyAttachment",
      resourceId: attachmentId,
    });
    return response;
  },
);

export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "delete_property_attachment";
    const actorRole = actorRoleLabel(userRole);
    const propertyId = params!.id;
    const attachmentId = params!.attachmentId;

    if (!isValidId(propertyId) || !isValidId(attachmentId)) {
      const response = apiError(
        "Invalid property or attachment ID",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!success) {
      const response = apiError(
        "Too many requests",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.removePropertyAttachment(propertyId, attachmentId, {
          userId: dbUserId,
          role: userRole,
        }),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to delete property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return response;
    }

    const domainResult = result.data;

    if (!domainResult.ok) {
      const errorResponse = domainResultToErrorResponse(
        domainResult,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "propertyAttachment",
        resourceId: attachmentId,
      });
      return errorResponse!;
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AUDIT_ACTION_DATA_RECTIFIED,
      "PropertyAttachment",
      attachmentId,
      { propertyId, action: "DELETE" },
    ).catch(() => {});

    const response = apiSuccess(
      { message: "Attachment deleted successfully" },
      HttpStatus.OK,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "propertyAttachment",
      resourceId: attachmentId,
    });
    return response;
  },
);
