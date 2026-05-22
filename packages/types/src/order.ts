import { z } from "zod";

// ========================================================
// ENUMS
// ========================================================

export const OrderStatusEnum = z.enum([
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
]);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const PaymentStatusEnum = z.enum([
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "PENDING",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const PaymentMethodEnum = z.enum([
  "MPESA",
  "BANK_TRANSFER",
  "CARD",
  "WALLET",
  "CASH",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

// ========================================================
// MODELS
// ========================================================

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string(),
  productId: z.string().optional().nullable(),
  name: z.string(),
  price: z.number(), // Decimal in DB
  quantity: z.number().int(),
  snapshotImageUrl: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string(),
  amount: z.number(), // Decimal in DB
  transactionId: z.string(),
  status: PaymentStatusEnum.default("PENDING"),
  createdAt: z.date(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  storeId: z.string().optional().nullable(),
  professionalId: z.string().optional().nullable(),

  totalAmount: z.number(), // Decimal in DB
  status: OrderStatusEnum.default("PENDING"),
  paymentMethod: z.string().optional().nullable(),

  createdAt: z.date(),
  updatedAt: z.date(),

  // Relations
  items: z.array(OrderItemSchema).optional(),
  payments: z.array(PaymentSchema).optional(),
});
export type Order = z.infer<typeof OrderSchema>;
