import { Queue } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";
import { AuditAction, IncidentSeverity } from "@build/db";

export const ComplianceJobs = {
  TRIGGER_EMERGENCY: "trigger-emergency",
  NOTIFY_ODPC: "notify-odpc",
  NOTIFY_USERS_BATCH: "notify-users-batch",
  LOG_AUDIT: "log-audit",
  ESCALATE_INCIDENT: "escalate-incident",
} as const;

type ComplianceJobName = (typeof ComplianceJobs)[keyof typeof ComplianceJobs];

/**
 * BullMQ requires a dedicated ioredis connection per Queue instance.
 * Each queue below gets its own connection — do not share across constructs.
 */
export const incidentQueue = new Queue<
  IncidentJobData,
  unknown,
  ComplianceJobName
>("security-incidents", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 30 * 24 * 3600 },
    removeOnFail: { age: 90 * 24 * 3600 },
  },
});

export const userNotificationQueue = new Queue<
  UserNotificationJobData,
  unknown,
  ComplianceJobName
>("compliance-notifications", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 60000 },
    removeOnComplete: { count: 1000 },
  },
});

export const auditQueue = new Queue<AuditJobData, unknown, ComplianceJobName>(
  "audit-logs",
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { age: 7 * 24 * 3600 },
    },
  },
);

export interface IncidentJobData {
  incidentId: string;
  type:
    | "EMERGENCY_PROTOCOL"
    | "ODPC_NOTIFICATION"
    | "USER_NOTIFICATION"
    | "ESCALATION";
  severity: IncidentSeverity;
  metadata?: Record<string, any>;
}

export interface UserNotificationJobData {
  incidentId: string;
  userIds: string[];
  template:
    | "BREACH_NOTIFICATION"
    | "DATA_ACCESS_ALERT"
    | "CONSENT_WITHDRAWAL_CONFIRMATION";
  channel: "EMAIL" | "SMS" | "PUSH";
  priority: "HIGH" | "NORMAL" | "LOW";
  content: { subject: string; body: string; actionUrl?: string };
  batchNumber?: number;
  totalBatches?: number;
}

export interface AuditJobData {
  actorId?: string;
  actorType: "USER" | "ADMIN" | "SYSTEM" | "API_KEY";
  actorEmail?: string;
  actorFirstName?: string;
  actorLastName?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: { old?: any; new?: any };
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  legalBasis?:
    | "CONSENT"
    | "CONTRACT"
    | "LEGAL_OBLIGATION"
    | "LEGITIMATE_INTEREST";
  timestamp: string;
}

export async function queueEmergencyProtocol(
  incidentId: string,
  severity: IncidentSeverity,
) {
  return incidentQueue.add(
    ComplianceJobs.TRIGGER_EMERGENCY,
    { incidentId, type: "EMERGENCY_PROTOCOL", severity },
    { priority: 100, delay: 0 },
  );
}

export async function queueUserNotifications(
  incidentId: string,
  userIds: string[],
  data: Omit<UserNotificationJobData, "userIds" | "incidentId">,
) {
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(userIds.length / batchSize);

    batches.push(
      userNotificationQueue.add(
        ComplianceJobs.NOTIFY_USERS_BATCH,
        { incidentId, userIds: batch, ...data, batchNumber, totalBatches },
        {
          priority: data.priority === "HIGH" ? 50 : 10,
          delay: batchNumber * 1000,
        },
      ),
    );
  }

  return Promise.all(batches);
}

export async function bufferAuditLog(data: AuditJobData) {
  return auditQueue.add(ComplianceJobs.LOG_AUDIT, data, {
    priority: 1,
    attempts: 3,
  });
}
