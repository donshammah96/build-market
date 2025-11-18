import { z } from 'zod';

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  reviewerId: z.string().uuid(),
  reviewedId: z.string().uuid(),
  type: z.enum(['professional', 'store']),
  rating: z.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  comment: z.string().optional(),
  approved: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RatingAggregateSchema = z.object({
  average: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  distribution: z.record(z.number().int().min(1).max(5), z.number().int().nonnegative()),
});

export type Review = z.infer<typeof ReviewSchema>;
export type RatingAggregate = z.infer<typeof RatingAggregateSchema>;
