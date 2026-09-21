import { z } from "zod";

// --- Incidents schemas ---
export const EmergencyProtocolMetadataSchema = z.object({
  affectedCounty: z.string().optional(),
  affectedUserIds: z.array(z.string()).optional(),
  protectiveMeasures: z.array(z.string()).optional(),
});

export const OdpcNotificationMetadataSchema = z.object({
  attempt: z.number().optional(),
  deadlineAt: z.string().optional(),
  lastFailure: z.string().optional(),
});

export const UserNotificationMetadataSchema = z.object({
  channel: z.enum(["EMAIL", "SMS", "PUSH"]).optional(),
  batchNumber: z.number().optional(),
  totalBatches: z.number().optional(),
});

export const EscalationMetadataSchema = z.object({
  escalationReason: z.string().optional(),
  dpoEmail: z.string().optional(),
  ticketId: z.string().optional(),
});

export const IncidentJobDataSchema = z.discriminatedUnion("type", [
  z.object({
    incidentId: z.string().uuid(),
    type: z.literal("EMERGENCY_PROTOCOL"),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    metadata: EmergencyProtocolMetadataSchema.optional(),
  }),
  z.object({
    incidentId: z.string().uuid(),
    type: z.literal("ODPC_NOTIFICATION"),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    metadata: OdpcNotificationMetadataSchema.optional(),
  }),
  z.object({
    incidentId: z.string().uuid(),
    type: z.literal("USER_NOTIFICATION"),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    metadata: UserNotificationMetadataSchema.optional(),
  }),
  z.object({
    incidentId: z.string().uuid(),
    type: z.literal("ESCALATION"),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    metadata: EscalationMetadataSchema.optional(),
  }),
]);

// --- Compliance notifications schemas ---
export const UserNotificationJobDataSchema = z.object({
  incidentId: z.string().uuid(),
  userIds: z.array(z.string()),
  template: z.enum([
    "BREACH_NOTIFICATION",
    "DATA_ACCESS_ALERT",
    "CONSENT_WITHDRAWAL_CONFIRMATION",
  ]),
  channel: z.enum(["EMAIL", "SMS", "PUSH"]),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]),
  content: z.object({
    subject: z.string(),
    body: z.string(),
    actionUrl: z.string().url().optional(),
  }),
  batchNumber: z.number().optional(),
  totalBatches: z.number().optional(),
});

// --- Audit log schemas ---
export const AuditJobMetadataSchema = z.record(z.string(), z.any());

export const AuditJobDataSchema = z.object({
  actorId: z.string().uuid().optional(),
  actorType: z.enum(["USER", "ADMIN", "SYSTEM", "API_KEY"]),
  actorEmail: z.string().email().optional(),
  actorFirstName: z.string().optional(),
  actorLastName: z.string().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  changes: z
    .object({
      old: z.any().optional(),
      new: z.any().optional(),
    })
    .optional(),
  metadata: AuditJobMetadataSchema.optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  legalBasis: z
    .enum(["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "LEGITIMATE_INTEREST"])
    .optional(),
  timestamp: z.string().datetime(),
});

// --- GDPR Data Export schema ---
export const ExportJobDataSchema = z.object({
  exportId: z.string().uuid(),
  userId: z.string().uuid(),
  ipAddress: z.string(),
  userAgent: z.string(),
});

// --- GDPR Erasure job schema ---
export const ErasureJobDataSchema = z.object({
  userId: z.string().uuid().optional(),
  triggeredManually: z.boolean().optional(),
});

// --- Generic Cron/Batch job schema ---
export const CronJobDataSchema = z.object({
  triggeredManually: z.boolean().optional(),
});

// --- Queue Registry ---
export interface QueueRegistryEntry {
  queueName: string;
  description: string;
  schema: z.ZodSchema<any>;
  onCallOwner: string;
  maxAttempts: number;
}

export const QUEUE_REGISTRY: Record<string, QueueRegistryEntry> = {
  // Queue Names
  "security-incidents": {
    queueName: "security-incidents",
    description: "Tracks compliance and security incidents",
    schema: IncidentJobDataSchema,
    onCallOwner: "Compliance Team",
    maxAttempts: 5,
  },
  "compliance-notifications": {
    queueName: "compliance-notifications",
    description: "Tracks breach/compliance notifications sent to users",
    schema: UserNotificationJobDataSchema,
    onCallOwner: "Compliance Team",
    maxAttempts: 3,
  },
  "audit-logs": {
    queueName: "audit-logs",
    description: "Buffers system audit log events",
    schema: AuditJobDataSchema,
    onCallOwner: "Security Team",
    maxAttempts: 3,
  },
  "gdpr-data-export": {
    queueName: "gdpr-data-export",
    description: "Orchestrates user GDPR data export archives",
    schema: ExportJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "gdpr-erasure": {
    queueName: "gdpr-erasure",
    description: "Triggers deactivation and field erasure pipelines",
    schema: ErasureJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 5,
  },
  "gdpr-data-retention": {
    queueName: "gdpr-data-retention",
    description: "Calculates and schedules cleanup of stale profiles",
    schema: CronJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "gdpr-asset-cleanup": {
    queueName: "gdpr-asset-cleanup",
    description: "Cleans up expired assets and storage objects",
    schema: CronJobDataSchema,
    onCallOwner: "Storage Team",
    maxAttempts: 3,
  },
  "gdpr-anonymization-batch": {
    queueName: "gdpr-anonymization-batch",
    description: "Batches anonymization records",
    schema: CronJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "maintenance-jobs": {
    queueName: "maintenance-jobs",
    description: "Handles system maintenance tasks",
    schema: CronJobDataSchema,
    onCallOwner: "Platform Team",
    maxAttempts: 3,
  },

  // Job Names (Overrides)
  "perform-user-erasure": {
    queueName: "gdpr-erasure",
    description: "Performs user profile erasure and cleanup",
    schema: z.object({ userId: z.string().uuid() }),
    onCallOwner: "GDPR Team",
    maxAttempts: 5,
  },
  "process-pending-erasures": {
    queueName: "gdpr-erasure",
    description:
      "Scans for deactivated accounts and triggers GDPR erasure batches",
    schema: CronJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "enforce-data-retention": {
    queueName: "gdpr-data-retention",
    description: "Enforces data retention constraints",
    schema: CronJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "process-pending-anonymizations": {
    queueName: "gdpr-anonymization-batch",
    description: "Processes anonymization jobs",
    schema: CronJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
  "cleanup-expired-assets": {
    queueName: "gdpr-asset-cleanup",
    description: "Cleans up expired asset media files",
    schema: CronJobDataSchema,
    onCallOwner: "Storage Team",
    maxAttempts: 3,
  },
  "cleanup-expired": {
    queueName: "maintenance-jobs",
    description: "Cleans up expired S3 data exports",
    schema: CronJobDataSchema,
    onCallOwner: "Platform Team",
    maxAttempts: 3,
  },
  "expire-pending-licenses": {
    queueName: "maintenance-jobs",
    description: "Runs verification license expiry scans",
    schema: CronJobDataSchema,
    onCallOwner: "Verification Team",
    maxAttempts: 3,
  },
  "archive-settled-records": {
    queueName: "maintenance-jobs",
    description:
      "Archives settled Mpesa transactions and verification cases older than 180 days",
    schema: CronJobDataSchema,
    onCallOwner: "Data Platform Team",
    maxAttempts: 3,
  },
  "process-export": {
    queueName: "gdpr-data-export",
    description: "Executes GDPR user data compilation and zip export",
    schema: ExportJobDataSchema,
    onCallOwner: "GDPR Team",
    maxAttempts: 3,
  },
};

/**
 * Validates payload data against registered schema.
 * Throws an error on validation failure (fails closed/poison-message isolation).
 */
export function validateJobPayload(
  queueName: string,
  jobName: string,
  data: unknown,
): void {
  const entry = QUEUE_REGISTRY[jobName] || QUEUE_REGISTRY[queueName];
  if (!entry) {
    throw new Error(
      `Neither job ${jobName} nor queue ${queueName} is registered in central queue registry`,
    );
  }

  const result = entry.schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Payload validation failed for job ${jobName} on queue ${queueName}: ${details}`,
    );
  }
}
