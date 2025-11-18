import { z } from 'zod';

export const PortfolioSchema = z.object({
  id: z.string().uuid(),
  professionalId: z.string().uuid(),
  title: z.string().min(1, 'Portfolio title is required'),
  description: z.string().optional(),
  images: z.array(z.string().url()),
  projectType: z.string().min(1, 'Project type is required'),
  clientTestimonial: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
