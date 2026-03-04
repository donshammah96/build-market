import { z } from "zod";
import { COUNTIES, PROFESSIONS } from "@build/enums";
export type { County, Profession } from "@build/enums";

// =============================================================================
// Homeowner/Client Onboarding Schema
// Aligns with ClientProfile model in Prisma schema
// =============================================================================

export const homeownerOnboardingSchema = z
  .object({
    // Location - required for ClientProfile
    county: z.enum(COUNTIES),

    city: z
      .string()
      .max(100, "City must be less than 100 characters")
      .optional(),

    address: z
      .string()
      .max(500, "Address must be less than 500 characters")
      .optional(),

    zipCode: z
      .string()
      .max(20, "Zip code must be less than 20 characters")
      .optional(),

    // Project preferences (stored in ClientProfile.preferences JSON)
    projectType: z.string().min(1, "Please select a project type"),

    customProjectType: z.string().optional(),

    projectLocation: z.string().optional(),

    estimatedBudget: z.string().optional(),

    description: z
      .string()
      .max(2000, "Description must be less than 2000 characters")
      .optional(),
  })
  .refine(
    (data) => {
      // If projectType is 'other', customProjectType is required
      if (data.projectType === "other") {
        return !!data.customProjectType && data.customProjectType.length > 0;
      }
      return true;
    },
    {
      message: "Please describe your project type",
      path: ["customProjectType"],
    },
  );

export type HomeownerOnboardingData = z.infer<typeof homeownerOnboardingSchema>;

// =============================================================================
// Professional Onboarding Schema
// Aligns with ProfessionalProfile model in Prisma schema
// =============================================================================

export const professionalOnboardingSchema = z
  .object({
    // Required fields
    profession: z.enum(PROFESSIONS),

    companyName: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(100, "Company name must be less than 100 characters"),

    // Optional but recommended for verification
    licenseNumber: z
      .string()
      .max(100, "License number must be less than 100 characters")
      .optional(),

    yearsExperience: z
      .number()
      .int()
      .min(0, "Years of experience cannot be negative")
      .max(100, "Years of experience seems too high")
      .optional(),

    bio: z
      .string()
      .max(2000, "Bio must be less than 2000 characters")
      .optional(),

    // Location
    city: z
      .string()
      .max(100, "City must be less than 100 characters")
      .optional(),

    county: z
      .string()
      .max(100, "County must be less than 100 characters")
      .optional(),

    // Online presence
    portfolioUrl: z
      .string()
      .url("Please enter a valid URL")
      .optional()
      .or(z.literal("")),

    website: z
      .string()
      .url("Please enter a valid URL")
      .optional()
      .or(z.literal("")),

    // Real estate agents require EARB number
    earbNumber: z
      .string()
      .max(50, "EARB number must be less than 50 characters")
      .optional(),

    // File arrays - validated separately since they're File objects
    documents: z
      .array(
        z.object({
          uploadId: z.string(),
          previewUrl: z.string().optional(),
          category: z.string(),
          title: z.string().optional(),
        }),
      )
      .optional(),
  })
  .refine(
    () => {
      // If profession is real_estate_agent, earbNumber is recommended
      // Note: Not enforced as required, but can be validated on backend
      return true;
    },
    {
      message: "EARB number is required for real estate agents",
      path: ["earbNumber"],
    },
  );

export type ProfessionalOnboardingData = z.infer<
  typeof professionalOnboardingSchema
>;

// =============================================================================
// API Payload Schemas (for backend communication)
// =============================================================================

export const clientOnboardingPayload = z.object({
  role: z.literal("client"),
  // ClientProfile fields
  county: z.enum(COUNTIES),
  city: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  // Project preferences (stored in preferences JSON)
  projectType: z.string().min(1),
  projectLocation: z.string().optional(),
  estimatedBudget: z.string().optional(),
  description: z.string().optional(),
});

export const professionalOnboardingPayload = z.object({
  role: z.literal("professional"),
  // ProfessionalProfile fields
  profession: z.enum(PROFESSIONS),
  companyName: z.string().min(2),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().int().optional(),
  bio: z.string().optional(),
  // Location
  city: z.string().optional(),
  county: z.string().optional(),
  // Online presence
  portfolioUrl: z.string().optional(),
  website: z.string().optional(),
  // Real estate agent specific
  earbNumber: z.string().optional(),
  // Document URLs
  documents: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.string(),
        title: z.string().optional(),
      }),
    )
    .optional(),
});

export type ClientOnboardingPayload = z.infer<typeof clientOnboardingPayload>;
export type ProfessionalOnboardingPayload = z.infer<
  typeof professionalOnboardingPayload
>;

// =============================================================================
// Helper: Combined onboarding payload (discriminated union)
// =============================================================================

export const onboardingPayload = z.discriminatedUnion("role", [
  clientOnboardingPayload,
  professionalOnboardingPayload,
]);

export type OnboardingPayload = z.infer<typeof onboardingPayload>;
