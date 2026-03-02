import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

/**
 * Standardized response wrapper for all admin actions.
 * Supports optimistic updates by including the updated entity in `data`.
 */
export type ActionResponse<T = null> = {
  success: boolean;
  data?: T;
  error?: string;
  /** Timestamp for cache invalidation in optimistic updates */
  timestamp?: string;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ============================================================================
// Verification Types
// ============================================================================

export type EntityType = "professional" | "store" | "property";
export type VerificationAction = "VERIFY" | "REJECT" | "REQUEST_CORRECTION";
export type DocumentAction = "APPROVE" | "REJECT";
export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_CORRECTION";

export interface VerificationQueueItem {
  entityType: EntityType;
  entityId: string;
  name: string;
  status: VerificationStatus;
  submittedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  documentCount?: number;
  certificateCount?: number;
  productCount?: number;
  attachmentCount?: number;
  imageCount?: number;
  // Location info
  city?: string | null;
  county?: string | null;
  location?: string;
}

export interface VerificationStats {
  pending: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  verified: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  rejected: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  needsCorrection: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    adminId: string;
    createdAt: string;
  }>;
}

export interface VerificationDetails {
  entityType: EntityType;
  entityId: string;
  status: VerificationStatus;
  verifiedAt?: string;
  verifiedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  verificationNotes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  // Entity-specific details
  entity: Record<string, any>;
  documents?: Array<{
    id: string;
    type: string;
    fileUrl: string;
    isVerified: boolean;
    verifiedAt?: string;
    notes?: string;
  }>;
  auditHistory?: Array<{
    id: string;
    action: string;
    oldStatus: string;
    newStatus: string;
    reason?: string;
    createdAt: string;
    admin: {
      firstName: string;
      lastName: string;
    };
  }>;
}

// ============================================================================
// Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  companyName: z.string().min(2).optional(),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().min(0).optional(),
  bio: z.string().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  servicesOffered: z.array(z.string()).optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
});

export const SystemSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
  publicSignup: z.boolean(),
  enableAutoVerifyNCA: z.boolean(),
  enableAutoVerifyEPRA: z.boolean(),
  enableAutoVerifyBORAQS: z.boolean(),
  enforceProfessionalLicenses: z.boolean(),
  enforcePropertyDocuments: z.boolean(),
  enableLandRegistryCheck: z.boolean(),
  enforceStorePermits: z.boolean(),
  requireTaxCompliance: z.boolean(),
  platformCommission: z.number().min(0).max(100),
  supportEmail: z.string().email(),
  adminEmailAlerts: z.boolean(),
  securityMFA: z.boolean(),
});

// ============================================================================
// Verification Schemas
// ============================================================================

export const VerificationFilterSchema = z.object({
  entityType: z
    .enum(["all", "professional", "store", "property"])
    .default("all"),
  status: z
    .enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "NEEDS_CORRECTION"])
    .default("PENDING"),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(["submittedAt", "createdAt"]).default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const VerifyEntitySchema = z.object({
  entityType: z.enum(["professional", "store", "property"]),
  entityId: z.string().uuid(),
  action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

export const VerifyDocumentSchema = z.object({
  documentType: z.enum([
    "professional_document",
    "property_attachment",
    "certificate",
  ]),
  documentId: z.string().uuid(),
  action: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().optional(),
});

export const BatchVerifyDocumentsSchema = z.object({
  documents: z.array(
    z.object({
      documentType: z.enum([
        "professional_document",
        "property_attachment",
        "certificate",
      ]),
      documentId: z.string().uuid(),
      action: z.enum(["APPROVE", "REJECT"]),
      notes: z.string().optional(),
    }),
  ),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type SystemSettingsInput = z.infer<typeof SystemSettingsSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type VerificationFilterInput = z.infer<typeof VerificationFilterSchema>;
export type VerifyEntityInput = z.infer<typeof VerifyEntitySchema>;
export type VerifyDocumentInput = z.infer<typeof VerifyDocumentSchema>;
export type BatchVerifyDocumentsInput = z.infer<
  typeof BatchVerifyDocumentsSchema
>;

// ============================================================================
// Validation Functions (for use in server actions)
// ============================================================================

export function parseVerificationFilter(
  input: unknown,
): VerificationFilterInput {
  return VerificationFilterSchema.parse(input);
}

export function parseVerifyEntity(input: unknown): VerifyEntityInput {
  return VerifyEntitySchema.parse(input);
}

export function parseVerifyDocument(input: unknown): VerifyDocumentInput {
  return VerifyDocumentSchema.parse(input);
}

export function parseBatchVerifyDocuments(
  input: unknown,
): BatchVerifyDocumentsInput {
  return BatchVerifyDocumentsSchema.parse(input);
}
