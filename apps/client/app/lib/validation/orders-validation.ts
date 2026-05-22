import { z } from "zod";
import { OrderStatus } from "@prisma/client";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export const OrderStatusSchema = z.nativeEnum(OrderStatus);

export const OrdersQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .optional()
    .default(String(DEFAULT_LIMIT))
    .transform((v) => Math.min(parseInt(v, 10), MAX_LIMIT)),
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .optional()
    .default("1")
    .transform((v) => Math.max(parseInt(v, 10), 1)),
  status: OrderStatusSchema.optional(),
});

export type OrdersQueryInput = z.infer<typeof OrdersQuerySchema>;
