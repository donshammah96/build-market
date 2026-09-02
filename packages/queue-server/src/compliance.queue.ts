import { Queue } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";
import { AuditAction, IncidentSeverity } from "@build/db";

export const ComplianceJobs = {
  TRIGGER_EMERGENCY: "trigger-emergency",
  NOTIFY_ODPC: "notify-odpc",
  NOTIFY_USERS_BATCH: "notify-users-batch",
  LOG_AUDIT: "log-audit",
  ESCALATE_INCIDENT: "escalate-incident",
} as const;

export type ComplianceJobName =
  (typeof ComplianceJobs)[keyof typeof ComplianceJobs];

let incidentQueueInstance: Queue<
  IncidentJobData,
  unknown,
  ComplianceJobName
> | null = null;
let userNotificationQueueInstance: Queue<
  UserNotificationJobData,
  unknown,
  ComplianceJobName
> | null = null;
let auditQueueInstance: Queue<AuditJobData, unknown, ComplianceJobName> | null =
  null;

export function getIncidentQueue(): Queue<
  IncidentJobData,
  unknown,
  ComplianceJobName
> {
  if (!incidentQueueInstance) {
    incidentQueueInstance = new Queue<
      IncidentJobData,
      unknown,
      ComplianceJobName
    >("security-incidents", {
      connection: getQueueConnectionOptions("security-incidents"),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        ...QueueRetentionPolicies.FINANCIAL_AUDIT,
      },
    });
  }
  return incidentQueueInstance;
}

export function getUserNotificationQueue(): Queue<
  UserNotificationJobData,
  unknown,
  ComplianceJobName
> {
  if (!userNotificationQueueInstance) {
    userNotificationQueueInstance = new Queue<
      UserNotificationJobData,
      unknown,
      ComplianceJobName
    >("compliance-notifications", {
      connection: getQueueConnectionOptions("compliance-notifications"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "fixed", delay: 60000 },
        ...QueueRetentionPolicies.HIGH_THROUGHPUT,
      },
    });
  }
  return userNotificationQueueInstance;
}

export function getAuditQueue(): Queue<
  AuditJobData,
  unknown,
  ComplianceJobName
> {
  if (!auditQueueInstance) {
    auditQueueInstance = new Queue<AuditJobData, unknown, ComplianceJobName>(
      "audit-logs",
      {
        connection: getQueueConnectionOptions("audit-logs"),
        defaultJobOptions: {
          attempts: 3,
          ...QueueRetentionPolicies.FINANCIAL_AUDIT,
        },
      },
    );
  }
  return auditQueueInstance;
}

// Proxies for backward compatibility with direct exports
export const incidentQueue = new Proxy(
  {} as Queue<IncidentJobData, unknown, ComplianceJobName>,
  {
    get(_target, prop, receiver) {
      const queue = getIncidentQueue();
      const value = Reflect.get(queue, prop, receiver);
      return typeof value === "function" ? value.bind(queue) : value;
    },
  },
);

export const userNotificationQueue = new Proxy(
  {} as Queue<UserNotificationJobData, unknown, ComplianceJobName>,
  {
    get(_target, prop, receiver) {
      const queue = getUserNotificationQueue();
      const value = Reflect.get(queue, prop, receiver);
      return typeof value === "function" ? value.bind(queue) : value;
    },
  },
);

export const auditQueue = new Proxy(
  {} as Queue<AuditJobData, unknown, ComplianceJobName>,
  {
    get(_target, prop, receiver) {
      const queue = getAuditQueue();
      const value = Reflect.get(queue, prop, receiver);
      return typeof value === "function" ? value.bind(queue) : value;
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
    "CONSENT" | "CONTRACT" | "LEGAL_OBLIGATION" | "LEGITIMATE_INTEREST";
  timestamp: string;
}

export async function queueEmergencyProtocol(
  incidentId: string,
  severity: IncidentSeverity,
) {
  const queue = getIncidentQueue();
  return queue.add(
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
  const queue = getUserNotificationQueue();
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(userIds.length / batchSize);

    batches.push(
      queue.add(
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
  const queue = getAuditQueue();
  return queue.add(ComplianceJobs.LOG_AUDIT, data, {
    priority: 1,
    attempts: 3,
  });
}
