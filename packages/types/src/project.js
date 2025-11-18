"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdeaBookSchema = exports.IdeaBookItemSchema = exports.ProjectMilestoneSchema = exports.ProjectSchema = exports.ProjectStatusSchema = void 0;
const zod_1 = require("zod");
exports.ProjectStatusSchema = zod_1.z.enum(['planning', 'in_progress', 'completed', 'archived']);
exports.ProjectSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    clientId: zod_1.z.string().uuid(),
    professionalId: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string().min(1, 'Project title is required'),
    description: zod_1.z.string().optional(),
    status: exports.ProjectStatusSchema,
    budget: zod_1.z.number().nonnegative().optional(),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.ProjectMilestoneSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1, 'Milestone title is required'),
    description: zod_1.z.string().optional(),
    dueDate: zod_1.z.date().optional(),
    completed: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.IdeaBookItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['image', 'product', 'professional', 'note']),
    url: zod_1.z.string().url().optional(),
    referenceId: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().optional(),
});
exports.IdeaBookSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    clientId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1, 'Idea book title is required'),
    description: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.IdeaBookItemSchema),
    sharedWith: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
