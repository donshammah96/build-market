/**
 * Communication and Notification domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// ReviewType
// -------------------------------------------------------------------------

export const REVIEW_TYPES = ["PROFESSIONAL", "STORE"] as const;

export type ReviewType = (typeof REVIEW_TYPES)[number];

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  PROFESSIONAL: "Professional",
  STORE: "Store",
};

export function isReviewType(value: unknown): value is ReviewType {
  return (
    typeof value === "string" &&
    (REVIEW_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ReviewStatus
// -------------------------------------------------------------------------

export const REVIEW_STATUSES = [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "DISPUTED",
  "ARCHIVED",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Pending",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  DISPUTED: "Disputed",
  ARCHIVED: "Archived",
};

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// MessageType
// -------------------------------------------------------------------------

export const MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "FILE",
  "PDF",
  "SYSTEM",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  TEXT: "Text",
  IMAGE: "Image",
  FILE: "File",
  PDF: "PDF",
  SYSTEM: "System",
};

export function isMessageType(value: unknown): value is MessageType {
  return (
    typeof value === "string" &&
    (MESSAGE_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ThreadType
// -------------------------------------------------------------------------

export const THREAD_TYPES = ["DIRECT", "GROUP", "PROJECT", "SUPPORT"] as const;

export type ThreadType = (typeof THREAD_TYPES)[number];

export const THREAD_TYPE_LABELS: Record<ThreadType, string> = {
  DIRECT: "Direct",
  GROUP: "Group",
  PROJECT: "Project",
  SUPPORT: "Support",
};

export function isThreadType(value: unknown): value is ThreadType {
  return (
    typeof value === "string" &&
    (THREAD_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ParticipantRole
// -------------------------------------------------------------------------

export const PARTICIPANT_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function isParticipantRole(value: unknown): value is ParticipantRole {
  return (
    typeof value === "string" &&
    (PARTICIPANT_ROLES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// NotificationType
// -------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  "INFO",
  "ALERT",
  "SUCCESS",
  "WARNING",
  "ERROR",
  "PAYMENT",
  "MESSAGE",
  "PROJECT",
  "LEAD",
  "SECURITY",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  INFO: "Info",
  ALERT: "Alert",
  SUCCESS: "Success",
  WARNING: "Warning",
  ERROR: "Error",
  PAYMENT: "Payment",
  MESSAGE: "Message",
  PROJECT: "Project",
  LEAD: "Lead",
  SECURITY: "Security",
  SYSTEM: "System",
};

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === "string" &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// NotificationChannel
// -------------------------------------------------------------------------

export const NOTIFICATION_CHANNELS = [
  "IN_APP",
  "EMAIL",
  "SMS",
  "PUSH",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> =
  {
    IN_APP: "In-App",
    EMAIL: "Email",
    SMS: "SMS",
    PUSH: "Push Notification",
  };

export function isNotificationChannel(
  value: unknown,
): value is NotificationChannel {
  return (
    typeof value === "string" &&
    (NOTIFICATION_CHANNELS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// NotificationPriority
// -------------------------------------------------------------------------

export const NOTIFICATION_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_PRIORITY_LABELS: Record<
  NotificationPriority,
  string
> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function isNotificationPriority(
  value: unknown,
): value is NotificationPriority {
  return (
    typeof value === "string" &&
    (NOTIFICATION_PRIORITIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// NotificationDeliveryStatus
// -------------------------------------------------------------------------

export const NOTIFICATION_DELIVERY_STATUSES = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
] as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_DELIVERY_STATUS_LABELS: Record<
  NotificationDeliveryStatus,
  string
> = {
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

export function isNotificationDeliveryStatus(
  value: unknown,
): value is NotificationDeliveryStatus {
  return (
    typeof value === "string" &&
    (NOTIFICATION_DELIVERY_STATUSES as readonly string[]).includes(value)
  );
}
