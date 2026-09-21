// src/lib/queues/compliance.queue.ts
import { Queue } from "bullmq";
import { createRedisConnection } from "./redis-connection";
import { AuditAction, IncidentSeverity, type Prisma } from "@prisma/client";

// Queue instances
export const incidentQueue = new Queue<IncidentJobData>("security-incidents", {
  connection: createRedisConnection() as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 30 * 24 * 3600, // Keep for 30 days (compliance evidence)
    },
    removeOnFail: {
      age: 90 * 24 * 3600, // Keep failed attempts for 90 days
    },
  },
});

export const userNotificationQueue = new Queue<UserNotificationJobData>(
  "compliance-notifications",
  {
    connection: createRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "fixed",
        delay: 60000, // 1 minute between retries for rate limiting
      },
      removeOnComplete: {
        count: 1000,
      },
    },
  },
);

export const auditQueue = new Queue<AuditJobData>("audit-logs", {
  connection: createRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: {
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

// Job Data Types
export type EmergencyProtocolMetadata = {
  affectedCounty?: string;
  affectedUserIds?: string[];
  protectiveMeasures?: string[];
};

export type OdpcNotificationMetadata = {
  attempt?: number;
  deadlineAt?: string;
  lastFailure?: string;
};

export type UserNotificationMetadata = {
  channel?: "EMAIL" | "SMS" | "PUSH";
  batchNumber?: number;
  totalBatches?: number;
};

export type EscalationMetadata = {
  escalationReason?: string;
  dpoEmail?: string;
  ticketId?: string;
};

export type IncidentJobData =
  | {
      incidentId: string;
      type: "EMERGENCY_PROTOCOL";
      severity: IncidentSeverity;
      metadata?: EmergencyProtocolMetadata;
    }
  | {
      incidentId: string;
      type: "ODPC_NOTIFICATION";
      severity: IncidentSeverity;
      metadata?: OdpcNotificationMetadata;
    }
  | {
      incidentId: string;
      type: "USER_NOTIFICATION";
      severity: IncidentSeverity;
      metadata?: UserNotificationMetadata;
    }
  | {
      incidentId: string;
      type: "ESCALATION";
      severity: IncidentSeverity;
      metadata?: EscalationMetadata;
    };

export interface UserNotificationJobData {
  incidentId: string;
  userIds: string[];
  template:
    | "BREACH_NOTIFICATION"
    | "DATA_ACCESS_ALERT"
    | "CONSENT_WITHDRAWAL_CONFIRMATION";
  channel: "EMAIL" | "SMS" | "PUSH";
  priority: "HIGH" | "NORMAL" | "LOW";
  content: {
    subject: string;
    body: string;
    actionUrl?: string;
  };
  batchNumber?: number; // For tracking batch progress
  totalBatches?: number;
}

export type AuditJobMetadata = {
  correlationId?: string;
  requestId?: string;
  source?: "admin" | "client" | "system" | "api";
  reason?: string;
  [key: string]: Prisma.InputJsonValue | undefined;
};

export interface AuditJobData {
  actorId?: string;
  actorType: "USER" | "ADMIN" | "SYSTEM" | "API_KEY";
  actorEmail?: string; // Snapshot at time of action
  actorFirstName?: string; // Snapshot at time of action
  actorLastName?: string; // Snapshot at time of action
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: { old?: Prisma.InputJsonValue; new?: Prisma.InputJsonValue };
  metadata?: AuditJobMetadata;
  ipAddress?: string;
  userAgent?: string;
  legalBasis?:
    "CONSENT" | "CONTRACT" | "LEGAL_OBLIGATION" | "LEGITIMATE_INTEREST";
  timestamp: string; // ISO string
}

// Job names
export const ComplianceJobs = {
  TRIGGER_EMERGENCY: "trigger-emergency",
  NOTIFY_ODPC: "notify-odpc",
  NOTIFY_USERS_BATCH: "notify-users-batch",
  LOG_AUDIT: "log-audit",
  ESCALATE_INCIDENT: "escalate-incident",
} as const;

// Helper functions
export async function queueEmergencyProtocol(
  incidentId: string,
  severity: IncidentSeverity,
) {
  return incidentQueue.add(
    ComplianceJobs.TRIGGER_EMERGENCY,
    { incidentId, type: "EMERGENCY_PROTOCOL", severity },
    {
      priority: 100, // Highest priority
      delay: 0, // Immediate
    },
  );
}

export async function queueUserNotifications(
  incidentId: string,
  userIds: string[],
  data: Omit<UserNotificationJobData, "userIds" | "incidentId">,
) {
  // Batch users into chunks of 100 to avoid overwhelming email providers
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(userIds.length / batchSize);

    batches.push(
      userNotificationQueue.add(
        ComplianceJobs.NOTIFY_USERS_BATCH,
        {
          incidentId,
          userIds: batch,
          ...data,
          batchNumber,
          totalBatches,
        },
        {
          priority: data.priority === "HIGH" ? 50 : 10,
          delay: batchNumber * 1000, // Stagger batches by 1 second to rate limit
        },
      ),
    );
  }

  return Promise.all(batches);
}

export async function bufferAuditLog(data: AuditJobData) {
  return auditQueue.add(ComplianceJobs.LOG_AUDIT, data, {
    priority: 1, // Lowest priority, can be delayed
    attempts: 3,
  });
}
