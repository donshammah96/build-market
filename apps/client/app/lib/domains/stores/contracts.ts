import { z } from "zod";
import type { Prisma, StoreDocumentType } from "@prisma/client";
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
  storeListSelect,
  storeDetailSelect,
} from "@/app/lib/validation/stores-validation";

export {
  BatchCreateStoresSchemaValue as BatchCreateStoresSchema,
  CreateStoreSchemaValue as CreateStoreSchema,
  StoreQuerySchemaValue as StoreQuerySchema,
  UpdateStoreSchemaValue as UpdateStoreSchema,
  createStoreDocumentSchema,
};

export type StoreListItem = Prisma.StoreGetPayload<{
  select: typeof storeListSelect;
}>;

export type StoreDetail = Prisma.StoreGetPayload<{
  select: typeof storeDetailSelect;
}>;

export type StoreDocumentItem = Prisma.StoreDocumentGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        cdnUrl: true;
        originalName: true;
        mimeType: true;
        size: true;
      };
    };
  };
}>;

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

export type DomainResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: StoreDomainErrorCode;
      message?: string;
      status?: number;
      currentVersion?: number;
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
  createdAt: Date;
  updatedAt: Date;
  totalProducts: number;
  totalOrders: number;
  totalReviews: number;
  pendingOrders: number;
  totalRevenue: number;
  recentProducts: {
    id: string;
    name: string;
    price: Prisma.Decimal | null;
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
  metadata: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};
