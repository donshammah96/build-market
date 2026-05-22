import { z } from "zod";

// ========================================================
// 12. ANALYTICS ENUMS
// ========================================================

export const AnalyticsPeriodEnum = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodEnum>;

export const AnalyticsEntityTypeEnum = z.enum([
  "PROFILE",
  "STORE",
  "PROJECT",
  "PRODUCT",
  "PROPERTY",
]);

export type AnalyticsEntityType = z.infer<typeof AnalyticsEntityTypeEnum>;

export const AnalyticsEventTypeEnum = z.enum([
  "VIEW",
  "CONTACT_CLICK",
  "SEARCH_IMPRESSION",
  "BOOKMARK",
  "SHARE",
]);

export type AnalyticsEventType = z.infer<typeof AnalyticsEventTypeEnum>;

// ========================================================
// MODELS
// ========================================================

export const UserAnalyticsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  entityType: AnalyticsEntityTypeEnum.default("PROFILE"),
  entityId: z.string().optional().nullable(),
  period: AnalyticsPeriodEnum.default("DAILY"),
  startDate: z.date(),
  endDate: z.date(),
  views: z.number().int().default(0),
  uniqueViews: z.number().int().default(0),
  clicks: z.number().int().default(0),
  impressions: z.number().int().default(0),
  revenue: z.number().default(0), // Decimal in Prisma
  metadata: z.any().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;

export const AnalyticsEventSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string(),
  entityType: AnalyticsEntityTypeEnum,
  entityId: z.string().optional().nullable(),
  eventType: AnalyticsEventTypeEnum,
  viewerId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  metadata: z.any().optional().nullable(),
  createdAt: z.date().optional(),
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
