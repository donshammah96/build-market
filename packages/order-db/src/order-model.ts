import mongoose, { InferSchemaType, model } from "mongoose";
const { Schema } = mongoose;
import { z } from 'zod';

export interface Order {
    id: string; // UUID
    clientId: string;
    storeId?: string;
    professionalId?: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus;
    paymentMethod?: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface OrderItem {
    productId?: string;
    serviceId?: string;
    quantity: number;
    price: number;
  }

// export const OrderStatus = ["success", "failed"] as const;
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export const OrderItemSchema = z.object({
    productId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    quantity: z.number().int().positive('Quantity must be positive'),
    price: z.number().nonnegative('Price must be non-negative'),
  }).refine(
    (data) => data.productId || data.serviceId,
    { message: 'Either productId or serviceId must be provided' }
  );

const OrderSchema = new Schema(
  {
    id: { type: String, required: true },
    clientId: { type: String, required: true },
    storeId: { type: String, required: false },
    professionalId: { type: String, required: false },
    items: {
      type: [
        {
          productId: { type: String, required: false },
          serviceId: { type: String, required: false },
          quantity: { type: Number, required: true },
          price: { type: Number, required: true },
        },
      ],
      required: true,
    },
    email: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, required: true, enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] },
    paymentMethod: { type: String, required: false },
    projects: {
      type: [
        {
          projectName: { type: String, required: true },
          price: { type: Number, required: true },
        },
      ],
      required: true,
    },
  },
  { timestamps: true }
);

export const PaymentSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    amount: z.number().nonnegative('Amount must be non-negative'),
    transactionId: z.string().min(1, 'Transaction ID is required'),
    status: z.enum(['success', 'failed', 'refunded']),
    createdAt: z.date(),
  });

export type OrderSchemaType = InferSchemaType<typeof OrderSchema>;

export const Order = model<OrderSchemaType>("Order", OrderSchema);
