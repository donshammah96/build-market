"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingFormSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.shippingFormSchema = zod_1.default.object({
    name: zod_1.default.string().min(1, "Name is required!"),
    email: zod_1.default
        .string()
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
        .min(1, "Email is required!"),
    phone: zod_1.default
        .string()
        .min(7, "Phone number must be between 7 and 10 digits!")
        .max(10, "Phone number must be between 7 and 10 digits!")
        .regex(/^\d+$/, "Phone number must contain only numbers!"),
    address: zod_1.default.string().min(1, "Address is required!"),
    city: zod_1.default.string().min(1, "City is required!"),
});
