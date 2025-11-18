"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioSchema = void 0;
const zod_1 = require("zod");
exports.PortfolioSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    professionalId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1, 'Portfolio title is required'),
    description: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.string().url()),
    projectType: zod_1.z.string().min(1, 'Project type is required'),
    clientTestimonial: zod_1.z.string().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
