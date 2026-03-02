/**
 * Analytics domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// AnalyticsPeriod
// -------------------------------------------------------------------------

export const ANALYTICS_PERIODS = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  return (
    typeof value === "string" &&
    (ANALYTICS_PERIODS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AnalyticsEntityType
// -------------------------------------------------------------------------

export const ANALYTICS_ENTITY_TYPES = [
  "PROFILE",
  "STORE",
  "PROJECT",
  "PRODUCT",
  "PROPERTY",
] as const;

export type AnalyticsEntityType = (typeof ANALYTICS_ENTITY_TYPES)[number];

export const ANALYTICS_ENTITY_TYPE_LABELS: Record<AnalyticsEntityType, string> =
  {
    PROFILE: "Profile",
    STORE: "Store",
    PROJECT: "Project",
    PRODUCT: "Product",
    PROPERTY: "Property",
  };

export function isAnalyticsEntityType(
  value: unknown,
): value is AnalyticsEntityType {
  return (
    typeof value === "string" &&
    (ANALYTICS_ENTITY_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AnalyticsEventType
// -------------------------------------------------------------------------

export const ANALYTICS_EVENT_TYPES = [
  "VIEW",
  "CONTACT_CLICK",
  "SEARCH_IMPRESSION",
  "BOOKMARK",
  "SHARE",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_EVENT_TYPE_LABELS: Record<AnalyticsEventType, string> = {
  VIEW: "View",
  CONTACT_CLICK: "Contact Click",
  SEARCH_IMPRESSION: "Search Impression",
  BOOKMARK: "Bookmark",
  SHARE: "Share",
};

export function isAnalyticsEventType(
  value: unknown,
): value is AnalyticsEventType {
  return (
    typeof value === "string" &&
    (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value)
  );
}
