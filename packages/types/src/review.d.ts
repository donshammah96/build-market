import { z } from 'zod';
export declare const ReviewSchema: z.ZodObject<{
    id: z.ZodString;
    reviewerId: z.ZodString;
    reviewedId: z.ZodString;
    type: z.ZodEnum<{
        professional: "professional";
        store: "store";
    }>;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    approved: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const RatingAggregateSchema: z.ZodObject<{
    average: z.ZodNumber;
    count: z.ZodNumber;
    distribution: z.ZodRecord<z.ZodNumber, z.ZodNumber>;
}, z.core.$strip>;
export type Review = z.infer<typeof ReviewSchema>;
export type RatingAggregate = z.infer<typeof RatingAggregateSchema>;
//# sourceMappingURL=review.d.ts.map