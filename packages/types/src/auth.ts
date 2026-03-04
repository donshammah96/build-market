import z from "zod";
import { professionalLicenseSchema } from "./license";
import { professionalDocumentSchema } from "./documents";
import {
  COUNTIES,
  PROFESSIONS,
  USER_STATUSES,
  USER_ROLES,
  CLIENT_TYPES,
  VERIFICATION_STATUSES,
  AVAILABILITY_STATUSES,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  STORE_TYPE_LABELS,
  DELIVERY_OPTIONS,
  PROPERTY_TYPES,
  PROPERTY_CATEGORIES,
  PROPERTY_TENURES,
  FURNISHING_STATUSES,
  COMPLETION_STATUSES,
  AREA_UNITS,
  PROPERTY_DOCUMENT_TYPES,
  STORE_DOCUMENT_TYPES,
  type County,
  type Profession,
  type UserRole,
  type UserStatus,
  type ClientType,
  type VerificationStatus,
  type AvailabilityStatus,
  type StoreCategory,
  type StoreType,
  type DeliveryOption,
  type PropertyType,
  type PropertyCategory,
  type PropertyTenure,
  type FurnishingStatus,
  type CompletionStatus,
  type AreaUnit,
  type PropertyDocumentType,
} from "@build/enums";

export {
  COUNTIES,
  PROFESSIONS,
  USER_STATUSES,
  USER_ROLES,
  CLIENT_TYPES,
  VERIFICATION_STATUSES,
  AVAILABILITY_STATUSES,
  STORE_CATEGORIES,
  STORE_TYPES,
  DELIVERY_OPTIONS,
  PROPERTY_TYPES,
  PROPERTY_CATEGORIES,
  PROPERTY_TENURES,
  FURNISHING_STATUSES,
  COMPLETION_STATUSES,
  AREA_UNITS,
  PROPERTY_DOCUMENT_TYPES,
} from "@build/enums";

export type {
  County,
  Profession,
  UserStatus,
  UserRole,
  ClientType,
  VerificationStatus,
  AvailabilityStatus,
  StoreCategory,
  StoreType,
  DeliveryOption,
  PropertyType,
  PropertyCategory,
  PropertyTenure,
  FurnishingStatus,
  CompletionStatus,
  AreaUnit,
  PropertyDocumentType,
} from "@build/enums";

export interface CustomJwtSessionClaims {
  metadata?: {
    role?: UserRole;
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

export const UserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  role: z.enum(USER_ROLES).default("CLIENT"),
  status: z.enum(USER_STATUSES).default("ACTIVE"),
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

export const ClientTypeEnum = z.enum(CLIENT_TYPES);
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
  county: z.enum(COUNTIES).optional().nullable(),
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

export const CountyEnum = z.enum(COUNTIES);
export const ProfessionEnum = z.enum(PROFESSIONS);

export const AvailabilityStatusEnum = z.enum(AVAILABILITY_STATUSES);

export const VerificationStatusEnum = z.enum(VERIFICATION_STATUSES);

export const ProfessionalProfileSchema = z.object({
  userId: z.string(),
  companyName: z.string(),
  profession: z.enum(PROFESSIONS).optional().nullable(),
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
  county: z.enum(COUNTIES).optional().nullable(),
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
  license: z.any().optional().nullable(),
});

export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

// --- Onboarding Schemas ---

// Store Category enum matching Prisma schema
export const StoreCategoryEnum = z.enum(STORE_CATEGORIES);

// Store Type enum matching Prisma schema
export const StoreTypeEnum = z.enum(STORE_TYPE_LABELS);

// Delivery Option enum matching Prisma schema
export const DeliveryOptionEnum = z.enum(DELIVERY_OPTIONS);

// Convert STORE_CATEGORY_OPTIONS to array format for dropdown

const STORE_CATEGORY_OPTIONS_ARRAY = STORE_CATEGORIES.map((value) => ({
  value,
  label: STORE_CATEGORY_LABELS[value as keyof typeof STORE_CATEGORY_LABELS],
}));

export const StoreDocumentTypeEnum = z.enum(STORE_DOCUMENT_TYPES);
// Store document schema for onboarding (Verification)
export const StoreDocumentSchema = z.object({
  url: z.string().url("File URL must be a valid URL"),
  type: StoreDocumentTypeEnum,
});

/** Maximum number of categories allowed */
const MAX_CATEGORIES = 10;

// Store Type options - using types from store.ts
const STORE_TYPES: Array<{ value: StoreType; label: string }> = [
  { value: "RETAIL", label: `Retail - ${STORE_TYPE_LABELS.RETAIL}` },
  { value: "WHOLESALE", label: `Wholesale - ${STORE_TYPE_LABELS.WHOLESALE}` },
  {
    value: "MANUFACTURER",
    label: `Manufacturer - ${STORE_TYPE_LABELS.MANUFACTURER}`,
  },
  {
    value: "DISTRIBUTOR",
    label: `Distributor - ${STORE_TYPE_LABELS.DISTRIBUTOR}`,
  },
  {
    value: "ONLINE_ONLY",
    label: `Online Only - ${STORE_TYPE_LABELS.ONLINE_ONLY}`,
  },
];

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
  categories: z
    .array(z.enum(STORE_CATEGORY_LABELS))
    .min(1, "Select at least one category")
    .max(MAX_CATEGORIES, `Maximum ${MAX_CATEGORIES} categories allowed`),
  // Location
  address: z.string().min(1, "Store address is required"),
  city: z.string().min(1, "Store city is required"),
  county: z.enum(COUNTIES),
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
  images: z
    .array(
      z.object({
        assetId: z.string().uuid("Asset ID must be a valid UUID"),
        category: z
          .enum(["LOGO", "STOREFRONT", "INTERIOR", "WAREHOUSE", "TEAM"])
          .optional(),
        caption: z.string().max(500).optional(),
        isMain: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
  documents: z.array(StoreDocumentSchema).optional(),
  // Business verification
  businessRegNo: z.string().optional(),
  kraPin: z.string().optional(),

  // Payment methods
  acceptsCard: z.boolean().default(false),
  acceptsCash: z.boolean().default(true),
});

export const ClientOnboardingSchema = z.object({
  role: z.literal("client"),
  // Client type
  type: ClientTypeEnum.default("HOMEOWNER"),
  // Location fields (county is required for ClientProfile)
  county: z.enum(COUNTIES),
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

  // Homeowner specific fields (mapped to preferences or other fields)
  projectType: z.string().optional(),
  projectLocation: z.string().optional(), // Maps to neighborhood or preferences
  estimatedBudget: z.string().optional(), // String representation of budget
  description: z.string().optional(), // Project description
});

// Property Type enum matching Prisma schema
// Property Type enum matching Prisma schema
export const PropertyTypeEnum = z.enum(PROPERTY_TYPES);

// Property Category enum matching Prisma schema
export const PropertyCategoryEnum = z.enum(PROPERTY_CATEGORIES);

export const PropertyTenureEnum = z.enum(PROPERTY_TENURES);

export const FurnishingStatusEnum = z.enum(FURNISHING_STATUSES);

export const CompletionStatusEnum = z.enum(COMPLETION_STATUSES);

export const AreaUnitEnum = z.enum(AREA_UNITS);

// Property Document Type enum (verification documents) matches Prisma PropertyDocumentType
export const PropertyDocumentTypeEnum = z.enum(PROPERTY_DOCUMENT_TYPES);

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
  county: z.enum(COUNTIES).optional(),
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

export const ProfessionalOnboardingSchema = z.object({
  role: z.literal("professional"),
  profession: z.enum(PROFESSIONS),
  companyName: z.string().min(1, "Company name is required"),
  // Location (service area)
  county: z.enum(COUNTIES),
  city: z.string().optional(),
  serviceRadiusKm: z.number().int().positive().optional(),
  // Profile info
  yearsExperience: z.number().int().min(0).optional(),
  bio: z.string().max(2000).optional(),
  portfolioUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  // License (optional for professionals without a formal license)
  license: professionalLicenseSchema.optional(),

  // Board Registration Number
  boardRegistrationNumber: z.string().optional(),

  // Professional Verification Documents (e.g. NCA_ACCREDITATION, BUSINESS_REGISTRATION)
  documents: z.array(professionalDocumentSchema).optional(),

  // Upload status flags
  documentsPending: z.boolean().optional(),
  licensePending: z.boolean().optional(),

  // Store data for suppliers
  stores: z.array(StoreOnboardingSchema).optional(),

  // Property data for realtors
  properties: z.array(PropertyOnboardingSchema).optional(),
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
