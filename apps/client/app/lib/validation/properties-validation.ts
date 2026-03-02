import { z } from "zod";
import {
  PropertyType,
  PropertyCategory,
  PropertyTenure,
  FurnishingStatus,
  CompletionStatus,
  AreaUnit,
  ImageCategory,
  County,
  PropertyStatus,
} from "@prisma/client";

/**
 * Shared validation schemas for Property API routes.
 * Uses Prisma-generated enums for type safety.
 *
 * Mirrors the pattern established by stores-validation.ts.
 */

// Zod enums from Prisma enums
export const PropertyTypeSchema = z.nativeEnum(PropertyType);
export const PropertyCategorySchema = z.nativeEnum(PropertyCategory);
export const PropertyTenureSchema = z.nativeEnum(PropertyTenure);
export const FurnishingStatusSchema = z.nativeEnum(FurnishingStatus);
export const CompletionStatusSchema = z.nativeEnum(CompletionStatus);
export const AreaUnitSchema = z.nativeEnum(AreaUnit);
export const ImageCategorySchema = z.nativeEnum(ImageCategory);
export const CountySchema = z.nativeEnum(County);
export const PropertyStatusSchema = z.nativeEnum(PropertyStatus);

// Helper function to generate URL-safe slug from property title
export function generatePropertySlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

// Property image schema aligned with PropertyImage model
export const PropertyImageInputSchema = z.object({
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  category: ImageCategorySchema.optional().default("EXTERIOR"),
  caption: z.string().max(500).optional(),
  isMain: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional().default([]),
});

// Coordinates schema for latitude/longitude
const CoordinatesSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .optional();

// Create property schema
export const CreatePropertySchema = z.object({
  title: z.string().min(1, "Property title is required").max(200),
  description: z.string().max(10000).optional(),
  slug: z.string().max(100).optional(), // Auto-generated if not provided
  type: PropertyTypeSchema,
  category: PropertyCategorySchema,

  // Pricing
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("KES"),
  priceNegotiable: z.boolean().optional().default(false),
  serviceCharge: z.number().min(0).optional(),
  depositRequired: z.string().optional(),
  paymentTerms: z.string().optional(),

  // Tenure
  tenure: PropertyTenureSchema.optional().default("FREEHOLD"),
  leaseYearsRemaining: z.number().int().min(0).optional(),
  titleDeedNumber: z.string().optional(),
  titleDeedReady: z.boolean().optional().default(false),

  // Property details
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  buildingSize: z.number().positive().optional(),
  plotSize: z.number().positive().optional(),
  areaUnit: AreaUnitSchema.optional().default("SQ_METERS"),
  yearBuilt: z.number().int().min(1900).max(2100).optional(),
  furnishing: FurnishingStatusSchema.optional().default("UNFURNISHED"),
  completionStatus: CompletionStatusSchema.optional().default("READY_TO_MOVE"),

  // Location
  location: z.string().min(1, "Location is required"),
  address: z.string().optional(),
  county: CountySchema.optional(),
  constituency: z.string().optional(),
  neighbourhood: z.string().optional(),
  coordinates: CoordinatesSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  nearbyLandmarks: z.array(z.string()).optional(),

  // Amenities
  hasBorehole: z.boolean().optional().default(false),
  hasBackupGenerator: z.boolean().optional().default(false),
  hasElevator: z.boolean().optional().default(false),
  hasCCTV: z.boolean().optional().default(false),
  isGatedCommunity: z.boolean().optional().default(false),
  features: z.array(z.string()).optional().default([]),

  // Status
  featured: z.boolean().optional().default(false),

  // Media
  images: z.array(PropertyImageInputSchema).max(20).optional().default([]),
  floorPlanUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  virtualTourUrl: z.string().url().optional(),
});

// Update property schema (all fields optional)
export const UpdatePropertySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(10000).optional(),
  type: PropertyTypeSchema.optional(),
  category: PropertyCategorySchema.optional(),

  // Pricing
  price: z.number().positive().optional(),
  currency: z.string().optional(),
  priceNegotiable: z.boolean().optional(),
  serviceCharge: z.number().min(0).optional(),
  depositRequired: z.string().optional(),
  paymentTerms: z.string().optional(),

  // Tenure
  tenure: PropertyTenureSchema.optional(),
  leaseYearsRemaining: z.number().int().min(0).optional(),
  titleDeedNumber: z.string().optional(),
  titleDeedReady: z.boolean().optional(),

  // Property details
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  buildingSize: z.number().positive().optional(),
  plotSize: z.number().positive().optional(),
  areaUnit: AreaUnitSchema.optional(),
  yearBuilt: z.number().int().min(1900).max(2100).optional(),
  furnishing: FurnishingStatusSchema.optional(),
  completionStatus: CompletionStatusSchema.optional(),

  // Location
  location: z.string().min(1).optional(),
  address: z.string().optional(),
  county: CountySchema.optional(),
  constituency: z.string().optional(),
  neighbourhood: z.string().optional(),
  coordinates: CoordinatesSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  nearbyLandmarks: z.array(z.string()).optional(),

  // Amenities
  hasBorehole: z.boolean().optional(),
  hasBackupGenerator: z.boolean().optional(),
  hasElevator: z.boolean().optional(),
  hasCCTV: z.boolean().optional(),
  isGatedCommunity: z.boolean().optional(),
  features: z.array(z.string()).optional(),

  // Status
  status: PropertyStatusSchema.optional(),
  featured: z.boolean().optional(),

  // Media
  images: z.array(PropertyImageInputSchema).max(20).optional(),
  floorPlanUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  virtualTourUrl: z.string().url().optional(),
});

// Batch create properties schema
export const BatchCreatePropertiesSchema = z.object({
  properties: z
    .array(CreatePropertySchema)
    .min(1)
    .max(5, "Maximum 5 properties per request"),
});

// Query parameters schema for GET list
export const PropertyQuerySchema = z.object({
  // Filters
  type: PropertyTypeSchema.optional(),
  category: PropertyCategorySchema.optional(),
  county: CountySchema.optional(),
  status: PropertyStatusSchema.optional(),
  verified: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  furnishing: FurnishingStatusSchema.optional(),

  // Price range
  minPrice: z
    .string()
    .regex(/^\d+\.?\d*$/)
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+\.?\d*$/)
    .optional(),

  // Property specs
  minBedrooms: z.string().regex(/^\d+$/).optional(),
  maxBedrooms: z.string().regex(/^\d+$/).optional(),
  minBathrooms: z.string().regex(/^\d+$/).optional(),

  // Search
  search: z.string().min(2).max(100).optional(),

  // Sorting
  sortBy: z
    .enum(["price", "createdAt", "bedrooms", "buildingSize"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),

  // Pagination
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("20"),
});

// Optimized select for property list queries
export const propertyListSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  category: true,
  price: true,
  currency: true,
  priceNegotiable: true,
  location: true,
  address: true,
  county: true,
  bedrooms: true,
  bathrooms: true,
  parkingSpaces: true,
  buildingSize: true,
  plotSize: true,
  areaUnit: true,
  status: true,
  featured: true,
  verified: true,
  verificationStatus: true,
  viewCount: true,
  inquiryCount: true,
  images: {
    select: {
      id: true,
      caption: true,
      category: true,
      isMain: true,
      sortOrder: true,
      url: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          thumbnailUrl: true,
          blurHash: true,
          width: true,
          height: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
    take: 5,
  },
  createdAt: true,
  updatedAt: true,
  agent: {
    select: {
      userId: true,
      companyName: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
  },
  _count: {
    select: {
      inquiries: true,
    },
  },
} as const;

// Full property details select (includes version for optimistic locking)
export const propertyDetailSelect = {
  id: true,
  title: true,
  slug: true,
  version: true,
  description: true,
  type: true,
  category: true,
  price: true,
  currency: true,
  priceNegotiable: true,
  serviceCharge: true,
  depositRequired: true,
  paymentTerms: true,
  tenure: true,
  leaseYearsRemaining: true,
  titleDeedNumber: true,
  titleDeedReady: true,
  bedrooms: true,
  bathrooms: true,
  parkingSpaces: true,
  buildingSize: true,
  plotSize: true,
  areaUnit: true,
  yearBuilt: true,
  furnishing: true,
  completionStatus: true,
  location: true,
  address: true,
  county: true,
  constituency: true,
  neighbourhood: true,
  coordinates: true,
  latitude: true,
  longitude: true,
  nearbyLandmarks: true,
  hasBorehole: true,
  hasBackupGenerator: true,
  hasElevator: true,
  hasCCTV: true,
  isGatedCommunity: true,
  features: true,
  status: true,
  featured: true,
  verified: true,
  verificationStatus: true,
  verificationNotes: true,
  verifiedAt: true,
  rejectionReason: true,
  viewCount: true,
  inquiryCount: true,
  floorPlanUrl: true,
  videoUrl: true,
  virtualTourUrl: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  images: {
    select: {
      id: true,
      caption: true,
      category: true,
      tags: true,
      isMain: true,
      sortOrder: true,
      url: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          thumbnailUrl: true,
          blurHash: true,
          width: true,
          height: true,
          mimeType: true,
          size: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  attachments: {
    select: {
      id: true,
      title: true,
      type: true,
      fileUrl: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
        },
      },
    },
  },
  documents: {
    select: {
      id: true,
      type: true,
      status: true,
      issueDate: true,
      expiryDate: true,
      isPrivate: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
        },
      },
    },
  },
  agent: {
    select: {
      userId: true,
      companyName: true,
      profession: true,
      bio: true,
      city: true,
      county: true,
      verified: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
  },
  _count: {
    select: {
      inquiries: true,
    },
  },
} as const;
