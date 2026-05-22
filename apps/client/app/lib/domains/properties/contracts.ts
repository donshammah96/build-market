import type { z } from "zod";
import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";

import {
  CreatePropertySchema,
  PropertyQuerySchema,
  UpdatePropertySchema,
  PropertyImageInputSchema,
  BatchCreatePropertiesSchema,
  PropertyAttachmentInputSchema,
  PropertyDocumentInputSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
  createDocumentSchema,
  updateDocumentSchema,
} from "@/app/lib/validation/properties-validation";

export {
  CreatePropertySchema,
  PropertyQuerySchema,
  UpdatePropertySchema,
  PropertyImageInputSchema,
  BatchCreatePropertiesSchema,
  PropertyAttachmentInputSchema,
  PropertyDocumentInputSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
  createDocumentSchema,
  updateDocumentSchema,
};

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof PropertyQuerySchema>;
export type PropertyImageInput = z.infer<typeof PropertyImageInputSchema>;
export type PropertyAttachmentInput = z.infer<
  typeof PropertyAttachmentInputSchema
>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
export type PropertyDocumentInput = z.infer<typeof PropertyDocumentInputSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export type PropertyActor = {
  userId: string;
  role: AppRole | string;
};

export type PropertyOperationContext = {
  correlationId: string;
  userId: string;
  propertyId: string;
  ipAddress: string;
  userAgent: string;
  idempotencyKey?: string;
};

export type PropertyDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_input"
  | "internal_error" // infrastructure failure (Prisma, network, etc.)
  | "suspended_account"
  | "not_professional"
  | "slug_conflict"
  | "duplicate"
  | "asset_not_found"
  | "asset_unauthorized"
  | "attachment_mismatch"
  | "document_not_found"
  | "attachment_not_found";

export type PropertyDomainError = DomainError<PropertyDomainErrorCode>;
export type PropertyResult<T> = Result<T, PropertyDomainError>;

export type PropertyErrorDetails = Record<
  string,
  string | number | boolean | null | undefined
>;

export type PropertyCoordinates =
  | {
      lat: number;
      lng: number;
    }
  | {
      latitude: number;
      longitude: number;
    }
  | {
      type: "Point";
      coordinates: [number, number];
    }
  | null;

/**
 * Optimistic-lock conflict result carries the current persisted version so the
 * route adapter can set X-Property-Version without a second DB round-trip.
 */
export type OptimisticLockResult<T> =
  | { ok: true; data: T; newVersion: number }
  | { ok: false; error: "not_found" | "forbidden" | "internal" }
  | { ok: false; error: "conflict"; currentVersion: number };

export type PropertyAssetDto = {
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

export type PropertyListImageDto = {
  id: string;
  caption: string | null;
  category: string;
  isMain: boolean;
  sortOrder: number;
  url: string | null;
  asset: PropertyAssetDto | null;
};

export type PropertyListAgentDto = {
  userId: string;
  companyName: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  } | null;
};

/** Explicit browser-safe property card/list DTO. */
export type PropertyListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: string;
  category: string;
  price: number;
  currency: string;
  priceNegotiable: boolean;
  location: string;
  address: string | null;
  county: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  buildingSize: number | null;
  plotSize: number | null;
  areaUnit: string | null;
  status: string;
  featured: boolean;
  verified: boolean;
  verificationStatus: string | null;
  viewCount: number;
  inquiryCount: number;
  images: PropertyListImageDto[];
  createdAt: string;
  updatedAt: string;
  agent: PropertyListAgentDto | null;
  _count: {
    inquiries: number;
  };
};

export type PropertyDetailAttachmentSummaryDto = {
  id: string;
  title: string;
  type: string;
  fileUrl: string | null;
  asset: {
    id: string;
    cdnUrl: string;
  } | null;
};

export type PropertyDetailDocumentSummaryDto = {
  id: string;
  type: string;
  status: string;
  issueDate: string | null;
  expiryDate: string | null;
  isPrivate: boolean;
  asset: {
    id: string;
    cdnUrl: string;
  } | null;
};

export type PropertyDetailAgentDto = {
  userId: string;
  companyName: string | null;
  profession: string | null;
  bio: string | null;
  city: string | null;
  county: string | null;
  verified: boolean;
  user: {
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
};

/** Explicit browser-safe property detail DTO. */
export type PropertyDetail = {
  id: string;
  title: string;
  slug: string;
  version: number;
  description: string | null;
  type: string;
  category: string;
  price: number;
  currency: string;
  priceNegotiable: boolean;
  serviceCharge: number | null;
  depositRequired: string | null;
  paymentTerms: string | null;
  tenure: string | null;
  leaseYearsRemaining: number | null;
  titleDeedNumber: string | null;
  titleDeedReady: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  buildingSize: number | null;
  plotSize: number | null;
  areaUnit: string | null;
  yearBuilt: number | null;
  furnishing: string | null;
  completionStatus: string | null;
  location: string;
  address: string | null;
  county: string | null;
  constituency: string | null;
  neighbourhood: string | null;
  coordinates: PropertyCoordinates;
  latitude: number | null;
  longitude: number | null;
  nearbyLandmarks: string[];
  hasBorehole: boolean;
  hasBackupGenerator: boolean;
  hasElevator: boolean;
  hasCCTV: boolean;
  isGatedCommunity: boolean;
  features: string[];
  status: string;
  featured: boolean;
  verified: boolean;
  verificationStatus: string | null;
  verificationNotes: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  viewCount: number;
  inquiryCount: number;
  floorPlanUrl: string | null;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  images: Array<
    PropertyListImageDto & {
      tags: string[];
      asset: PropertyAssetDto | null;
    }
  >;
  attachments: PropertyDetailAttachmentSummaryDto[];
  documents: PropertyDetailDocumentSummaryDto[];
  agent: PropertyDetailAgentDto | null;
  _count: {
    inquiries: number;
  };
};

export interface PropertyListResultEnvelope {
  properties: PropertyListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PropertyDetailResultEnvelope {
  property: PropertyDetail;
  similarProperties: PropertyListItem[];
}

export interface MyListingsResultEnvelope {
  properties: MyPropertyListing[];
}

/** Client-facing listing DTO; dates are ISO strings for hydration-safe JSON. */
export type MyPropertyListing = {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  location: string;
  county: string | null;
  type: string;
  category: string;
  status: string;
  verificationStatus: string | null;
  rejectionReason: string | null;
  views: number;
  inquiries: number;
  images: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PropertyDocumentDto = {
  id: string;
  type: string;
  assetId: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    cdnUrl: string;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null;
};

export type PropertyAttachmentDto = {
  id: string;
  title: string;
  type: string;
  assetId: string | null;
  notes: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    cdnUrl: string;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null;
};

export type PropertyCreateResultDto = {
  id: string;
  title: string;
  slug: string;
  type: string;
  category: string;
  price: number;
  location: string;
  status: string;
  version: number;
  createdAt: string;
};

export type PropertyUpdateResultDto = {
  property: PropertyDetail;
  version: number;
};

export type PropertyDeleteResultDto = {
  message: string;
  propertyId: string;
  propertyTitle: string;
  deletedAt: string;
  version: number;
};

export type PropertyMutationResultDto =
  | PropertyUpdateResultDto
  | PropertyDeleteResultDto
  | {
      id: string;
      message?: string;
    }
  | {
      message: string;
      id?: string;
    };
