"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAnalyticsSchema = exports.AnalyticsMetricSchema = void 0;
const zod_1 = require("zod");
exports.AnalyticsMetricSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Metric name is required'),
    value: zod_1.z.number().nonnegative(),
    period: zod_1.z.enum(['day', 'week', 'month']),
});
exports.UserAnalyticsSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    metrics: zod_1.z.array(exports.AnalyticsMetricSchema),
    fromDate: zod_1.z.date(),
    toDate: zod_1.z.date(),
});
