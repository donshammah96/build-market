import { z } from "zod";
import {
  DocumentCategory,
  VerificationStatus,
  LicenseAuthority,
} from "@prisma/client";

/**
 * Shared validation schemas for Professional Document & License API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with ProfessionalDocument and ProfessionalLicense models.
 */

// ─── Enum Schemas ────────────────────────────────────────────────────

export const DocumentCategorySchema = z.nativeEnum(DocumentCategory);
export const VerificationStatusSchema = z.nativeEnum(VerificationStatus);
export const LicenseAuthoritySchema = z.nativeEnum(LicenseAuthority);

// ═══════════════════════════════════════════════════════════════════════
// PROFESSIONAL DOCUMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for GET /api/professional-portal/documents */
export const DocumentQuerySchema = z.object({
  category: DocumentCategorySchema.optional(),
  status: VerificationStatusSchema.optional(),
});

export type DocumentQueryInput = z.infer<typeof DocumentQuerySchema>;

/** Body schema for POST /api/professional-portal/documents (Asset-based) */
export const CreateDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: DocumentCategorySchema,
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

/** Body schema for PATCH /api/professional-portal/documents/[id] */
export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: DocumentCategorySchema.optional(),
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/** Prisma select for document list queries (data minimization) */
export const professionalDocumentListSelect = {
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
      cdnUrl: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

/** Prisma select for document detail queries */
export const professionalDocumentDetailSelect = {
  ...professionalDocumentListSelect,
  verifiedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  deletedAt: true,
} as const;

// ═══════════════════════════════════════════════════════════════════════
// PROFESSIONAL LICENSE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /api/professional-portal/licenses */
export const CreateLicenseSchema = z.object({
  authority: LicenseAuthoritySchema,
  licenseNumber: z.string().min(1, "License number is required").max(100),
  category: z.string().max(50).optional(),
  validFrom: z.string().datetime("Valid from date is required"),
  validUntil: z.string().datetime().optional(),
  isAnnualRenewal: z.boolean().optional().default(true),
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
});

export type CreateLicenseInput = z.infer<typeof CreateLicenseSchema>;

/** Body schema for PATCH /api/professional-portal/licenses/[id] */
export const UpdateLicenseSchema = z.object({
  licenseNumber: z.string().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isAnnualRenewal: z.boolean().optional(),
  assetId: z.string().uuid("Asset ID must be a valid UUID").optional(),
});

export type UpdateLicenseInput = z.infer<typeof UpdateLicenseSchema>;

/** Prisma select for license list queries */
export const professionalLicenseListSelect = {
  id: true,
  authority: true,
  licenseNumber: true,
  category: true,
  status: true,
  validFrom: true,
  validUntil: true,
  isAnnualRenewal: true,
  verifiedAt: true,
  verificationMethod: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      cdnUrl: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

/** Prisma select for license detail queries */
export const professionalLicenseDetailSelect = {
  ...professionalLicenseListSelect,
  notes: true,
  verifiedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;
