/**
 * Document Types & Schemas
 *
 * This file centralizes all document-related validation schemas for
 * Professional, Store, and Property documents.
 */

import { z } from "zod";
import {
  DOCUMENT_CATEGORIES,
  STORE_DOCUMENT_TYPES,
  PROPERTY_DOCUMENT_TYPES,
} from "@build/enums";

// ============================================================================
// BASE DOCUMENT SCHEMA
// ============================================================================

/**
 * Base schema containing common fields shared among all document types.
 */
export const baseDocumentSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(100, "Title cannot exceed 100 characters")
    .optional(),
  issuer: z.string().max(100, "Issuer cannot exceed 100 characters").optional(),
  issueDate: z.date().optional(),
  expiryDate: z
    .date()
    .min(new Date(), { message: "Document has already expired" })
    .optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  assetId: z.string().min(1, "Document file must be uploaded").optional(), // Keep optional for initial form state, enforce later if needed
  uploadId: z.string().optional(),
  previewUrl: z.string().optional(),
});

// ============================================================================
// PROFESSIONAL DOCUMENTS
// ============================================================================

export const professionalDocumentSchema = baseDocumentSchema.extend({
  category: z.enum(DOCUMENT_CATEGORIES),
});

export type ProfessionalDocumentInput = z.infer<
  typeof professionalDocumentSchema
>;

// ============================================================================
// STORE DOCUMENTS
// ============================================================================

export const storeDocumentSchema = baseDocumentSchema.extend({
  type: z.enum(STORE_DOCUMENT_TYPES),
});

export type StoreDocumentInput = z.infer<typeof storeDocumentSchema>;

// ============================================================================
// PROPERTY DOCUMENTS
// ============================================================================

export const propertyDocumentSchema = baseDocumentSchema.extend({
  type: z.enum(PROPERTY_DOCUMENT_TYPES),
  isPrivate: z.boolean().default(true).optional(),
});

export type PropertyDocumentInput = z.infer<typeof propertyDocumentSchema>;
