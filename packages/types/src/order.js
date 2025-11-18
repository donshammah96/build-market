"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSchema = exports.OrderSchema = exports.OrderItemSchema = exports.OrderStatusSchema = void 0;
const zod_1 = require("zod");
exports.OrderStatusSchema = zod_1.z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']);
exports.OrderItemSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid().optional(),
    serviceId: zod_1.z.string().uuid().optional(),
    quantity: zod_1.z.number().int().positive('Quantity must be positive'),
    price: zod_1.z.number().nonnegative('Price must be non-negative'),
}).refine((data) => data.productId || data.serviceId, { message: 'Either productId or serviceId must be provided' });
exports.OrderSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    clientId: zod_1.z.string().uuid(),
    storeId: zod_1.z.string().uuid().optional(),
    professionalId: zod_1.z.string().uuid().optional(),
    items: zod_1.z.array(exports.OrderItemSchema),
    totalAmount: zod_1.z.number().nonnegative('Total amount must be non-negative'),
    status: exports.OrderStatusSchema,
    paymentMethod: zod_1.z.string().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.PaymentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().nonnegative('Amount must be non-negative'),
    transactionId: zod_1.z.string().min(1, 'Transaction ID is required'),
    status: zod_1.z.enum(['success', 'failed', 'refunded']),
    createdAt: zod_1.z.date(),
});
