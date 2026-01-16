import { z } from "zod";

// =============================================================================
// Enums - Must match Prisma schema enums
// =============================================================================

// County enum - matches Prisma County (required for ClientProfile)
export const CountyEnum = z.enum([
  "MOMBASA",
  "KWALE",
  "KILIFI",
  "TANA_RIVER",
  "LAMU",
  "TAITA_TAVETA",
  "GARISSA",
  "WAJIR",
  "MANDERA",
  "MARSABIT",
  "ISIOLO",
  "MERU",
  "THARAKA_NITHI",
  "EMBU",
  "KITUI",
  "MACHAKOS",
  "MAKUENI",
  "NYANDARUA",
  "NYERI",
  "KIRINYAGA",
  "MURANGA",
  "KIAMBU",
  "TURKANA",
  "WEST_POKOT",
  "SAMBURU",
  "TRANS_NZOIA",
  "UASIN_GISHU",
  "ELGEYO_MARAKWET",
  "NANDI",
  "BARINGO",
  "LAIKIPIA",
  "NAKURU",
  "NAROK",
  "KAJIADO",
  "KERICHO",
  "BOMET",
  "KAKAMEGA",
  "VIHIGA",
  "BUNGOMA",
  "BUSIA",
  "SIAYA",
  "KISUMU",
  "HOMA_BAY",
  "MIGORI",
  "KISII",
  "NYAMIRA",
  "NAIROBI",
]);

// Profession enum - matches Prisma Profession
export const ProfessionEnum = z.enum([
  // Architecture & Design
  "architect",
  "interior_designer",
  "landscape_architect",
  "urban_planner",
  "draftsman",
  // Engineering
  "structural_engineer",
  "civil_engineer",
  "mechanical_engineer",
  "electrical_engineer",
  "geotechnical_engineer",
  "environmental_engineer",
  "water_engineer",
  // Construction Management
  "construction_manager",
  "project_manager",
  "site_supervisor",
  "quantity_surveyor",
  "estimator",
  "clerk_of_works",
  // Contractors
  "contractor",
  "building_contractor",
  "roofing_contractor",
  "flooring_contractor",
  "painting_contractor",
  "demolition_contractor",
  // Specialized Trades
  "plumber",
  "electrician",
  "hvac_technician",
  "mason",
  "carpenter",
  "welder",
  "glazier",
  "tiler",
  "plasterer",
  "waterproofing_specialist",
  "painter",
  "roofer",
  // Real Estate
  "real_estate_agent",
  "realtor",
  "realty_company",
  "property_developer",
  "land_surveyor",
  "property_valuator",
  "surveyor",
  // Specialists
  "solar_installer",
  "pool_builder",
  "landscaper",
  "security_systems",
  "smart_home_specialist",
  "fire_safety_specialist",
  "acoustic_consultant",
  // Suppliers
  "building_materials_supplier",
  "hardware_supplier",
  "sanitary_supplier",
  // Other
  "other",
]);

export type County = z.infer<typeof CountyEnum>;
export type Profession = z.infer<typeof ProfessionEnum>;

// =============================================================================
// Homeowner/Client Onboarding Schema
// Aligns with ClientProfile model in Prisma schema
// =============================================================================

export const homeownerOnboardingSchema = z
  .object({
    // Location - required for ClientProfile
    county: CountyEnum,

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
    }
  );

export type HomeownerOnboardingData = z.infer<typeof homeownerOnboardingSchema>;

// =============================================================================
// Professional Onboarding Schema
// Aligns with ProfessionalProfile model in Prisma schema
// =============================================================================

export const professionalOnboardingSchema = z
  .object({
    // Required fields
    profession: ProfessionEnum,

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
    // These represent the uploaded file URLs after upload
    certificatesUrls: z.array(z.string().url()).optional(),

    idDocumentsUrls: z.array(z.string().url()).optional(),
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
    }
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
  county: CountyEnum,
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
  profession: ProfessionEnum,
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
  certificatesUrls: z.array(z.string()).optional(),
  idDocumentsUrls: z.array(z.string()).optional(),
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
