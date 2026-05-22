/**
 * CRM and Calendar domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// LeadStatus
// -------------------------------------------------------------------------

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  PROPOSAL: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// LeadSource
// -------------------------------------------------------------------------

export const LEAD_SOURCES = [
  "PLATFORM_SEARCH",
  "PROFILE_VIEW",
  "DIRECT_MESSAGE",
  "PHONE_REVEAL",
  "REFERRAL",
  "EXTERNAL_IMPORT",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  PLATFORM_SEARCH: "Platform Search",
  PROFILE_VIEW: "Profile View",
  DIRECT_MESSAGE: "Direct Message",
  PHONE_REVEAL: "Phone Reveal",
  REFERRAL: "Referral",
  EXTERNAL_IMPORT: "External Import",
};

export function isLeadSource(value: unknown): value is LeadSource {
  return (
    typeof value === "string" &&
    (LEAD_SOURCES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// LeadPriority
// -------------------------------------------------------------------------

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function isLeadPriority(value: unknown): value is LeadPriority {
  return (
    typeof value === "string" &&
    (LEAD_PRIORITIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// LostReason
// -------------------------------------------------------------------------

export const LOST_REASONS = [
  "PRICE_TOO_HIGH",
  "GHOSTED",
  "COMPETITOR_WON",
  "TIMELINE_MISMATCH",
  "OUT_OF_SCOPE",
  "OTHER",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  PRICE_TOO_HIGH: "Price Too High",
  GHOSTED: "Ghosted / Unresponsive",
  COMPETITOR_WON: "Competitor Won",
  TIMELINE_MISMATCH: "Timeline Mismatch",
  OUT_OF_SCOPE: "Out of Scope",
  OTHER: "Other",
};

export function isLostReason(value: unknown): value is LostReason {
  return (
    typeof value === "string" &&
    (LOST_REASONS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// CalendarEventType
// -------------------------------------------------------------------------

export const CALENDAR_EVENT_TYPES = [
  "MEETING",
  "SITE_VISIT",
  "DEADLINE",
  "PAYMENT_DUE",
  "MATERIAL_DELIVERY",
  "INSPECTION_NCA",
  "INSPECTION_INTERNAL",
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  MEETING: "Meeting",
  SITE_VISIT: "Site Visit",
  DEADLINE: "Deadline",
  PAYMENT_DUE: "Payment Due",
  MATERIAL_DELIVERY: "Material Delivery",
  INSPECTION_NCA: "NCA Inspection",
  INSPECTION_INTERNAL: "Internal Inspection",
};

export function isCalendarEventType(
  value: unknown,
): value is CalendarEventType {
  return (
    typeof value === "string" &&
    (CALENDAR_EVENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// CalendarEventStatus
// -------------------------------------------------------------------------

export const CALENDAR_EVENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
] as const;

export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_EVENT_STATUS_LABELS: Record<CalendarEventStatus, string> =
  {
    SCHEDULED: "Scheduled",
    CONFIRMED: "Confirmed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    RESCHEDULED: "Rescheduled",
    NO_SHOW: "No Show",
  };

export function isCalendarEventStatus(
  value: unknown,
): value is CalendarEventStatus {
  return (
    typeof value === "string" &&
    (CALENDAR_EVENT_STATUSES as readonly string[]).includes(value)
  );
}
