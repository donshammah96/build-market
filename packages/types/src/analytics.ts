
import { z } from 'zod';

export const AnalyticsMetricSchema = z.object({
  name: z.string().min(1, 'Metric name is required'),
  value: z.number().nonnegative(),
  period: z.enum(['day', 'week', 'month']),
});

export const UserAnalyticsSchema = z.object({
  userId: z.string().uuid(),
  metrics: z.array(AnalyticsMetricSchema),
  fromDate: z.date(),
  toDate: z.date(),
});

export type AnalyticsMetric = z.infer<typeof AnalyticsMetricSchema>;
export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;