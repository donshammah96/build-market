import { z } from 'zod';
export declare const AnalyticsMetricSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodNumber;
    period: z.ZodEnum<{
        day: "day";
        week: "week";
        month: "month";
    }>;
}, z.core.$strip>;
export declare const UserAnalyticsSchema: z.ZodObject<{
    userId: z.ZodString;
    metrics: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodNumber;
        period: z.ZodEnum<{
            day: "day";
            week: "week";
            month: "month";
        }>;
    }, z.core.$strip>>;
    fromDate: z.ZodDate;
    toDate: z.ZodDate;
}, z.core.$strip>;
export type AnalyticsMetric = z.infer<typeof AnalyticsMetricSchema>;
export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;
//# sourceMappingURL=analytics.d.ts.map