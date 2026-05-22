import { z } from "zod";
import { DocumentCategory, VerificationStatus } from "@prisma/client";

/**
 * Validation schemas for the Certificates convenience API.
 *
 * Certificates are a category-scoped view over ProfessionalDocument,
 * restricted to EDUCATION_CERT and AWARD_OR_RECOGNITION categories.
 * The old `Certificate` model was migrated into `ProfessionalDocument`.
 */

// ─── Constants ───────────────────────────────────────────────────────

/** DocumentCategory values that represent certificates */
export const CERTIFICATE_CATEGORIES: DocumentCategory[] = [
  "EDUCATION_CERT",
  "AWARD_OR_RECOGNITION",
];

// ─── Enum Schemas ────────────────────────────────────────────────────

/** Only allows certificate-type document categories */
export const CertificateCategorySchema = z.enum([
  "EDUCATION_CERT",
  "AWARD_OR_RECOGNITION",
]);

export const VerificationStatusSchema = z.nativeEnum(VerificationStatus);

// ═══════════════════════════════════════════════════════════════════════
// QUERY & MUTATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for GET /api/professional-portal/certificates */
export const CertificateQuerySchema = z.object({
  category: CertificateCategorySchema.optional(),
  status: VerificationStatusSchema.optional(),
});

export type CertificateQueryInput = z.infer<typeof CertificateQuerySchema>;

/**
 * Body schema for POST /api/professional-portal/certificates.
 * Uses Asset-based storage (aligned with ProfessionalDocument model).
 */
export const CreateCertificateSchema = z.object({
  title: z
    .string()
    .min(1, "Certificate title is required")
    .max(200, "Title cannot exceed 200 characters"),
  category: CertificateCategorySchema.default("EDUCATION_CERT"),
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type CreateCertificateInput = z.infer<typeof CreateCertificateSchema>;

/** Body schema for PATCH /api/professional-portal/certificates/[id] */
export const UpdateCertificateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: CertificateCategorySchema.optional(),
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type UpdateCertificateInput = z.infer<typeof UpdateCertificateSchema>;

// ═══════════════════════════════════════════════════════════════════════
// PRISMA SELECT OBJECTS (Data Minimization)
// ═══════════════════════════════════════════════════════════════════════

/** Prisma select for certificate list queries */
export const certificateListSelect = {
  id: true,
  category: true,
  title: true,
  issuer: true,
  issueDate: true,
  expiryDate: true,
  status: true,
  verifiedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      visibility: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

/** Prisma select for certificate detail queries */
export const certificateDetailSelect = {
  ...certificateListSelect,
  verifiedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  deletedAt: true,
} as const;
