import { NextRequest, NextResponse } from "next/server";
import { ComplianceService } from "@/lib/gdpr/services/compliance.service";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import { initializeAdminCorrelationId } from "@/lib/infrastructure/correlation";

// Only accessible by ADMIN
export async function GET(req: NextRequest) {
  const correlationId = initializeAdminCorrelationId(req);
  const logger = getAdminLogger();
  const requestStartedAt = Date.now();

  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      logger.warn({
        correlationId,
        operationName: "get_compliance_queue",
        adminRole: "unknown",
        outcome: "unauthorized",
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        role: true,
        id: true,
        adminProfile: { select: { role: true, isActive: true } },
      },
    });

    if (!user) {
      logger.warn({
        correlationId,
        operationName: "get_compliance_queue",
        adminRole: "unknown",
        outcome: "unauthorized",
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = user.role === "ADMIN";
    const hasActiveProfile = user.adminProfile?.isActive === true;

    if (!isAdmin || !hasActiveProfile) {
      const isDev = adminEnvConfig.NODE_ENV === "development";
      const devBypass = adminEnvConfig.DEV_ADMIN_BYPASS;

      if (!isDev || !devBypass) {
        logger.warn({
          correlationId,
          operationName: "get_compliance_queue",
          adminRole: user.adminProfile?.role
            ? String(user.adminProfile.role)
            : "unknown",
          outcome: "forbidden",
          durationMs: Date.now() - requestStartedAt,
          errorCode: "FORBIDDEN",
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const adminRole = user.adminProfile?.role
      ? String(user.adminProfile.role)
      : "unknown";

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") ?? undefined;

    const logs = await ComplianceService.getAuditLogs(
      actorId ? { actorId } : {},
    );

    // Record this data access in the audit trail
    await ComplianceService.logAdminAction(
      user.id,
      "DATA_ACCESS_BY_ADMIN",
      "AuditLog",
      "report",
      { query: searchParams.toString() },
    );

    logger.info({
      correlationId,
      operationName: "get_compliance_queue",
      adminRole,
      outcome: "success",
      durationMs: Date.now() - requestStartedAt,
      resourceType: "compliance_audit_log",
    });

    return NextResponse.json(logs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({
      correlationId,
      operationName: "get_compliance_queue",
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
