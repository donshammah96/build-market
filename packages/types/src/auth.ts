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

export type UserRole = "client" | "professional" | "admin";

export const UserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["client", "professional", "admin"]),
  isProfileComplete: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const ClientProfileSchema = z.object({
  userId: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
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

// --- Onboarding Schemas ---

// County enum for ClientProfile (required field)
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

export const ClientOnboardingSchema = z.object({
  role: z.literal("client"),
  // Location fields (county is required for ClientProfile)
  county: CountyEnum,
  city: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  // Project preferences
  projectType: z.string().min(1, "Project type is required"),
  projectLocation: z.string().min(1, "Project location is required"),
  estimatedBudget: z.string().min(1, "Estimated budget is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export const ProfessionalOnboardingSchema = z.object({
  role: z.literal("professional"),
  profession: z.string().min(1, "Profession is required"),
  companyName: z.string().min(1, "Company name is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  yearsExperience: z.number().optional(),
  portfolio: z.string().optional(),
  website: z.string().optional(),
  bio: z.string().optional(),
  certificatesUrls: z.array(z.string()).optional().nullable(),
  idDocumentsUrls: z.array(z.string()).optional().nullable(),
  certificatesPending: z.boolean().optional(),
  idPending: z.boolean().optional(),
});

// Store Category enum matching Prisma schema
export const StoreCategoryEnum = z.enum([
  "hardware",
  "building_materials",
  "tiles_and_ceramics",
  "electrical",
  "plumbing",
  "paints_and_finishes",
  "roofing",
  "timber_and_wood",
  "glass_and_aluminum",
  "kitchen_and_bath",
  "landscaping",
  "steel_and_metals",
  "safety_and_tools",
  "hvac",
  "cement_and_aggregates",
  "stone_and_masonry",
  "doors_and_windows",
  "lighting_and_fixtures",
  "ceilings_and_drywall",
  "flooring",
  "solar_and_energy",
  "security_and_automation",
  "water_storage_and_pumps",
  "water_treatment_and_filtration",
  "water_distribution_and_piping",
  "interior_design",
  "outdoor_living",
  "pool_and_spa",
  "fireplaces_and_chimneys",
  "barbecue_and_outdoor_kitchens",
  "garden_and_landscaping",
  "patio_and_outdoor_furniture",
  "outdoor_lighting",
  "outdoor_audio",
  "smart_home_and_automation",
  "security_and_surveillance",
  "energy_efficient_solutions",
  "green_building_materials",
  "outdoor_security",
]);

// Store Type enum matching Prisma schema
export const StoreTypeEnum = z.enum([
  "retail",
  "wholesale",
  "manufacturer",
  "distributor",
  "online_only",
]);

export const StoreOnboardingSchema = z.object({
  role: z.literal("professional"),
  // Required fields matching Store model
  name: z.string().min(1, "Store name is required").max(100),
  address: z.string().min(1, "Store address is required"),
  city: z.string().min(1, "Store city is required"),
  county: CountyEnum,
  categories: z.array(StoreCategoryEnum).min(1, "Select at least one category"),
  storeType: StoreTypeEnum,
  // Optional fields
  description: z.string().max(1000).optional(),
  zipCode: z.string().max(20).optional(),
  images: z.array(z.string().url()).optional(),
});

// Property Type enum matching Prisma schema
export const PropertyTypeEnum = z.enum(["SALE", "RENT", "LEASE"]);

// Property Category enum matching Prisma schema
export const PropertyCategoryEnum = z.enum([
  "RESIDENTIAL",
  "COMMERCIAL",
  "LAND",
  "INDUSTRIAL",
]);

// Property Attachment Type enum (property verification documents)
export const PropertyAttachmentTypeEnum = z.enum([
  "TITLE_DEED", // Proof of ownership
  "OFFICIAL_SEARCH", // Land registry search certificate
  "MANDATE_LETTER", // Agent authorization letter
]);

// Property attachment schema for onboarding
export const PropertyAttachmentSchema = z.object({
  fileUrl: z.string().url("File URL must be a valid URL"),
  type: PropertyAttachmentTypeEnum,
  notes: z.string().max(500).optional(),
});

export const PropertyOnboardingSchema = z.object({
  role: z.literal("professional"),
  // Required fields matching Property model
  title: z.string().min(1, "Property title is required").max(200),
  price: z.number().positive("Price must be a positive number"),
  type: PropertyTypeEnum,
  category: PropertyCategoryEnum,
  county: CountyEnum,
  location: z.string().min(1, "Location is required").max(100),
  images: z
    .array(z.object({ value: z.string().url().startsWith("https://") }))
    .min(1)
    .transform((arr) => arr.map((o) => o.value)),
  // Optional fields
  description: z.string().max(5000).optional(),
  currency: z.string().max(3).optional(), // Defaults to "KES" in Prisma schema
  constituency: z.string().max(100).optional(),
  neighbourhood: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  areaSqFt: z.number().positive().optional(),
  lotSize: z.number().positive().optional(),
  lrNumber: z.string().max(100).optional(), // Land Reference Number
  floorPlan: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  features: z.array(z.string()).optional(),
  // Property verification attachments
  attachments: z.array(PropertyAttachmentSchema).optional(),
});

export type ProfessionalOnboardingData = z.infer<
  typeof ProfessionalOnboardingSchema
>;

export type StoreOnboardingData = z.infer<typeof StoreOnboardingSchema>;

export type PropertyAttachmentData = z.infer<typeof PropertyAttachmentSchema>;

export type PropertyOnboardingData = z.infer<typeof PropertyOnboardingSchema>;

export const OnboardingSchema = z.discriminatedUnion("role", [
  ClientOnboardingSchema,
  ProfessionalOnboardingSchema,
  StoreOnboardingSchema,
  PropertyOnboardingSchema,
]);

export type OnboardingData = z.infer<typeof OnboardingSchema>;
