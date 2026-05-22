import { z } from "zod";
import { County, Profession, AvailabilityStatus } from "@prisma/client";

/**
 * Shared validation schemas for Professional Profile API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with ProfessionalProfile + User models in schema.prisma.
 */

export const CountySchema = z.nativeEnum(County);
export const ProfessionSchema = z.nativeEnum(Profession);
export const AvailabilityStatusSchema = z.nativeEnum(AvailabilityStatus);

/** Body schema for PATCH /api/professional-portal/profile */
export const UpdateProfileSchema = z.object({
  // User fields
  firstName: z.string().min(1, "First name is required").max(100).optional(),
  lastName: z.string().min(1, "Last name is required").max(100).optional(),

  // ProfessionalProfile fields
  companyName: z
    .string()
    .min(1, "Company name is required")
    .max(200)
    .optional(),
  profession: ProfessionSchema.optional(),
  bio: z.string().max(5000).optional(),
  portfolioUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),

  // Contact
  businessEmail: z.string().email().optional().or(z.literal("")),
  businessPhone: z.string().max(20).optional().or(z.literal("")),

  // Location
  city: z.string().max(100).optional(),
  county: CountySchema.optional(),

  // Professional info
  yearsExperience: z.number().int().min(0).max(100).optional(),
  availability: AvailabilityStatusSchema.optional(),

  // Payment
  minProjectBudget: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),

  // Service IDs (ProfessionalService relation)
  serviceIds: z.array(z.string().uuid()).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
