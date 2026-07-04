import { NextRequest, NextResponse } from "next/server";
import { resolveAdminRouteActor } from "@/lib/security/route-auth";
import type { AdminLogEvent } from "@/lib/infrastructure/logger";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import { initializeAdminCorrelationId } from "@/lib/infrastructure/correlation";
import type { Job } from "bullmq";
import type { IncidentJobData } from "@/lib/queues/compliance.queue";
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
    const authResult = await resolveAdminRouteActor(
      correlationId,
      "get_compliance_queue_status",
      (fields) => logger.warn(fields as AdminLogEvent),
      requestStartedAt,
    );

    if (!authResult.authorized) {
      return authResult.response;
    }

    const { adminRoleStr: adminRole } = authResult;

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
    const recentFailures = failedIncidents
      .slice(0, 5)
      .map((job: Job<IncidentJobData>) => ({
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
