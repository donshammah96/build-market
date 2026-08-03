/**
 * Audit and Compliance domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// AuditSeverity
// -------------------------------------------------------------------------

export const AUDIT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  INFO: "Information",
  WARNING: "Warning",
  CRITICAL: "Critical",
};

export function isAuditSeverity(value: unknown): value is AuditSeverity {
  return (
    typeof value === "string" &&
    (AUDIT_SEVERITIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AuditStatus
// -------------------------------------------------------------------------

export const AUDIT_STATUSES = ["SUCCESS", "FAILURE", "DENIED"] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  SUCCESS: "Success",
  FAILURE: "Failure",
  DENIED: "Denied",
};

export function isAuditStatus(value: unknown): value is AuditStatus {
  return (
    typeof value === "string" &&
    (AUDIT_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ConsentType
// -------------------------------------------------------------------------

export const CONSENT_TYPES = [
  "TERMS_OF_SERVICE",
  "PRIVACY_POLICY",
  "MARKETING_EMAIL",
  "MARKETING_SMS",
  "ANALYTICS_COOKIES",
  "LOCATION_TRACKING",
  "KRA_DATA_SHARING",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  TERMS_OF_SERVICE: "Terms of Service",
  PRIVACY_POLICY: "Privacy Policy",
  MARKETING_EMAIL: "Marketing Email",
  MARKETING_SMS: "Marketing SMS",
  ANALYTICS_COOKIES: "Analytics Cookies",
  LOCATION_TRACKING: "Location Tracking",
  KRA_DATA_SHARING: "KRA Data Sharing",
};

export function isConsentType(value: unknown): value is ConsentType {
  return (
    typeof value === "string" &&
    (CONSENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ActorType
// -------------------------------------------------------------------------

export const ACTOR_TYPES = ["USER", "ADMIN", "SYSTEM", "API_KEY"] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  USER: "User",
  ADMIN: "Admin",
  SYSTEM: "System",
  API_KEY: "API Key",
};

export function isActorType(value: unknown): value is ActorType {
  return (
    typeof value === "string" &&
    (ACTOR_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AuditAction
// -------------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  "PROFILE_UPDATED",
  "DATA_EXPORT_REQUESTED",
  "DATA_EXPORT_DOWNLOADED",
  "DATA_RECTIFIED",
  "DATA_EXPORT_EXPIRED",
  "DATA_RETENTION_ENFORCED",
  "DATA_RETENTION_FAILED",
  "ASSET_CLEANUP_COMPLETED",
  "ASSET_CLEANUP_FAILED",
  "ANONYMIZATION_BATCH_COMPLETED",
  "ANONYMIZATION_BATCH_FAILED",
  "ACCOUNT_DEACTIVATED",
  "ACCOUNT_ANONYMIZED",
  "CONSENT_GRANTED",
  "CONSENT_WITHDRAWN",
  "DATA_ACCESS_BY_ADMIN",
  "SUSPENSION_APPLIED",
  "DELETION_OVERRIDE",
  "RETENTION_POLICY_ENFORCED",
  "AUTO_ANONYMIZATION_EXECUTED",
  "BREACH_NOTIFICATION_SENT",
  "EVIDENCE_VIEWED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  PROFILE_UPDATED: "Profile Updated",
  DATA_EXPORT_REQUESTED: "Data Export Requested",
  DATA_EXPORT_DOWNLOADED: "Data Export Downloaded",
  DATA_RECTIFIED: "Data Rectified",
  DATA_EXPORT_EXPIRED: "Data Export Expired",
  DATA_RETENTION_ENFORCED: "Data Retention Enforced",
  DATA_RETENTION_FAILED: "Data Retention Failed",
  ASSET_CLEANUP_COMPLETED: "Asset Cleanup Completed",
  ASSET_CLEANUP_FAILED: "Asset Cleanup Failed",
  ANONYMIZATION_BATCH_COMPLETED: "Anonymization Batch Completed",
  ANONYMIZATION_BATCH_FAILED: "Anonymization Batch Failed",
  ACCOUNT_DEACTIVATED: "Account Deactivated",
  ACCOUNT_ANONYMIZED: "Account Anonymized",
  CONSENT_GRANTED: "Consent Granted",
  CONSENT_WITHDRAWN: "Consent Withdrawn",
  DATA_ACCESS_BY_ADMIN: "Data Access by Admin",
  SUSPENSION_APPLIED: "Suspension Applied",
  DELETION_OVERRIDE: "Deletion Override",
  RETENTION_POLICY_ENFORCED: "Retention Policy Enforced",
  AUTO_ANONYMIZATION_EXECUTED: "Auto Anonymization Executed",
  BREACH_NOTIFICATION_SENT: "Breach Notification Sent",
  EVIDENCE_VIEWED: "Evidence Viewed",
};

export function isAuditAction(value: unknown): value is AuditAction {
  return (
    typeof value === "string" &&
    (AUDIT_ACTIONS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// LegalBasis
// -------------------------------------------------------------------------

export const LEGAL_BASES = [
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_INTEREST",
  "LEGITIMATE_INTEREST",
  "GDPR_ARTICLE_16",
] as const;

export type LegalBasis = (typeof LEGAL_BASES)[number];

export const LEGAL_BASIS_LABELS: Record<LegalBasis, string> = {
  CONSENT: "Consent",
  CONTRACT: "Contract",
  LEGAL_OBLIGATION: "Legal Obligation",
  VITAL_INTERESTS: "Vital Interests",
  PUBLIC_INTEREST: "Public Interest",
  LEGITIMATE_INTEREST: "Legitimate Interest",
  GDPR_ARTICLE_16: "GDPR Article 16",
};

export function isLegalBasis(value: unknown): value is LegalBasis {
  return (
    typeof value === "string" &&
    (LEGAL_BASES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ExportStatus
// -------------------------------------------------------------------------

export const EXPORT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "CANCELLED",
  "READY",
  "EXPIRED",
  "DOWNLOADED",
  "FAILED",
] as const;

export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const EXPORT_STATUS_LABELS: Record<ExportStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  CANCELLED: "Cancelled",
  READY: "Ready",
  EXPIRED: "Expired",
  DOWNLOADED: "Downloaded",
  FAILED: "Failed",
};

export function isExportStatus(value: unknown): value is ExportStatus {
  return (
    typeof value === "string" &&
    (EXPORT_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// IncidentSeverity
// -------------------------------------------------------------------------

export const INCIDENT_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return (
    typeof value === "string" &&
    (INCIDENT_SEVERITIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// IncidentType
// -------------------------------------------------------------------------

export const INCIDENT_TYPES = [
  "DATA_LEAK",
  "UNAUTHORIZED_ACCESS",
  "RANSOMWARE",
  "PHISHING",
  "INTERNAL_THREAT",
  "OTHER",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  DATA_LEAK: "Data Leak",
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  RANSOMWARE: "Ransomware",
  PHISHING: "Phishing",
  INTERNAL_THREAT: "Internal Threat",
  OTHER: "Other",
};

export function isIncidentType(value: unknown): value is IncidentType {
  return (
    typeof value === "string" &&
    (INCIDENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// DataClass
// -------------------------------------------------------------------------

export const DATA_CLASSES = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
  "PII",
  "FINANCIAL",
] as const;

export type DataClass = (typeof DATA_CLASSES)[number];

export const DATA_CLASS_LABELS: Record<DataClass, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  PII: "PII (Personally Identifiable Information)",
  FINANCIAL: "Financial",
};

export function isDataClass(value: unknown): value is DataClass {
  return (
    typeof value === "string" &&
    (DATA_CLASSES as readonly string[]).includes(value)
  );
}
