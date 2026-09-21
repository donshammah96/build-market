import "server-only";

export type SecurityAuditEventType =
  | "USER_REGISTERED"
  | "ONBOARDING_STARTED"
  | "ONBOARDING_COMPLETED"
  | "CLERK_METADATA_SYNC_FAILED"
  | "LOGIN_FAILED"
  | "MFA_VERIFIED"
  | "SESSION_REVOKED";

export type AuditLogger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
  ) => void;
};

const CLASS_A_B_RESTRICTED_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "session",
  "accountNumber",
  "bankAccount",
  "iban",
  "cvv",
  "otp",
  "ssn",
  "email",
  "phone",
  "mobile",
  "address",
  "nationalId",
  "idNumber",
  "licenseNumber",
  "kraPin",
]);

export function sanitizeAuditEventDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (!CLASS_A_B_RESTRICTED_KEYS.has(key) && value !== undefined) {
      if (typeof value === "string") {
        sanitized[key] = value.slice(0, 128); // Cap string length to prevent overflow
      } else if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        sanitized[key] = value;
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function recordSecurityAuditEvent(params: {
  eventType: SecurityAuditEventType;
  userId?: string;
  clerkId?: string;
  role?: string;
  status?: string;
  correlationId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  logger?: AuditLogger;
}): {
  eventType: SecurityAuditEventType;
  timestamp: string;
  clerkIdHash?: string;
  correlationId?: string;
} {
  const logger: AuditLogger = params.logger ?? {
    info: (msg, ctx) => console.info(msg, ctx),
    warn: (msg, ctx) => console.warn(msg, ctx),
    error: (msg, err, ctx) => console.error(msg, err, ctx),
  };

  const timestamp = new Date().toISOString();
  const sanitizedDetails = sanitizeAuditEventDetails(params.details);

  const payload = {
    event: "security_audit",
    eventType: params.eventType,
    timestamp,
    hasUserId: Boolean(params.userId),
    hasClerkId: Boolean(params.clerkId),
    role: params.role ?? "anonymous",
    status: params.status,
    correlationId: params.correlationId,
    reason: params.reason,
    ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
  };

  if (params.eventType === "CLERK_METADATA_SYNC_FAILED") {
    logger.error(
      `Security Audit: ${params.eventType}`,
      new Error(params.reason ?? params.eventType),
      payload,
    );
  } else if (params.eventType === "LOGIN_FAILED") {
    logger.warn(`Security Audit: ${params.eventType}`, payload);
  } else {
    logger.info(`Security Audit: ${params.eventType}`, payload);
  }

  return {
    eventType: params.eventType,
    timestamp,
    correlationId: params.correlationId,
  };
}
