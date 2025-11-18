"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResultSchema = exports.SearchQuerySchema = void 0;
const zod_1 = require("zod");
exports.SearchQuerySchema = zod_1.z.object({
    keywords: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    minRating: zod_1.z.number().int().min(1).max(5).optional(),
});
exports.SearchResultSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.unknown()), // Generic; refine per use case
    total: zod_1.z.number().int().nonnegative(),
    page: zod_1.z.number().int().positive(),
    pageSize: zod_1.z.number().int().positive(),
});
