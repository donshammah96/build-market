import { z } from 'zod';
import { CountyEnum, StoreCategoryEnum, StoreTypeEnum, VerificationStatusEnum } from './auth';

// ========================================================
// ENUMS
// ========================================================

export const DeliveryOptionEnum = z.enum([
  "PICKUP_ONLY",
  "DELIVERY_AVAILABLE",
  "THIRD_PARTY_LOGISTICS",
  "DIGITAL_DELIVERY",
]);
export type DeliveryOption = z.infer<typeof DeliveryOptionEnum>;

export const StoreDocumentTypeEnum = z.enum([
  "BUSINESS_PERMIT",
  "BUSINESS_REGISTRATION",
  "KRA_TAX_COMPLIANCE",
  "KRA_PIN_CERTIFICATE",
  "CR12",
  "DISTRIBUTOR_LICENSE",
  "KEBS_CERTIFICATE",
  "ID_OR_PASSPORT",
  "LEASE_OR_OWNERSHIP",
  "TRADING_LICENSE",
]);
export type StoreDocumentType = z.infer<typeof StoreDocumentTypeEnum>;

export const DocumentStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const StoreImageCategoryEnum = z.enum([
  "LOGO", "STOREFRONT", "INTERIOR", "WAREHOUSE", "TEAM"
]);
export type StoreImageCategory = z.infer<typeof StoreImageCategoryEnum>;

// ========================================================
// MODELS
// ========================================================

export const StoreDocumentSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string(),
  type: StoreDocumentTypeEnum,
  fileKey: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string(),
  size: z.number().int(),
  status: DocumentStatusEnum.default("PENDING"),
  verified: z.boolean().default(false),
  verifiedAt: z.date().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  issueDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  uploadedById: z.string(),
  notes: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type StoreDocument = z.infer<typeof StoreDocumentSchema>;

export const StoreImageSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string(),
  fileKey: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  blurDataUrl: z.string().optional().nullable(),
  category: StoreImageCategoryEnum.default("INTERIOR"),
  caption: z.string().optional().nullable(),
  isMain: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  uploadedById: z.string(),
  createdAt: z.date(),
});
export type StoreImage = z.infer<typeof StoreImageSchema>;

export const StoreSchema = z.object({
  id: z.string().uuid(),
  professionalId: z.string(),
  
  name: z.string().min(1, 'Store name is required'),
  slug: z.string(),
  description: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  
  contactPhone: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  
  mpesaTillNumber: z.string().optional().nullable(),
  mpesaPaybill: z.string().optional().nullable(),
  acceptsCard: z.boolean().default(false),
  acceptsCash: z.boolean().default(true),
  
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  county: CountyEnum.optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  coordinates: z.any().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  
  storeType: StoreTypeEnum.default("RETAIL"),
  categories: z.array(StoreCategoryEnum).default([]),
  deliveryOption: DeliveryOptionEnum.default("PICKUP_ONLY"),
  deliveryRadiusKm: z.number().int().optional().nullable(),
  baseDeliveryFee: z.number().optional().nullable(),
  minOrderValue: z.number().optional().nullable(),
  operatingHours: z.any().optional().nullable(),
  isOpen: z.boolean().default(true),
  
  businessRegNo: z.string().optional().nullable(),
  kraPin: z.string().optional().nullable(),
  verified: z.boolean().default(false),
  verificationStatus: VerificationStatusEnum.default("PENDING"),
  verificationNotes: z.string().optional().nullable(),
  verifiedAt: z.date().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  
  featured: z.boolean().default(false),
  rating: z.number().default(0),
  reviewCount: z.number().int().default(0),
  
  createdAt: z.date(),
  updatedAt: z.date(),
  
  // Relations
  images: z.array(StoreImageSchema).optional(),
  documents: z.array(StoreDocumentSchema).optional(),
});
export type Store = z.infer<typeof StoreSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  price: z.number().nonnegative('Price must be non-negative'),
  imageUrl: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  inStock: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
});
export type Product = z.infer<typeof ProductSchema>;
