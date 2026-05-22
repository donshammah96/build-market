import { z } from "zod";
import type { StoreDocumentType } from "@prisma/client";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  BatchCreateStoresSchema,
  CreateStoreSchema,
  StoreQuerySchema,
  UpdateStoreSchema,
} from "@/app/lib/validation/stores-validation";
import {
  BatchCreateStoresSchema as BatchCreateStoresSchemaValue,
  CreateStoreSchema as CreateStoreSchemaValue,
  StoreQuerySchema as StoreQuerySchemaValue,
  UpdateStoreSchema as UpdateStoreSchemaValue,
  createStoreDocumentSchema,
} from "@/app/lib/validation/stores-validation";

export {
  BatchCreateStoresSchemaValue as BatchCreateStoresSchema,
  CreateStoreSchemaValue as CreateStoreSchema,
  StoreQuerySchemaValue as StoreQuerySchema,
  UpdateStoreSchemaValue as UpdateStoreSchema,
  createStoreDocumentSchema,
};

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type StoreQueryInput = z.infer<typeof StoreQuerySchema>;
export type BatchCreateStoresInput = z.infer<typeof BatchCreateStoresSchema>;

export type StoreActor = {
  userId: string;
  role?: string | null;
};

export type StoreDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_input"
  | "invalid_state"
  | "limit_exceeded"
  | "unauthorized"
  | "internal";

export type StoreDomainError = DomainError<StoreDomainErrorCode> & {
  currentVersion?: number;
};
export type StoreResult<T> = Result<T, StoreDomainError>;

export type StoreAssetDto = {
  id: string;
  cdnUrl: string | null;
  thumbnailUrl?: string | null;
  blurHash?: string | null;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

export type StoreImageDto = {
  id: string;
  category: string;
  caption: string | null;
  isMain: boolean;
  sortOrder: number;
  asset: StoreAssetDto | null;
};

export type StoreProfessionalDto = {
  userId: string;
  companyName: string | null;
  profession?: string | null;
  website?: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
  } | null;
};

export type StoreListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
  storeType: string;
  verified: boolean;
  verificationStatus: string | null;
  featured: boolean;
  rating: number | null;
  reviewCount: number;
  isOpen: boolean | null;
  deliveryRadiusKm: number | null;
  images: StoreImageDto[];
  createdAt: string;
  updatedAt: string;
  professional: StoreProfessionalDto | null;
  _count: {
    products: number;
    reviews: number;
    orders: number;
  };
};

export type StoreDetail = StoreListItem & {
  bannerUrl: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  website: string | null;
  mpesaTillNumber: string | null;
  acceptsCard: boolean;
  acceptsCash: boolean;
  neighborhood: string | null;
  baseDeliveryFee: number | null;
  minOrderValue: number | null;
  operatingHours: unknown;
  businessRegNo: string | null;
  kraPin: string | null;
  verificationNotes: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  deletedAt: string | null;
  version?: number;
};

export type StoreDocumentItem = {
  id: string;
  storeId: string;
  assetId: string | null;
  uploadedById: string;
  type: StoreDocumentType;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  asset: StoreAssetDto | null;
};

export type StoreListResult = {
  stores: StoreListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type MyStoreWithStats = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  verificationStatus: string | null;
  rejectionReason: string | null;
  rating: number | null;
  reviewCount: number;
  isOpen: boolean | null;
  featured: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  totalProducts: number;
  totalOrders: number;
  totalReviews: number;
  pendingOrders: number;
  totalRevenue: number;
  recentProducts: {
    id: string;
    name: string;
    price: number | null;
  }[];
  views: number;
};

export type AddStoreDocumentInput = {
  type: StoreDocumentType;
  assetId: string;
  notes?: string;
};

export type StoreOperationContext = {
  correlationId: string;
  userId: string;
  storeId: string;
  ipAddress: string;
  userAgent: string;
  idempotencyKey?: string;
};

export type StoreUpdateOptimisticInput = {
  storeId: string;
  actor: StoreActor;
  data: UpdateStoreInput;
  context: StoreOperationContext;
  expectedVersion: number;
};

export type StoreDeleteOptimisticInput = {
  storeId: string;
  actor: StoreActor;
  context: StoreOperationContext;
  expectedVersion: number;
};

export type StoreDocumentListResult = {
  documents: StoreDocumentItem[];
};

export type StoreUpdateResultEnvelope = {
  data: StoreDetail;
  meta: {
    version: number;
    eventVersion: number;
  };
};

export type StoreDeleteResultEnvelope = {
  message: string;
  storeId: string;
  deletedAt: string;
  version: number;
};

export type ConsentRecordInput = {
  userId: string;
  metadata: unknown;
  ipAddress?: string;
  userAgent?: string;
};
