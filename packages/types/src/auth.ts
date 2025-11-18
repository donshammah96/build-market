import z from "zod";

export interface CustomJwtSessionClaims {
  metadata?: {
    role?: "user" | "admin";
  };
}

export const UserFormSchema = z.object({
  firstName: z
    .string({ message: "First name is required!" })
    .min(2, { message: "First name must be at least 2 characters!" })
    .max(50),
  lastName: z
    .string({ message: "Last name is required!" })
    .min(2, { message: "Last name must be at least 2 characters!" })
    .max(50),
  username: z
    .string({ message: "Username is required!" })
    .min(2, { message: "Username must be at least 2 characters!" })
    .max(50),
  emailAddress: z.array(z.string({ message: "Email address is required!" })),
  password: z
    .string({ message: "Password is required!" })
    .min(8, { message: "Password must be at least 8 characters!" })
    .max(50),
});

export type UserRole = 'client' | 'professional' | 'admin';

export const UserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['client', 'professional', 'admin']),
  isProfileComplete: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const ClientProfileSchema = z.object({
  userId: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  preferences: z.any().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ClientProfile = z.infer<typeof ClientProfileSchema>;

export const ProfessionalProfileSchema = z.object({
  userId: z.string(),
  companyName: z.string(),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().optional(),
  servicesOffered: z.array(z.string()).optional(),
  portfolioUrl: z.string().optional(),
  bio: z.string().optional(),
  verified: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;