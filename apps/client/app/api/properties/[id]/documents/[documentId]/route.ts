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
import { updateDocumentSchema } from "@/app/lib/domains/properties/contracts";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

const AUDIT_ACTION_PROFILE_UPDATED = "PROFILE_UPDATED";
const AUDIT_ACTION_DATA_RECTIFIED = "DATA_RECTIFIED";

export const PATCH = withAuth<{ id: string; documentId: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "update_property_document";
    const actorRole = actorRoleLabel(userRole);
    const propertyId = params!.id;
    const documentId = params!.documentId;

    if (!isValidId(propertyId) || !isValidId(documentId)) {
      const response = apiError(
        "Invalid property or document ID",
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
      });
      return response;
    }

    const validation = updateDocumentSchema.safeParse(body);
    if (!validation.success) {
      const response = apiError(
        validation.error.message,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.updatePropertyDocument(
          propertyId,
          documentId,
          { userId: dbUserId, role: userRole },
          validation.data,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to update property document",
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
      });
      return errorResponse!;
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AUDIT_ACTION_PROFILE_UPDATED,
      "PropertyDocument",
      documentId,
      {
        propertyId,
        action: "UPDATE",
        changes: {
          type: validation.data.type,
          assetId: validation.data.assetId,
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
      resourceType: "propertyDocument",
      resourceId: documentId,
    });
    return response;
  },
);

export const DELETE = withAuth<{ id: string; documentId: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "delete_property_document";
    const actorRole = actorRoleLabel(userRole);
    const propertyId = params!.id;
    const documentId = params!.documentId;

    if (!isValidId(propertyId) || !isValidId(documentId)) {
      const response = apiError(
        "Invalid property or document ID",
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.removePropertyDocument(propertyId, documentId, {
          userId: dbUserId,
          role: userRole,
        }),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to delete property document",
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
        resourceType: "propertyDocument",
        resourceId: documentId,
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
        resourceType: "propertyDocument",
        resourceId: documentId,
      });
      return errorResponse!;
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AUDIT_ACTION_DATA_RECTIFIED,
      "PropertyDocument",
      documentId,
      { propertyId, action: "DELETE" },
    ).catch(() => {});

    const response = apiSuccess(
      { message: "Document deleted successfully" },
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
      resourceType: "propertyDocument",
      resourceId: documentId,
    });
    return response;
  },
);
