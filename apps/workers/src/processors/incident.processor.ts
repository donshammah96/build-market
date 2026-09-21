import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { sendEmail } from "@build/mail-server";
import type { Job } from "bullmq";
import {
  incidentQueue,
  userNotificationQueue,
  ComplianceJobs,
  type IncidentJobData,
} from "@build/queue-server";
import { validateWorkerEnv } from "../env.js";

const logger = new StructuredLogger("worker-incident-processor");

export interface IncidentJobResult {
  status: "success" | "already_handled" | "escalated";
  incidentId: string;
  type: string;
}

export async function processIncidentJob(
  job: Job<IncidentJobData>,
): Promise<IncidentJobResult> {
  const { incidentId, type, severity, metadata } = job.data;
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.info("[IncidentProcessor] Processing incident job", {
    correlationId,
    incidentId,
    type,
    severity,
    jobId: job.id,
  });

  switch (type) {
    case "EMERGENCY_PROTOCOL":
      return await handleEmergencyProtocol(incidentId, job, correlationId);

    case "ODPC_NOTIFICATION":
      return await notifyODPC(incidentId, job, correlationId);

    case "ESCALATION":
      return await escalateToDPO(incidentId, severity, metadata, correlationId);

    default:
      throw new Error(`Unknown incident job type: ${type}`);
  }
}

async function handleEmergencyProtocol(
  incidentId: string,
  job: Job,
  correlationId: string,
): Promise<IncidentJobResult> {
  await job.updateProgress(10);

  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  if (incident.odpcNotified && incident.usersNotified) {
    logger.info("[IncidentProcessor] Incident already handled, skipping", {
      correlationId,
      incidentId,
    });
    return {
      status: "already_handled",
      incidentId,
      type: "EMERGENCY_PROTOCOL",
    };
  }

  await job.updateProgress(30);

  // 1. Immediate ODPC Notification
  if (!incident.odpcNotified) {
    await incidentQueue.add(
      ComplianceJobs.NOTIFY_ODPC,
      {
        incidentId,
        type: "ODPC_NOTIFICATION",
        severity: incident.severity,
      },
      { priority: 1, attempts: 5 },
    );
  }

  await job.updateProgress(60);

  // 2. User Notification Batching (if critical/high)
  if (
    !incident.usersNotified &&
    (incident.severity === "CRITICAL" || incident.severity === "HIGH")
  ) {
    const affectedUsers = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
      take: 1000,
    });

    const userIds = affectedUsers.map((u) => u.id);
    const batchSize = 100;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await userNotificationQueue.add(
        ComplianceJobs.NOTIFY_USERS_BATCH,
        {
          incidentId,
          userIds: batch,
          template: "BREACH_NOTIFICATION",
          channel: "EMAIL",
          priority: "HIGH",
          content: {
            subject: "Security Notice: Important Account Information",
            body: `We are writing to inform you of a security incident detected on ${incident.createdAt.toISOString()}.`,
          },
          batchNumber: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(userIds.length / batchSize),
        },
        { priority: 1 },
      );
    }
  }

  await job.updateProgress(100);

  return { status: "success", incidentId, type: "EMERGENCY_PROTOCOL" };
}

async function notifyODPC(
  incidentId: string,
  job: Job,
  correlationId: string,
): Promise<IncidentJobResult> {
  const env = validateWorkerEnv();
  const odpcEmail = env.ODPC_EMAIL ?? "dpo@odpc.go.ke";

  await job.updateProgress(20);

  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const subject = `MANDATORY NOTIFICATION: Data Breach - ${incidentId}`;
  const body = `
DATA BREACH NOTIFICATION TO ODPC
Submitted by: BuildMarket
Incident Reference: ${incidentId}
Severity: ${incident.severity}
Date Detected: ${incident.createdAt.toISOString()}
Description: ${incident.description}
  `.trim();

  await sendEmail({
    to: odpcEmail,
    subject,
    html: `<pre>${body}</pre>`,
    text: body,
  });

  await prisma.securityIncident.update({
    where: { id: incidentId },
    data: { odpcNotified: true, notifiedAt: new Date() },
  });

  await job.updateProgress(100);

  logger.info("[IncidentProcessor] ODPC notification delivered", {
    correlationId,
    incidentId,
  });

  return { status: "success", incidentId, type: "ODPC_NOTIFICATION" };
}

async function escalateToDPO(
  incidentId: string,
  severity: string,
  metadata: Record<string, unknown> | undefined,
  correlationId: string,
): Promise<IncidentJobResult> {
  const env = validateWorkerEnv();
  const dpoEmail = env.DPO_EMAIL ?? "security@buildmarket.co.ke";

  const subject = `ESCALATION REQUIRED: ${severity} Security Incident - ${incidentId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #dc2626;">🚨 Security Incident Escalation</h2>
      <p><strong>Incident ID:</strong> ${incidentId}</p>
      <p><strong>Severity:</strong> ${severity}</p>
      <pre style="background: #f3f4f6; padding: 10px;">${JSON.stringify(metadata ?? {}, null, 2)}</pre>
    </div>
  `;

  await sendEmail({
    to: dpoEmail,
    subject,
    html,
  });

  logger.info("[IncidentProcessor] Escalation notice sent to DPO", {
    correlationId,
    incidentId,
  });

  return { status: "escalated", incidentId, type: "ESCALATION" };
}
