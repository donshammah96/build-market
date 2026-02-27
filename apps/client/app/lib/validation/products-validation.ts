import { z } from "zod";

export const TopProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export type TopProductsQueryInput = z.infer<typeof TopProductsQuerySchema>;
