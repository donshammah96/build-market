import z from "zod";
import { professionalLicenseSchema } from "./license";

export interface CustomJwtSessionClaims {
  metadata?: {
    role?: "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SUPPORT";
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

// County enum for ClientProfile (required field)
export const CountyEnum = z.enum([
  "BARINGO",
  "BOMET",
  "BUNGOMA",
  "BUSIA",
  "ELGEYO_MARAKWET",
  "EMBU",
  "GARISSA",
  "HOMA_BAY",
  "ISIOLO",
  "KAJIADO",
  "KAKAMEGA",
  "KERICHO",
  "KIAMBU",
  "KILIFI",
  "KIRINYAGA",
  "KISII",
  "KISUMU",
  "KITUI",
  "KWALE",
  "LAIKIPIA",
  "LAMU",
  "MACHAKOS",
  "MAKUENI",
  "MANDERA",
  "MARSABIT",
  "MERU",
  "MIGORI",
  "MOMBASA",
  "MURANGA",
  "NAIROBI",
  "NAKURU",
  "NANDI",
  "NAROK",
  "NYAMIRA",
  "NYANDARUA",
  "NYERI",
  "SAMBURU",
  "SIAYA",
  "TAITA_TAVETA",
  "TANA_RIVER",
  "THARAKA_NITHI",
  "TRANS_NZOIA",
  "TURKANA",
  "UASIN_GISHU",
  "VIHIGA",
  "WAJIR",
  "WEST_POKOT",
]);

export type UserRole = "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SUPPORT";

export type UserStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "BANNED"
  | "DEACTIVATED"
  | "ARCHIVED";

export const UserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  role: z
    .enum(["CLIENT", "PROFESSIONAL", "ADMIN", "SUPPORT"])
    .default("CLIENT"),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"])
    .default("ACTIVE"),
  isProfileComplete: z.boolean(),
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  termsAcceptedAt: z.date().optional().nullable(),
  termsVersion: z.string().optional().nullable(),
  marketingConsent: z.boolean().default(false),
  lastLoginAt: z.date().optional().nullable(),
  lastActiveAt: z.date().optional().nullable(),
  metadata: z.any().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
});

export type User = z.infer<typeof UserSchema>;

export const ClientTypeEnum = z.enum([
  "HOMEOWNER",
  "CORPORATE_DEVELOPER",
  "INTERIOR_DESIGN_FIRM",
  "GOVERNMENT_ENTITY",
  "OTHER",
]);

export type ClientType = z.infer<typeof ClientTypeEnum>;

export const ClientProfileSchema = z.object({
  userId: z.string(),
  type: ClientTypeEnum.default("HOMEOWNER"),
  companyName: z.string().optional().nullable(),
  companyRegistration: z.string().optional().nullable(), // CR12 number
  kraPin: z.string().optional().nullable(),
  vatRegistered: z.boolean().default(false),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: CountyEnum.optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  location: z.any().optional().nullable(), // GeoJSON Point or {lat, lng}
  interests: z.array(z.string()).default([]),
  budgetRangeMin: z.number().optional().nullable(),
  budgetRangeMax: z.number().optional().nullable(),
  preferences: z.any().optional().nullable(),
  isVerified: z.boolean().default(false),
  verifiedAt: z.date().optional().nullable(),
  loyaltyPoints: z.number().int().default(0),
  membershipTier: z.string().default("STANDARD"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ClientProfile = z.infer<typeof ClientProfileSchema>;

export const ProfessionEnum = z.enum([
  "ARCHITECT",
  "INTERIOR_DESIGNER",
  "LANDSCAPE_ARCHITECT",
  "URBAN_PLANNER",
  "STRUCTURAL_ENGINEER",
  "CIVIL_ENGINEER",
  "MECHANICAL_ENGINEER",
  "ELECTRICAL_ENGINEER",
  "QUANTITY_SURVEYOR",
  "LAND_SURVEYOR",
  "REAL_ESTATE_VALUER",
  "GENERAL_CONTRACTOR",
  "MASON",
  "ELECTRICIAN",
  "PLUMBER",
  "CARPENTER",
  "JOINER",
  "PAINTER",
  "WELDER",
  "GLAZIER",
  "ROOFER",
  "STEEL_FIXER",
  "FLOORING_SPECIALIST",
  "PLASTERER",
  "HVAC_TECHNICIAN",
  "SOLAR_ENERGY_TECHNICIAN",
  "BOREHOLE_DRILLER",
  "CCTV_AND_SECURITY_PRO",
  "INTERNET_AND_NETWORK_PRO",
  "PROJECT_MANAGER",
  "CLERK_OF_WORKS",
  "OTHER",
]);

export type Profession = z.infer<typeof ProfessionEnum>;

export const AvailabilityStatusEnum = z.enum([
  "AVAILABLE",
  "BUSY",
  "UNAVAILABLE",
]);

export type AvailabilityStatus = z.infer<typeof AvailabilityStatusEnum>;

export const VerificationStatusEnum = z.enum([
  "PENDING",
  "IN_REVIEW",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

export const ProfessionalProfileSchema = z.object({
  userId: z.string(),
  companyName: z.string(),
  profession: ProfessionEnum.optional().nullable(),
  slug: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  // Contact (Business)
  businessEmail: z.string().optional().nullable(),
  businessPhone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  socials: z.any().optional().nullable(), // {facebook, instagram, linkedin}
  // Location
  city: z.string().optional().nullable(),
  county: CountyEnum.optional().nullable(),
  country: z.string().default("Kenya").optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  location: z.any().optional().nullable(), // GeoJSON Point
  serviceRadiusKm: z.number().int().optional().nullable().default(20),
  availability: AvailabilityStatusEnum.default("AVAILABLE"),
  operatingHours: z.any().optional().nullable(),
  // Compliance
  kraPin: z.string().optional().nullable(),
  isInsured: z.boolean().default(false),
  insuranceExpiry: z.date().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  yearsExperience: z.number().int().optional().nullable(),
  // Verification
  verified: z.boolean().default(false),
  verificationStatus: VerificationStatusEnum.default("PENDING"),
  verificationNotes: z.string().optional().nullable(),
  verifiedAt: z.date().optional().nullable(),
  verifiedById: z.string().optional().nullable(),
  // Stats
  rating: z.number().default(0.0),
  reviewCount: z.number().int().default(0),
  completedProjects: z.number().int().default(0),
  projectCount: z.number().int().default(0),
  responseRate: z.number().default(0), // Percentage (Float)
  responseTime: z.number().int().default(0), // Average minutes
  // Pricing
  minProjectBudget: z.number().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  acceptedPayments: z.array(z.string()).default(["MPESA", "BANK", "CASH"]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

// --- Onboarding Schemas ---

export const ClientOnboardingSchema = z.object({
  role: z.literal("client"),
  // Client type
  type: ClientTypeEnum.default("HOMEOWNER"),
  // Location fields (county is required for ClientProfile)
  county: CountyEnum,
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  // For corporate clients
  companyName: z.string().optional(),
  companyRegistration: z.string().optional(), // CR12 number
  kraPin: z.string().optional(),
  // Budget preferences (maps to budgetRangeMin/Max)
  budgetRangeMin: z.number().positive().optional(),
  budgetRangeMax: z.number().positive().optional(),
  // Interests
  interests: z.array(z.string()).optional(),
});

export const ProfessionalOnboardingSchema = z.object({
  role: z.literal("professional"),
  profession: ProfessionEnum,
  companyName: z.string().min(1, "Company name is required"),
  // Location (service area)
  county: CountyEnum,
  city: z.string().optional(),
  serviceRadiusKm: z.number().int().positive().optional(),
  // Profile info
  yearsExperience: z.number().int().min(0).optional(),
  bio: z.string().max(2000).optional(),
  portfolioUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  // License (required for verification - uses schema from license.ts)
  license: professionalLicenseSchema,
  // Supporting documents (maps to ProfessionalDocument)
  certificatesUrls: z.array(z.string().url()).optional(),
  idDocumentsUrls: z.array(z.string().url()).optional(),
  // Upload status flags
  certificatesPending: z.boolean().optional(),
  idPending: z.boolean().optional(),
});

// Store Category enum matching Prisma schema
export const StoreCategoryEnum = z.enum([
  "HARDWARE",
  "BUILDING_MATERIALS",
  "TILES_AND_CERAMICS",
  "ELECTRICAL",
  "PLUMBING",
  "PAINTS_AND_FINISHES",
  "ROOFING",
  "TIMBER_AND_WOOD",
  "GLASS_AND_ALUMINUM",
  "KITCHEN_AND_BATH",
  "LANDSCAPING",
  "STEEL_AND_METALS",
  "SAFETY_AND_TOOLS",
  "HVAC",
  "SOLAR_AND_ENERGY",
  "WATER_STORAGE",
  "SECURITY_SYSTEMS",
  "DECOR_AND_LIGHTING",
  "HEAVY_MACHINERY",
  "WINDOWS_AND_DOORS",
  "AUTOMOTIVE",
]);

export type StoreCategory = z.infer<typeof StoreCategoryEnum>;

// Store Type enum matching Prisma schema
export const StoreTypeEnum = z.enum([
  "RETAIL",
  "WHOLESALE",
  "MANUFACTURER",
  "DISTRIBUTOR",
  "ONLINE_ONLY",
]);

export type StoreType = z.infer<typeof StoreTypeEnum>;

// Delivery Option enum matching Prisma schema
export const DeliveryOptionEnum = z.enum([
  "PICKUP_ONLY",
  "DELIVERY_AVAILABLE",
  "THIRD_PARTY_LOGISTICS",
  "DIGITAL_DELIVERY",
]);

export type DeliveryOption = z.infer<typeof DeliveryOptionEnum>;

export const StoreOnboardingSchema = z.object({
  role: z.literal("professional"),
  // Required fields matching Store model
  name: z.string().min(1, "Store name is required").max(100),
  slug: z
    .string()
    .min(1, "Store slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  storeType: StoreTypeEnum,
  categories: z.array(StoreCategoryEnum).min(1, "Select at least one category"),
  // Location
  address: z.string().min(1, "Store address is required"),
  city: z.string().min(1, "Store city is required"),
  county: CountyEnum,
  neighborhood: z.string().optional(),
  zipCode: z.string().max(20).optional(),
  // Contact
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  // Delivery & operations
  deliveryOption: DeliveryOptionEnum.default("PICKUP_ONLY"),
  deliveryRadiusKm: z.number().int().positive().optional(),
  baseDeliveryFee: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
  // Optional fields
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  // Business verification
  businessRegNo: z.string().optional(),
  kraPin: z.string().optional(),
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

export const PropertyTenureEnum = z.enum([
  "FREEHOLD",
  "LEASEHOLD",
  "SECTIONAL_TITLE",
  "SUB_LEASE",
]);

export const FurnishingStatusEnum = z.enum([
  "UNFURNISHED",
  "SEMI_FURNISHED",
  "FURNISHED",
  "SERVICED",
]);

export const CompletionStatusEnum = z.enum([
  "READY_TO_MOVE",
  "UNDER_CONSTRUCTION",
  "OFF_PLAN",
]);

export const AreaUnitEnum = z.enum([
  "SQ_METERS",
  "SQ_FEET",
  "ACRES",
  "HECTARES",
]);

// Property Document Type enum (verification documents) matches Prisma PropertyDocumentType
export const PropertyDocumentTypeEnum = z.enum([
  "TITLE_DEED",
  "OFFICIAL_SEARCH",
  "LAND_RATES_CLEARANCE",
  "LAND_RENT_CLEARANCE",
  "ID_COPY",
  "KRA_PIN",
  "AUTHORITY_TO_SELL",
]);

// Property document schema for onboarding (Verification)
export const PropertyDocumentSchema = z.object({
  url: z.string().url("File URL must be a valid URL"),
  type: PropertyDocumentTypeEnum,
});

export const PropertyOnboardingSchema = z.object({
  role: z.literal("professional"),
  // Required fields matching Property model
  title: z.string().min(1, "Property title is required").max(200),
  price: z.number().positive("Price must be a positive number"),
  currency: z.string().default("KES"),
  priceNegotiable: z.boolean().default(false),
  type: PropertyTypeEnum,
  category: PropertyCategoryEnum,
  // Location
  location: z.string().min(1, "Location is required").max(255),
  county: CountyEnum.optional(),
  address: z.string().max(500).optional(),
  constituency: z.string().max(100).optional(),
  neighbourhood: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  // Property details
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  buildingSize: z.number().positive().optional(),
  plotSize: z.number().positive().optional(),
  areaUnit: AreaUnitEnum.default("SQ_METERS"),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),

  tenure: PropertyTenureEnum.optional(),
  furnishing: FurnishingStatusEnum.optional(),
  completionStatus: CompletionStatusEnum.optional(),

  // Media
  images: z
    .array(z.object({ value: z.string().url().startsWith("https://") }))
    .min(1)
    .transform((arr) => arr.map((o) => o.value)),
  floorPlanUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  virtualTourUrl: z.string().url().optional(),

  // Optional description
  description: z.string().max(5000).optional(),

  // Boolean flags (amenities)
  hasBorehole: z.boolean().default(false),
  hasBackupGenerator: z.boolean().default(false),
  hasElevator: z.boolean().default(false),
  hasCCTV: z.boolean().default(false),
  isGatedCommunity: z.boolean().default(false),

  features: z.array(z.string()).optional(),

  // Property verification documents (Legal)
  documents: z.array(PropertyDocumentSchema).optional(),
});

export type ProfessionalOnboardingData = z.infer<
  typeof ProfessionalOnboardingSchema
>;

export type ClientOnboardingData = z.infer<typeof ClientOnboardingSchema>;

export type StoreOnboardingData = z.infer<typeof StoreOnboardingSchema>;

export type PropertyDocumentData = z.infer<typeof PropertyDocumentSchema>;

export type PropertyOnboardingData = z.infer<typeof PropertyOnboardingSchema>;

export const OnboardingSchema = z.discriminatedUnion("role", [
  ClientOnboardingSchema,
  ProfessionalOnboardingSchema,
  StoreOnboardingSchema,
  PropertyOnboardingSchema,
]);

export type OnboardingData = z.infer<typeof OnboardingSchema>;
