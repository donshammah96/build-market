import { z } from "zod";
import {
  PropertyType,
  PropertyCategory,
  PropertyTenure,
  FurnishingStatus,
  CompletionStatus,
  AreaUnit,
  ImageCategory,
  AttachmentType,
  PropertyDocumentType,
  DocumentStatus,
  County,
  PropertyStatus,
  AuditAction,
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
export const AttachmentTypeSchema = z.nativeEnum(AttachmentType);
export const PropertyDocumentTypeSchema = z.nativeEnum(PropertyDocumentType);
export const DocumentStatusSchema = z.nativeEnum(DocumentStatus);

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

const MAX_PROPERTY_MEDIA_ITEMS = 20;
const FLOAT_TOLERANCE = 0.000001;

// Property Attachment schema aligned with PropertyAttachment model
export const createAttachmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  assetId: z.string().uuid("Invalid asset ID"),
  type: AttachmentTypeSchema,
  notes: z.string().optional(),
});

export const updateAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  assetId: z.string().uuid("Invalid asset ID").optional(),
  type: AttachmentTypeSchema.optional(),
  notes: z.string().optional(),
});

// Property image schema aligned with PropertyImage model
export const PropertyImageInputSchema = z.object({
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  category: ImageCategorySchema.optional().default("EXTERIOR"),
  caption: z.string().max(500).optional(),
  isMain: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional().default([]),
});

/**
 * Transitional file reference support:
 * - Preferred: assetId
 * - Legacy fallback (deprecating): fileUrl/fileKey + metadata
 */
const LegacyFileReferenceSchema = z.object({
  fileKey: z.string().max(512).optional(),
  fileUrl: z.string().url("File URL must be a valid URL").optional(),
  mimeType: z.string().max(255).optional(),
  size: z.number().int().positive("File size must be positive").optional(),
});

export const PropertyAttachmentInputSchema = LegacyFileReferenceSchema.extend({
  title: z.string().min(1, "Attachment title is required").max(200).optional(),
  type: AttachmentTypeSchema,
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
  notes: z.string().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (!value.assetId && !value.fileUrl && !value.fileKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Attachment must include either assetId (preferred) or legacy file reference fields",
      path: ["assetId"],
    });
  }
});

export const PropertyDocumentInputSchema = LegacyFileReferenceSchema.extend({
  type: PropertyDocumentTypeSchema,
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
  notes: z.string().max(2000).optional(),
  status: DocumentStatusSchema.optional().default("PENDING"),
  rejectionReason: z.string().max(2000).optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  isPrivate: z.boolean().optional().default(true),
}).superRefine((value, ctx) => {
  if (!value.assetId && !value.fileUrl && !value.fileKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Document must include either assetId (preferred) or legacy file reference fields",
      path: ["assetId"],
    });
  }

  if (value.issueDate && value.expiryDate) {
    const issueDate = new Date(value.issueDate);
    const expiryDate = new Date(value.expiryDate);
    if (expiryDate <= issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiryDate must be after issueDate",
        path: ["expiryDate"],
      });
    }
  }

  if (value.status === "REJECTED" && !value.rejectionReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rejectionReason is required when status is REJECTED",
      path: ["rejectionReason"],
    });
  }
});

export const createDocumentSchema = z.object({
  type: PropertyDocumentTypeSchema,
  assetId: z.string().uuid("Invalid asset ID"),
  notes: z.string().max(2000).optional(),
});

export const updateDocumentSchema = z
  .object({
    type: PropertyDocumentTypeSchema.optional(),
    assetId: z.string().uuid("Invalid asset ID").optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.assetId !== undefined ||
      value.notes !== undefined,
    {
      message: "At least one document field must be provided",
    },
  );

// Coordinates schema for latitude/longitude
const CoordinatesSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .optional();

// Create property schema
export const CreatePropertySchema = z
  .object({
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
    completionStatus:
      CompletionStatusSchema.optional().default("READY_TO_MOVE"),

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
    images: z
      .array(PropertyImageInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional()
      .default([]),
    attachments: z
      .array(PropertyAttachmentInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional()
      .default([]),
    documents: z
      .array(PropertyDocumentInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional()
      .default([]),
    floorPlanUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    virtualTourUrl: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "latitude and longitude must be provided together",
        path: ["latitude"],
      });
    }

    if (
      value.coordinates &&
      value.latitude !== undefined &&
      value.longitude !== undefined
    ) {
      if (Math.abs(value.coordinates.lat - value.latitude) > FLOAT_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "coordinates.lat must match latitude when both are provided",
          path: ["coordinates", "lat"],
        });
      }
      if (Math.abs(value.coordinates.lng - value.longitude) > FLOAT_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "coordinates.lng must match longitude when both are provided",
          path: ["coordinates", "lng"],
        });
      }
    }

    if (
      (value.tenure === "LEASEHOLD" || value.tenure === "SUB_LEASE") &&
      (!value.leaseYearsRemaining || value.leaseYearsRemaining <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "leaseYearsRemaining is required and must be greater than 0 for leasehold tenures",
        path: ["leaseYearsRemaining"],
      });
    }

    const mainImageCount = value.images.filter((img) => img.isMain).length;
    if (mainImageCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one image can be marked as main",
        path: ["images"],
      });
    }
  });

// Update property schema (all fields optional)
export const UpdatePropertySchema = z
  .object({
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
    images: z
      .array(PropertyImageInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional(),
    attachments: z
      .array(PropertyAttachmentInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional(),
    documents: z
      .array(PropertyDocumentInputSchema)
      .max(MAX_PROPERTY_MEDIA_ITEMS)
      .optional(),
    floorPlanUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    virtualTourUrl: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "latitude and longitude must be provided together",
        path: ["latitude"],
      });
    }

    if (
      value.coordinates &&
      value.latitude !== undefined &&
      value.longitude !== undefined
    ) {
      if (Math.abs(value.coordinates.lat - value.latitude) > FLOAT_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "coordinates.lat must match latitude when both are provided",
          path: ["coordinates", "lat"],
        });
      }
      if (Math.abs(value.coordinates.lng - value.longitude) > FLOAT_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "coordinates.lng must match longitude when both are provided",
          path: ["coordinates", "lng"],
        });
      }
    }

    if (
      (value.tenure === "LEASEHOLD" || value.tenure === "SUB_LEASE") &&
      value.leaseYearsRemaining !== undefined &&
      value.leaseYearsRemaining <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "leaseYearsRemaining must be greater than 0 for leasehold tenures",
        path: ["leaseYearsRemaining"],
      });
    }

    if (value.status === "SOLD" && value.type && value.type !== "SALE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only SALE properties can be marked as SOLD",
        path: ["status"],
      });
    }

    if (value.status === "RENTED" && value.type && value.type === "SALE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SALE properties cannot be marked as RENTED",
        path: ["status"],
      });
    }

    if (value.images) {
      const mainImageCount = value.images.filter((img) => img.isMain).length;
      if (mainImageCount > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only one image can be marked as main",
          path: ["images"],
        });
      }
    }
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
