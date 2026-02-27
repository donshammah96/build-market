import { z } from "zod";
import {
  StoreCategory,
  StoreType,
  County,
  StoreImageCategory,
} from "@prisma/client";

/**
 * Shared validation schemas for Store API routes
 * Uses Prisma-generated enums for type safety
 */

// Zod enums from Prisma enums
export const StoreCategorySchema = z.nativeEnum(StoreCategory);
export const StoreTypeSchema = z.nativeEnum(StoreType);
export const CountySchema = z.nativeEnum(County);
export const StoreImageCategorySchema = z.nativeEnum(StoreImageCategory);

// Helper function to generate URL-safe slug from store name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

// Store image schema aligned with StoreImage model
export const StoreImageInputSchema = z.object({
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  category: StoreImageCategorySchema.optional().default("INTERIOR"),
  caption: z.string().max(500).optional(),
  isMain: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional(),
});

// Create store schema
export const CreateStoreSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  description: z.string().max(5000).optional(),
  slug: z.string().max(100).optional(), // Auto-generated if not provided

  // Contact info
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),

  // Location
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  county: CountySchema,
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  // Store details
  categories: z
    .array(StoreCategorySchema)
    .min(1, "At least one category is required"),
  storeType: StoreTypeSchema,

  // Payment options
  mpesaTillNumber: z.string().optional(),
  mpesaPaybill: z.string().optional(),
  acceptsCard: z.boolean().optional().default(false),
  acceptsCash: z.boolean().optional().default(true),

  // Delivery
  deliveryRadiusKm: z.number().int().min(0).max(500).optional(),
  baseDeliveryFee: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
  operatingHours: z.record(z.string(), z.unknown()).optional(),

  // Business info
  businessRegNo: z.string().optional(),
  kraPin: z.string().optional(),

  // Images (array of Asset IDs)
  images: z.array(StoreImageInputSchema).max(20).optional().default([]),
});

// Update store schema (all fields optional)
export const UpdateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),

  // Contact info
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),

  // Location
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  county: CountySchema.optional(),
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  // Store details
  categories: z.array(StoreCategorySchema).min(1).optional(),
  storeType: StoreTypeSchema.optional(),

  // Payment options
  mpesaTillNumber: z.string().optional(),
  mpesaPaybill: z.string().optional(),
  acceptsCard: z.boolean().optional(),
  acceptsCash: z.boolean().optional(),

  // Delivery
  deliveryRadiusKm: z.number().int().min(0).max(500).optional(),
  baseDeliveryFee: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
  operatingHours: z.record(z.string(), z.unknown()).optional(),
  isOpen: z.boolean().optional(),

  // Business info
  businessRegNo: z.string().optional(),
  kraPin: z.string().optional(),

  // Images (replaces existing images)
  images: z.array(StoreImageInputSchema).max(20).optional(),
});

// Batch create stores schema
export const BatchCreateStoresSchema = z.object({
  stores: z
    .array(CreateStoreSchema)
    .min(1)
    .max(5, "Maximum 5 stores per request"),
});

// Query parameters schema
export const StoreQuerySchema = z.object({
  // Filters
  category: StoreCategorySchema.optional(),
  storeType: StoreTypeSchema.optional(),
  county: CountySchema.optional(),
  city: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),

  // Search
  search: z.string().min(2).max(100).optional(),

  // Geospatial
  lat: z
    .string()
    .regex(/^-?\d+\.?\d*$/)
    .optional(),
  lng: z
    .string()
    .regex(/^-?\d+\.?\d*$/)
    .optional(),
  radius: z.string().regex(/^\d+$/).optional().default("50"), // km

  // Pagination
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("20"),
  cursor: z.string().optional(),
});

// Optimized select for store list queries
export const storeListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  address: true,
  city: true,
  county: true,
  zipCode: true,
  latitude: true,
  longitude: true,
  categories: true,
  storeType: true,
  verified: true,
  verificationStatus: true,
  featured: true,
  rating: true,
  reviewCount: true,
  isOpen: true,
  deliveryRadiusKm: true,
  images: {
    select: {
      id: true,
      category: true,
      caption: true,
      isMain: true,
      sortOrder: true,
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
  professional: {
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
      products: true,
      reviews: true,
      orders: true,
    },
  },
} as const;

// Full store details select
export const storeDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  contactPhone: true,
  whatsappNumber: true,
  email: true,
  website: true,
  mpesaTillNumber: true,
  acceptsCard: true,
  acceptsCash: true,
  address: true,
  city: true,
  county: true,
  neighborhood: true,
  zipCode: true,
  latitude: true,
  longitude: true,
  storeType: true,
  categories: true,
  deliveryRadiusKm: true,
  baseDeliveryFee: true,
  minOrderValue: true,
  operatingHours: true,
  isOpen: true,
  businessRegNo: true,
  kraPin: true,
  verified: true,
  verificationStatus: true,
  verificationNotes: true,
  verifiedAt: true,
  rejectionReason: true,
  featured: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  images: {
    select: {
      id: true,
      category: true,
      caption: true,
      isMain: true,
      sortOrder: true,
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
  professional: {
    select: {
      userId: true,
      companyName: true,
      profession: true,
      website: true,
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
      products: true,
      reviews: true,
      orders: true,
    },
  },
} as const;
