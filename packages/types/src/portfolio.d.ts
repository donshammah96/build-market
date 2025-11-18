import { z } from 'zod';
export declare const PortfolioSchema: z.ZodObject<{
    id: z.ZodString;
    professionalId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodArray<z.ZodString>;
    projectType: z.ZodString;
    clientTestimonial: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
//# sourceMappingURL=portfolio.d.ts.map