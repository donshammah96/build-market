"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSchema = exports.StoreSchema = void 0;
const zod_1 = require("zod");
exports.StoreSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1, 'Store name is required'),
    description: zod_1.z.string().optional(),
    address: zod_1.z.string().min(1, 'Address is required'),
    city: zod_1.z.string().min(1, 'City is required'),
    state: zod_1.z.string().min(1, 'State is required'),
    zipCode: zod_1.z.string().min(1, 'Zip code is required'),
    categories: zod_1.z.array(zod_1.z.string()),
    verified: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.ProductSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    storeId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1, 'Product name is required'),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().nonnegative('Price must be non-negative'),
    imageUrl: zod_1.z.string().url().optional(),
    category: zod_1.z.string().min(1, 'Category is required'),
    inStock: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
