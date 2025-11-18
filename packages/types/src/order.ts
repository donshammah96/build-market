import { OrderSchemaType } from "@repo/order-db";
import { z } from 'zod';

export type OrderType = OrderSchemaType & {
  _id: string;
};

export type OrderChartType = {
  month: string;
  total: number;
  successful: number;
};

export const OrderStatusSchema = z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']);

export const OrderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().nonnegative('Price must be non-negative'),
}).refine(
  (data) => data.productId || data.serviceId,
  { message: 'Either productId or serviceId must be provided' }
);

export const OrderSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number().nonnegative('Total amount must be non-negative'),
  status: OrderStatusSchema,
  paymentMethod: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().nonnegative('Amount must be non-negative'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  status: z.enum(['success', 'failed', 'refunded']),
  createdAt: z.date(),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
