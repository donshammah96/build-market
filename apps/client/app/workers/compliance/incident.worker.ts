import { Worker, Job } from "bullmq";
import { redisConnection } from "@/app/lib/queues/redis-connection";
import {
  incidentQueue,
  IncidentJobData,
  ComplianceJobs,
} from "@/app/lib/queues/compliance.queue";
import { prisma } from "@build/db";
import { sendEmail } from "@/app/lib/mailer";
import { sendSMS } from "@/app/lib/sms";
import { IncidentSeverity } from "@prisma/client";

export const incidentWorker = new Worker<IncidentJobData>(
  "security-incidents",
  async (job: Job<IncidentJobData>) => {
    const { incidentId, type, severity, metadata } = job.data;

    console.log(
      `[IncidentWorker] Processing ${type} for incident ${incidentId}`,
    );

    switch (type) {
      case "EMERGENCY_PROTOCOL":
        return await handleEmergencyProtocol(incidentId, job);

      case "ODPC_NOTIFICATION":
        return await notifyODPC(incidentId, job);

      case "ESCALATION":
        return await escalateToDPO(incidentId, severity, metadata);

      default:
        throw new Error(`Unknown incident job type: ${type}`);
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 2, // Process 2 incidents simultaneously
    limiter: {
      max: 10,
      duration: 60000, // 10 per minute max
    },
  },
);

async function handleEmergencyProtocol(incidentId: string, job: Job) {
  await job.updateProgress(10);

  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // Skip if already handled
  if (incident.odpcNotified && incident.usersNotified) {
    console.log(`[EmergencyProtocol] Incident ${incidentId} already handled`);
    return { status: "already_handled" };
  }

  await job.updateProgress(30);

  // 1. Immediate ODPC Notification (if not already done)
  if (!incident.odpcNotified) {
    await incidentQueue.add(
      ComplianceJobs.NOTIFY_ODPC,
      {
        incidentId,
        type: "ODPC_NOTIFICATION",
        severity: incident.severity,
      },
      {
        priority: 100,
        attempts: 10, // Critical - retry many times
        backoff: {
          type: "exponential",
          delay: 60000, // 1 min, 2 min, 4 min, etc.
        },
      },
    );
  }

  await job.updateProgress(60);

  // 2. If CRITICAL, immediately freeze affected accounts or take protective action
  if (incident.severity === "CRITICAL") {
    await executeProtectiveMeasures(incident);
  }

  await job.updateProgress(80);

  // 3. Queue user notifications (batched)
  const affectedUsers = await identifyAffectedUsers(incident);

  if (affectedUsers.length > 0 && !incident.usersNotified) {
    const { queueUserNotifications } = await import(
      "@/app/lib/queues/compliance.queue"
    );

    await queueUserNotifications(incidentId, affectedUsers, {
      template: "BREACH_NOTIFICATION",
      channel: "EMAIL",
      priority: incident.severity === "CRITICAL" ? "HIGH" : "NORMAL",
      content: generateBreachNotification(incident),
    });

    // Also send SMS for CRITICAL incidents
    if (incident.severity === "CRITICAL") {
      await queueUserNotifications(
        incidentId,
        affectedUsers.slice(0, 100), // SMS only top 100 for cost/control
        {
          template: "BREACH_NOTIFICATION",
          channel: "SMS",
          priority: "HIGH",
          content: {
            subject: "Security Alert",
            body: `URGENT: A security incident affected your Build Market account. Check email for details. Incident ID: ${incidentId}`,
          },
        },
      );
    }
  }

  await job.updateProgress(100);

  return {
    status: "emergency_protocol_initiated",
    odpcQueued: !incident.odpcNotified,
    usersToNotify: affectedUsers.length,
  };
}

async function notifyODPC(incidentId: string, job: Job) {
  await job.updateProgress(10);

  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident || incident.odpcNotified) {
    return { status: "skipped" };
  }

  // Format ODPC Notification (Legal Requirement: 72 hours)
  const odpcEmail = process.env.ODPC_EMAIL || "dataprotection@odpc.go.ke";
  const subject = `DATA BREACH NOTIFICATION - ${incident.classification} - ${incidentId}`;

  const body = `
OFFICE OF THE DATA PROTECTION COMMISSIONER
DATA BREACH NOTIFICATION

Incident Reference: ${incidentId}
Date Detected: ${incident.detectedAt.toISOString()}
Severity: ${incident.severity}
Classification: ${incident.classification}

AFFECTED DATA SUBJECTS:
- Number: ${incident.affectedUserCount}
- Data Classes: ${incident.dataClasses.join(", ")}

DESCRIPTION:
${incident.description}

IMMEDIATE ACTIONS TAKEN:
1. Incident containment initiated
2. Affected systems isolated
3. Investigation underway

CONTACT:
Data Protection Officer
dpo@buildmarket.co.ke
+254 XXX XXX XXX

This notification is submitted within 72 hours as required by Section 43 of the Data Protection Act, 2019.
  `;

  await job.updateProgress(50);

  try {
    // Send email
    await sendEmail({
      to: odpcEmail,
      subject,
      html: `<pre>${body}</pre>`,
      attachments: [
        {
          filename: `incident-report-${incidentId}.txt`,
          content: body,
        },
      ],
    });

    await job.updateProgress(80);

    // Update incident record
    await prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        odpcNotified: true,
        notifiedAt: new Date(),
        notificationEmail: body,
      },
    });

    await job.updateProgress(100);

    return { status: "odpc_notified", notifiedAt: new Date().toISOString() };
  } catch (error) {
    console.error(
      `[ODPC Notification] Failed for incident ${incidentId}:`,
      error,
    );

    // Update incident with failure info but don't mark as notified
    const currentAttempts =
      (incident.metadata as any)?.odpcNotificationAttempts || 0;
    await prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        metadata: {
          ...((incident.metadata as object) || {}),
          odpcNotificationAttempts: currentAttempts + 1,
          lastFailure: error instanceof Error ? error.message : "Unknown error",
          lastAttemptAt: new Date().toISOString(),
        },
      },
    });

    throw error; // Trigger retry
  }
}

async function escalateToDPO(
  incidentId: string,
  severity: IncidentSeverity,
  metadata: any,
) {
  // Send urgent notification to internal DPO/Security team
  const dpoEmail = process.env.DPO_EMAIL || "security@buildmarket.co.ke";

  await sendEmail({
    to: dpoEmail,
    subject: `ESCALATION REQUIRED: ${severity} Security Incident - ${incidentId}`,
    html: `
      <h1>Security Incident Requires Immediate Attention</h1>
      <p>Incident: ${incidentId}</p>
      <p>Severity: ${severity}</p>
      <p>Metadata: ${JSON.stringify(metadata)}</p>
      <p>Time: ${new Date().toISOString()}</p>
    `,
  });

  // Create high-priority ticket in your system (e.g., Jira, Linear)
  // await createSecurityTicket(incidentId, severity);

  return { status: "escalated" };
}

async function executeProtectiveMeasures(incident: any) {
  // Critical incident actions:

  // 1. Force password reset for affected users
  if (incident.dataClasses.includes("PASSWORD")) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: await getAffectedUserIds(incident),
        },
      },
      data: {
        passwordResetRequired: true,
      },
    });
  }

  // 2. Revoke all active sessions
  await prisma.refreshToken.deleteMany({
    where: {
      userId: {
        in: await getAffectedUserIds(incident),
      },
    },
  });

  // 3. Disable API keys if API breach
  if (incident.classification === "API_KEY_EXPOSED") {
    // await revokeAllApiKeys();
  }

  console.log(`[ProtectiveMeasures] Executed for incident ${incident.id}`);
}

async function identifyAffectedUsers(incident: any): Promise<string[]> {
  // Logic to extract user IDs based on incident type
  // This is simplified - in production you'd query based on the incident scope

  if (incident.affectedUsers && Array.isArray(incident.affectedUsers)) {
    return incident.affectedUsers;
  }

  // Example: If breach affected specific county's users
  if (incident.metadata?.affectedCounty) {
    const users = await prisma.user.findMany({
      where: {
        clientProfile: {
          county: incident.metadata.affectedCounty,
        },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  return [];
}

async function getAffectedUserIds(incident: any): Promise<string[]> {
  return identifyAffectedUsers(incident);
}

function generateBreachNotification(incident: any) {
  return {
    subject: `Important Security Notice - Build Market Account`,
    body: `
Dear Valued Customer,

We are writing to inform you of a security incident that may have affected your personal data.

Incident Details:
- Date Detected: ${incident.detectedAt.toLocaleDateString()}
- Data Involved: ${incident.dataClasses.join(", ")}
- Incident ID: ${incident.id}

What happened:
${incident.description}

What we are doing:
- We have immediately secured the vulnerability
- We are working with cybersecurity experts
- We have notified the Office of the Data Protection Commissioner

What you should do:
1. Change your password immediately
2. Enable two-factor authentication if not already enabled
3. Monitor your account for suspicious activity

We sincerely apologize for this incident and any inconvenience caused.

For questions, contact our DPO at dpo@buildmarket.co.ke

Reference: ${incident.id}
    `,
    actionUrl: `${process.env.APP_URL}/security/reset-password?incident=${incident.id}`,
  };
}

// Event handlers
incidentWorker.on("completed", (job) => {
  console.log(`[IncidentWorker] Completed job ${job.id}`);
});

incidentWorker.on("failed", (job, err) => {
  console.error(`[IncidentWorker] Job ${job?.id} failed:`, err);

  // Alert on-call engineer if critical
  if (job?.data.severity === "CRITICAL") {
    // await alertOnCallEngineer(err);
  }
});
