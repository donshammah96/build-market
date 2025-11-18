"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfessionalProfileSchema = exports.ClientProfileSchema = exports.UserSchema = exports.UserFormSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.UserFormSchema = zod_1.default.object({
    firstName: zod_1.default
        .string({ message: "First name is required!" })
        .min(2, { message: "First name must be at least 2 characters!" })
        .max(50),
    lastName: zod_1.default
        .string({ message: "Last name is required!" })
        .min(2, { message: "Last name must be at least 2 characters!" })
        .max(50),
    username: zod_1.default
        .string({ message: "Username is required!" })
        .min(2, { message: "Username must be at least 2 characters!" })
        .max(50),
    emailAddress: zod_1.default.array(zod_1.default.string({ message: "Email address is required!" })),
    password: zod_1.default
        .string({ message: "Password is required!" })
        .min(8, { message: "Password must be at least 8 characters!" })
        .max(50),
});
exports.UserSchema = zod_1.default.object({
    id: zod_1.default.string(),
    clerkId: zod_1.default.string(),
    email: zod_1.default.string(),
    firstName: zod_1.default.string().optional(),
    lastName: zod_1.default.string().optional(),
    phone: zod_1.default.string().optional(),
    role: zod_1.default.enum(['client', 'professional', 'admin']),
    isProfileComplete: zod_1.default.boolean(),
    createdAt: zod_1.default.date(),
    updatedAt: zod_1.default.date(),
});
exports.ClientProfileSchema = zod_1.default.object({
    userId: zod_1.default.string(),
    address: zod_1.default.string().optional(),
    city: zod_1.default.string().optional(),
    state: zod_1.default.string().optional(),
    zipCode: zod_1.default.string().optional(),
    preferences: zod_1.default.any().optional(),
    createdAt: zod_1.default.date().optional(),
    updatedAt: zod_1.default.date().optional(),
});
exports.ProfessionalProfileSchema = zod_1.default.object({
    userId: zod_1.default.string(),
    companyName: zod_1.default.string(),
    licenseNumber: zod_1.default.string().optional(),
    yearsExperience: zod_1.default.number().optional(),
    servicesOffered: zod_1.default.array(zod_1.default.string()).optional(),
    portfolioUrl: zod_1.default.string().optional(),
    bio: zod_1.default.string().optional(),
    verified: zod_1.default.boolean(),
    createdAt: zod_1.default.date().optional(),
    updatedAt: zod_1.default.date().optional(),
});
