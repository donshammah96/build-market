import { NextResponse } from "next/server";
import {
  incidentQueue,
  userNotificationQueue,
  auditQueue,
} from "@/lib/queues/compliance.queue";

export async function GET() {
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
    incidentId: job.data.incidentId,
  }));

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
}
