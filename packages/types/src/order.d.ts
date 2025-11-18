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
export declare const OrderStatusSchema: z.ZodEnum<{
    pending: "pending";
    paid: "paid";
    shipped: "shipped";
    delivered: "delivered";
    cancelled: "cancelled";
}>;
export declare const OrderItemSchema: z.ZodObject<{
    productId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    price: z.ZodNumber;
}, z.core.$strip>;
export declare const OrderSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    storeId: z.ZodOptional<z.ZodString>;
    professionalId: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
    }, z.core.$strip>>;
    totalAmount: z.ZodNumber;
    status: z.ZodEnum<{
        pending: "pending";
        paid: "paid";
        shipped: "shipped";
        delivered: "delivered";
        cancelled: "cancelled";
    }>;
    paymentMethod: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const PaymentSchema: z.ZodObject<{
    id: z.ZodString;
    orderId: z.ZodString;
    amount: z.ZodNumber;
    transactionId: z.ZodString;
    status: z.ZodEnum<{
        success: "success";
        failed: "failed";
        refunded: "refunded";
    }>;
    createdAt: z.ZodDate;
}, z.core.$strip>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
//# sourceMappingURL=order.d.ts.map