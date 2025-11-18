"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatingAggregateSchema = exports.ReviewSchema = void 0;
const zod_1 = require("zod");
exports.ReviewSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reviewerId: zod_1.z.string().uuid(),
    reviewedId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['professional', 'store']),
    rating: zod_1.z.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
    comment: zod_1.z.string().optional(),
    approved: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.RatingAggregateSchema = zod_1.z.object({
    average: zod_1.z.number().nonnegative(),
    count: zod_1.z.number().int().nonnegative(),
    distribution: zod_1.z.record(zod_1.z.number().int().min(1).max(5), zod_1.z.number().int().nonnegative()),
});
