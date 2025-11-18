import { z } from 'zod';

export const ProjectStatusSchema = z.enum(['planning', 'in_progress', 'completed', 'archived']);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  professionalId: z.string().uuid().optional(),
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  status: ProjectStatusSchema,
  budget: z.number().nonnegative().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProjectMilestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Milestone title is required'),
  description: z.string().optional(),
  dueDate: z.date().optional(),
  completed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const IdeaBookItemSchema = z.object({
  type: z.enum(['image', 'product', 'professional', 'note']),
  url: z.string().url().optional(),
  referenceId: z.string().uuid().optional(),
  description: z.string().optional(),
});

export const IdeaBookSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string().min(1, 'Idea book title is required'),
  description: z.string().optional(),
  items: z.array(IdeaBookItemSchema),
  sharedWith: z.array(z.string().uuid()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectMilestone = z.infer<typeof ProjectMilestoneSchema>;
export type IdeaBook = z.infer<typeof IdeaBookSchema>;
export type IdeaBookItem = z.infer<typeof IdeaBookItemSchema>;
