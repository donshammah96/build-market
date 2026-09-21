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
  errorDetails?: AdminActionError;
  /** Timestamp for cache invalidation in optimistic updates */
  timestamp?: string;
  meta?: PaginationMeta;
};

export type AdminActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_STALE"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "ACTION_FAILED";

export type AdminActionError = {
  code: AdminActionErrorCode;
  message: string;
  action?: string;
  retryAfterMs?: number;
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

export type EntityType = "professional" | "store" | "property" | "license";
export type VerificationAction = "VERIFY" | "REJECT" | "REQUEST_CORRECTION";
export type DocumentAction = "APPROVE" | "REJECT";
export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_CORRECTION"
  | "EXPIRED"
  | "SUSPENDED";

export type VerificationPersonSummary = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type ProfessionalEntityDetail = {
  companyName?: string | null;
  profession?: string | null;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  city?: string | null;
  county?: string | null;
  website?: string | null;
  bio?: string | null;
  description?: string | null;
  user?: VerificationPersonSummary;
  [key: string]: unknown;
};

export type StoreEntityDetail = {
  name?: string | null;
  storeType?: string | null;
  city?: string | null;
  county?: string | null;
  address?: string | null;
  description?: string | null;
  owner?: VerificationPersonSummary;
  professional?: { user?: VerificationPersonSummary };
  _count?: {
    products?: number;
    orders?: number;
    reviews?: number;
  };
  [key: string]: unknown;
};

export type PropertyEntityDetail = {
  title?: string | null;
  type?: string | null;
  category?: string | null;
  price?: number | string | null;
  location?: string | null;
  county?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  size?: number | null;
  bio?: string | null;
  description?: string | null;
  owner?: VerificationPersonSummary;
  agent?: { user?: VerificationPersonSummary };
  [key: string]: unknown;
};

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
  documentCount?: number | undefined;
  certificateCount?: number | undefined;
  productCount?: number | undefined;
  attachmentCount?: number | undefined;
  imageCount?: number | undefined;
  // Location info
  city?: string | null | undefined;
  county?: string | null | undefined;
  location?: string | undefined;
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
  period?: "today" | "week" | "month" | "all" | undefined;
}

type VerificationDetailsBase = {
  entityId: string;
  status: VerificationStatus;
  verifiedAt?: string | undefined;
  verifiedBy?:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      }
    | undefined;
  verificationNotes?: string | undefined;
  rejectionReason?: string | undefined;
  submittedAt?: string | undefined;
  documents?:
    | Array<{
        id: string;
        type: string;
        fileUrl: string;
        isVerified: boolean;
        verifiedAt?: string | undefined;
        notes?: string | undefined;
      }>
    | undefined;
  auditHistory?:
    | Array<{
        id: string;
        action: string;
        oldStatus: string;
        newStatus: string;
        reason?: string | undefined;
        createdAt: string;
        admin: {
          firstName: string;
          lastName: string;
        };
      }>
    | undefined;
};

export type VerificationDetails =
  | (VerificationDetailsBase & {
      entityType: "professional";
      entity: ProfessionalEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "store";
      entity: StoreEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "property";
      entity: PropertyEntityDetail;
    });

// ============================================================================
// Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(10),
  search: z.string().optional(),
});

export const UpdateProfileSchema = z
  .object({
    companyName: z.string().min(2).optional(),
    licenseNumber: z.string().optional(),
    yearsExperience: z.number().min(0).optional(),
    bio: z.string().max(1000).optional(),
    website: z.string().url().optional().or(z.literal("")),
    servicesOffered: z.array(z.string()).optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    country: z.string().optional(),
  })
  .strict();

export const SystemSettingsSchema = z
  .object({
    maintenanceMode: z.boolean(),
    publicSignup: z.boolean(),
    enableAutoVerifyNCA: z.boolean(),
    enableAutoVerifyEPRA: z.boolean(),
    enableAutoVerifyBORAQS: z.boolean(),
    enableAutoVerifyEBK: z.boolean(),
    enableAutoVerifyEARB: z.boolean(),
    enableAutoVerifyVRB: z.boolean(),
    enableAutoVerifyISK: z.boolean(),

    enforceProfessionalLicenses: z.boolean(),
    enforcePropertyDocuments: z.boolean(),
    enableLandRegistryCheck: z.boolean(),
    enforceStorePermits: z.boolean(),
    requireTaxCompliance: z.boolean(),
    platformCommission: z.number().min(0).max(100),
    supportEmail: z.string().email(),
    adminEmailAlerts: z.boolean(),
    securityMFA: z.boolean(),
  })
  .strict();

// ============================================================================
// Verification Schemas
// ============================================================================

export const VerificationFilterSchema = z.object({
  entityType: z
    .enum(["all", "professional", "store", "property", "license"])
    .default("all"),
  status: z
    .enum([
      "UNVERIFIED",
      "PENDING",
      "VERIFIED",
      "REJECTED",
      "NEEDS_CORRECTION",
      "EXPIRED",
      "SUSPENDED",
    ])
    .default("PENDING"),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(20),
  sortBy: z.enum(["submittedAt", "createdAt"]).default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const VerifyEntitySchema = z.object({
  entityType: z.enum(["professional", "store", "property", "license"]),
  entityId: z.string().uuid(),
  action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

export const VerifyLicenseSchema = z.object({
  licenseId: z.string().uuid(),
  action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

const DocumentTypeSchema = z
  .enum([
    "professional_document",
    "property_document",
    "property_attachment",
    "certificate",
  ])
  .transform((value) =>
    value === "property_attachment" ? "property_document" : value,
  );

export const VerifyDocumentSchema = z
  .object({
    documentType: DocumentTypeSchema,
    documentId: z.string().uuid(),
    action: z.enum(["APPROVE", "REJECT"]),
    notes: z.string().optional(),
  })
  .strict();

export const BatchVerifyDocumentsSchema = z
  .object({
    documents: z
      .array(
        z
          .object({
            documentType: DocumentTypeSchema,
            documentId: z.string().uuid(),
            action: z.enum(["APPROVE", "REJECT"]),
            notes: z.string().optional(),
          })
          .strict(),
      )
      .min(1, "At least one document is required"),
  })
  .strict();

// ============================================================================
// Inferred Types
// ============================================================================

export type SystemSettingsInput = z.infer<typeof SystemSettingsSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type VerificationFilterInput = z.infer<typeof VerificationFilterSchema>;
export type VerifyEntityInput = z.infer<typeof VerifyEntitySchema>;
export type VerifyLicenseInput = z.infer<typeof VerifyLicenseSchema>;
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
  const result = VerificationFilterSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Invalid verification filters",
    );
  }

  return result.data;
}

export function parseVerifyEntity(input: unknown): VerifyEntityInput {
  const result = VerifyEntitySchema.strict().safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Invalid verification payload",
    );
  }

  return result.data;
}

export function parseVerifyLicense(input: unknown): VerifyLicenseInput {
  const result = VerifyLicenseSchema.strict().safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Invalid license verification payload",
    );
  }

  return result.data;
}

export function parseVerifyDocument(input: unknown): VerifyDocumentInput {
  const result = VerifyDocumentSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ??
        "Invalid document verification payload",
    );
  }

  return result.data;
}

export function parseBatchVerifyDocuments(
  input: unknown,
): BatchVerifyDocumentsInput {
  const result = BatchVerifyDocumentsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ??
        "Invalid batch document verification payload",
    );
  }

  return result.data;
}

// ============================================================================
// Onboarding Remediation Types
// ============================================================================

export type AdminOnboardingReconciliationResult = {
  userId: string;
  clerkId: string;
  db: {
    role: string | null;
    status: string | null;
    isOnboarded: boolean | null;
    isProfileComplete: boolean | null;
  };
  clerk: {
    role: string | null;
    status: string | null;
    isOnboarded: boolean | null;
    isProfileComplete: boolean | null;
  };
  mismatches: Array<"role" | "status" | "isOnboarded" | "isProfileComplete">;
  inSync: boolean;
  pendingOnboardingIdempotencyKeys: number;
};

export type AdminOnboardingClerkSyncResult = {
  userId: string;
  clerkId: string;
  metadata: {
    role: string;
    isOnboarded: true;
    status?: string;
    isProfileComplete?: true;
  };
  synced: true;
};

export type AdminOnboardingIdempotencyReconcileResult = {
  key: string;
  scope: string;
  previousStatus: "PENDING";
  currentStatus: "FAILED";
  reconciled: true;
};
