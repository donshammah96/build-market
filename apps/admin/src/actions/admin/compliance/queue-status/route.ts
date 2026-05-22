import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import { initializeAdminCorrelationId } from "@/lib/infrastructure/correlation";
import {
  incidentQueue,
  userNotificationQueue,
  auditQueue,
} from "@/lib/queues/compliance.queue";

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
        operationName: "get_compliance_queue_status",
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
        operationName: "get_compliance_queue_status",
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
          operationName: "get_compliance_queue_status",
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

    const [incidentStats, notificationStats, auditStats] = await Promise.all([
      incidentQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      userNotificationQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
      ),
      auditQueue.getJobCounts("waiting", "active", "completed", "failed"),
    ]);

    // Get failed jobs for alerting
    const failedIncidents = await incidentQueue.getFailed();
    const recentFailures = failedIncidents.slice(0, 5).map((job: any) => ({
      id: job.id,
      name: job.name,
      failedAt: job.finishedOn,
      reason: job.failedReason,
      incidentId: job.data?.incidentId,
    }));

    logger.info({
      correlationId,
      operationName: "get_compliance_queue_status",
      adminRole,
      outcome: "success",
      durationMs: Date.now() - requestStartedAt,
      resourceType: "compliance_queue_status",
    });

    return NextResponse.json({
      queues: {
        incidents: incidentStats,
        notifications: notificationStats,
        audit: auditStats,
      },
      recentFailures,
      health: {
        status: failedIncidents.length > 10 ? "WARNING" : "HEALTHY",
        message:
          failedIncidents.length > 10
            ? "High number of failed compliance jobs"
            : "All systems operational",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({
      correlationId,
      operationName: "get_compliance_queue_status",
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
