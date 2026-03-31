/**
 * Calendar Event Types
 *
 * Zod schemas aligned with Prisma CalendarEvent model.
 */
import { z } from "zod";

export const CalendarEventTypeEnum = z.enum([
  "MEETING",
  "SITE_VISIT",
  "DEADLINE",
  "PAYMENT_DUE",
  "MATERIAL_DELIVERY",
  "INSPECTION_NCA",
  "INSPECTION_INTERNAL",
]);
export type CalendarEventType = z.infer<typeof CalendarEventTypeEnum>;

export const CalendarEventStatusEnum = z.enum([
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
]);
export type CalendarEventStatus = z.infer<typeof CalendarEventStatusEnum>;
