import { NextRequest, NextResponse } from "next/server";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import type { AdminLogEvent } from "@/lib/infrastructure/logger";
import { initializeAdminCorrelationId } from "@/lib/infrastructure/correlation";
import { resolveAdminRouteActor } from "@/lib/security/route-auth";
import { gdprService } from "@/lib/domains/gdpr/service";

// Only accessible by ADMIN with EXPORT_DATA capability
export async function GET(req: NextRequest) {
  const correlationId = initializeAdminCorrelationId(req);
  const logger = getAdminLogger();
  const requestStartedAt = Date.now();
  const operationName = "get_compliance_queue";

  try {
    const authResult = await resolveAdminRouteActor(
      correlationId,
      operationName,
      (fields) => logger.warn(fields as AdminLogEvent),
      requestStartedAt,
    );

    if (!authResult.authorized) {
      return authResult.response;
    }

    const { actor, adminRoleStr } = authResult;

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") ?? undefined;

    const logsResult = await gdprService.getComplianceQueue(
      actor,
      actorId ? { actorId } : {},
    );

    if (!logsResult.ok) {
      logger.warn({
        correlationId,
        operationName,
        adminRole: adminRoleStr,
        outcome: "domain_error",
        durationMs: Date.now() - requestStartedAt,
        errorCode: logsResult.code,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Record this data access in the compliance audit trail (ADR-ADMIN-008)
    const auditResult = await gdprService.logAdminDataAccess(actor, {
      action: "DATA_ACCESS_BY_ADMIN",
      entityType: "AuditLog",
      entityId: "report",
      details: { query: searchParams.toString() },
    });

    if (!auditResult.ok) {
      // Non-blocking per ADR-ADMIN-008 — log but do not fail the request
      logger.warn({
        correlationId,
        operationName,
        adminRole: adminRoleStr,
        outcome: "domain_error",
        durationMs: Date.now() - requestStartedAt,
        errorCode: auditResult.code,
      });
    }

    logger.info({
      correlationId,
      operationName,
      adminRole: adminRoleStr,
      outcome: "success",
      durationMs: Date.now() - requestStartedAt,
      resourceType: "compliance_audit_log",
    });

    return NextResponse.json(logsResult.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({
      correlationId,
      operationName,
      adminRole: "unknown",
      outcome: "internal_error",
      durationMs: Date.now() - requestStartedAt,
      errorCode: "INTERNAL_ERROR",
      errorMessage: message,
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
