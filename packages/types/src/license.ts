/**
 * License Types & Constants
 * 
 * This file centralizes all license-related types, constants, and utilities.
 * Import from here instead of defining hardcoded strings throughout the codebase.
 */

import { LicenseAuthority, DocumentCategory } from "@prisma/client";
import { z } from "zod";

// ============================================================================
// CONSTANTS - Regulatory Authorities
// ============================================================================

/**
 * All regulatory authorities that issue professional licenses.
 * These map directly to the Prisma LicenseAuthority enum.
 */
export const REGULATORY_AUTHORITIES = [
  "NCA",      // National Construction Authority (Contractors)
  "EBK",      // Engineers Board of Kenya
  "BORAQS",   // Board of Registration of Architects and Quantity Surveyors
  "EARB",     // Estate Agents Registration Board
  "ERC",      // Energy and Petroleum Regulatory Authority (Electricians)
  "ISK",      // Institution of Surveyors of Kenya
  "NEMA",     // National Environment Management Authority
  "KEBS",     // Kenya Bureau of Standards
  "OTHER",    // Other recognized authorities
] as const satisfies readonly LicenseAuthority[];

/**
 * Type derived from REGULATORY_AUTHORITIES for type-safe iteration
 */
export type RegulatoryAuthority = typeof REGULATORY_AUTHORITIES[number];

/**
 * Document categories that represent verifiable badges/credentials
 */
export const BADGE_DOCUMENT_CATEGORIES = [
  "INSURANCE_POLICY",
  "ID_OR_PASSPORT",
  "TAX_COMPLIANCE",
] as const satisfies readonly DocumentCategory[];

export type BadgeDocumentCategory = typeof BADGE_DOCUMENT_CATEGORIES[number];

// ============================================================================
// AUTHORITY METADATA - Display names, descriptions, icons
// ============================================================================

export interface AuthorityMetadata {
  code: LicenseAuthority;
  name: string;
  fullName: string;
  description: string;
  website?: string;
  /** The professions this authority typically regulates */
  applicableProfessions?: string[];
}

export const AUTHORITY_METADATA: Record<RegulatoryAuthority, AuthorityMetadata> = {
  NCA: {
    code: "NCA",
    name: "NCA",
    fullName: "National Construction Authority",
    description: "Regulates contractors and construction firms in Kenya",
    website: "https://nca.go.ke",
    applicableProfessions: ["GENERAL_CONTRACTOR", "MASON", "CARPENTER", "PAINTER"],
  },
  EBK: {
    code: "EBK",
    name: "EBK",
    fullName: "Engineers Board of Kenya",
    description: "Registers and regulates professional engineers",
    website: "https://ebk.go.ke",
    applicableProfessions: ["STRUCTURAL_ENGINEER", "CIVIL_ENGINEER", "MECHANICAL_ENGINEER", "ELECTRICAL_ENGINEER"],
  },
  BORAQS: {
    code: "BORAQS",
    name: "BORAQS",
    fullName: "Board of Registration of Architects and Quantity Surveyors",
    description: "Registers architects and quantity surveyors",
    website: "https://boraqs.or.ke",
    applicableProfessions: ["ARCHITECT", "QUANTITY_SURVEYOR"],
  },
  EARB: {
    code: "EARB",
    name: "EARB",
    fullName: "Estate Agents Registration Board",
    description: "Regulates real estate agents and property valuers",
    website: "https://earb.go.ke",
    applicableProfessions: ["REAL_ESTATE_VALUER"],
  },
  ERC: {
    code: "ERC",
    name: "ERC",
    fullName: "Energy and Petroleum Regulatory Authority",
    description: "Licenses electricians and electrical contractors",
    website: "https://epra.go.ke",
    applicableProfessions: ["ELECTRICIAN", "SOLAR_ENERGY_TECHNICIAN"],
  },
  ISK: {
    code: "ISK",
    name: "ISK",
    fullName: "Institution of Surveyors of Kenya",
    description: "Professional body for land surveyors",
    website: "https://isk.or.ke",
    applicableProfessions: ["LAND_SURVEYOR"],
  },
  NEMA: {
    code: "NEMA",
    name: "NEMA",
    fullName: "National Environment Management Authority",
    description: "Issues environmental impact assessment licenses",
    website: "https://nema.go.ke",
    applicableProfessions: ["URBAN_PLANNER", "LANDSCAPE_ARCHITECT"],
  },
  KEBS: {
    code: "KEBS",
    name: "KEBS",
    fullName: "Kenya Bureau of Standards",
    description: "Standards and quality control",
    website: "https://kebs.org",
    applicableProfessions: [],
  },
  OTHER: {
    code: "OTHER",
    name: "Other",
    fullName: "Other Authority",
    description: "Other recognized regulatory body",
    website: "",
    applicableProfessions: [],
  },
};

// ============================================================================
// LICENSE NUMBER REGEX PATTERNS
// ============================================================================

/**
 * Regex patterns for validating license numbers by authority.
 * These are used for client-side and server-side validation.
 */
export const LICENSE_REGEX_PATTERNS: Record<RegulatoryAuthority, RegExp> = {
  // EARB: "Reg. No. 0000" or just numbers
  EARB: /^(?:Reg\.?\s?No\.?\s?)?\d{3,6}$/i,
  // NCA: "NCA/123/4567" format
  NCA: /^NCA\/\d{1,5}\/\d{1,5}$/i,
  // EBK: "A1234" or "B1234" (Graduate/Professional Engineers)
  EBK: /^[A-Z]\d{3,5}$/,
  // BORAQS: "A123" or "QS123"
  BORAQS: /^(?:A|QS|B)\d{3,5}$/i,
  // ERC: "Class C-1", "Class A-1" etc.
  ERC: /^Class\s[A-C]-[1-3]$/i,
  // NEMA: "NEMA/EIA/5/1234" or "NEMA/WM/1234"
  NEMA: /^NEMA\/(?:EIA|WM|SPR|EA)\/(?:\d+\/)?\d+$/i,
  // ISK: Generic pattern (adjust as needed)
  ISK: /^ISK\/\d{3,6}$/i,
  // KEBS: Generic alphanumeric
  KEBS: /^[A-Z0-9-\/]{3,20}$/i,
  // OTHER: Allow most formats
  OTHER: /^[A-Z0-9-\/\s.]{3,30}$/i,
};

/**
 * Error messages for invalid license numbers
 */
export const LICENSE_ERROR_MESSAGES: Record<RegulatoryAuthority, string> = {
  EARB: "Invalid EARB License Number. Format: 'Reg. No. 12345' or '12345'",
  NCA: "Invalid NCA License Number. Format: 'NCA/123/4567'",
  EBK: "Invalid EBK License Number. Format: 'A1234' or 'B1234'",
  BORAQS: "Invalid BORAQS License Number. Format: 'A123' or 'QS123'",
  ERC: "Invalid ERC License Number. Format: 'Class A-1' or 'Class B-2'",
  NEMA: "Invalid NEMA License Number. Format: 'NEMA/EIA/5/1234'",
  ISK: "Invalid ISK License Number. Format: 'ISK/123456'",
  KEBS: "Invalid KEBS License Number.",
  OTHER: "Invalid License Number format.",
};

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Base schema for all license types
 */
export const baseLicenseSchema = z.object({
  expiryDate: z.date()
    .min(new Date(), { message: "License has already expired" })
    .optional(),
  certificateUrl: z.string().url({ message: "Please upload a valid certificate image/PDF" }),
});

/**
 * Create a license schema for a specific authority
 */
const createLicenseSchema = (authority: RegulatoryAuthority) =>
  baseLicenseSchema.extend({
    authority: z.literal(authority),
    licenseNumber: z.string().regex(
      LICENSE_REGEX_PATTERNS[authority],
      { message: LICENSE_ERROR_MESSAGES[authority] }
    ),
  });

/**
 * Discriminated union of all license types
 */
export const professionalLicenseSchema = z.discriminatedUnion("authority", [
  createLicenseSchema("EARB"),
  createLicenseSchema("NCA"),
  createLicenseSchema("EBK"),
  createLicenseSchema("BORAQS"),
  createLicenseSchema("ERC"),
  createLicenseSchema("NEMA"),
  createLicenseSchema("ISK"),
  createLicenseSchema("KEBS"),
  createLicenseSchema("OTHER"),
]);

export type ProfessionalLicenseInput = z.infer<typeof professionalLicenseSchema>;

// ============================================================================
// BADGE KEY GENERATION
// ============================================================================

/**
 * Map of authority to badge key name for UI display
 */
export const AUTHORITY_BADGE_MAP: Record<RegulatoryAuthority, string> = {
  NCA: "isNcaVerified",
  EARB: "isEarbVerified",
  EBK: "isEbkVerified",
  BORAQS: "isBoraqsVerified",
  ERC: "isErcVerified",
  NEMA: "isNemaVerified",
  ISK: "isIskVerified",
  KEBS: "isKebsVerified",
  OTHER: "isOtherVerified",
};

/**
 * Map of document category to badge key name
 */
export const DOCUMENT_BADGE_MAP: Record<string, string> = {
  INSURANCE_POLICY: "isInsured",
  ID_OR_PASSPORT: "isIdVerified",
  TAX_COMPLIANCE: "isTaxCompliant",
};

// ============================================================================
// PROFESSIONAL BADGES INTERFACE
// ============================================================================

/**
 * Interface representing all verification badges for a professional profile.
 * Used in UI components to display verification status.
 */
export interface ProfessionalBadges {
  // License-based verifications
  isNcaVerified: boolean;
  isEarbVerified: boolean;
  isEbkVerified: boolean;
  isBoraqsVerified: boolean;
  isErcVerified: boolean;
  isNemaVerified: boolean;
  isIskVerified: boolean;
  isKebsVerified: boolean;
  isOtherVerified: boolean;
  
  // Document-based verifications
  isInsured: boolean;
  isIdVerified: boolean;
  isTaxCompliant: boolean;
  
  // Overall profile verification
  isVerified: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a license is valid for a given authority
 */
export function hasValidLicense(
  licenses: { authority: string; status?: string; validUntil?: Date | null }[],
  authority: RegulatoryAuthority
): boolean {
  return licenses.some((l) => {
    const isVerified = l.status === "VERIFIED";
    const notExpired = !l.validUntil || new Date(l.validUntil) > new Date();
    return l.authority === authority && isVerified && notExpired;
  });
}

/**
 * Check if a document category is verified
 */
export function hasVerifiedDocument(
  documents: { category: string; status?: string }[],
  category: BadgeDocumentCategory | string
): boolean {
  return documents.some((d) => d.category === category && d.status === "VERIFIED");
}

/**
 * Generate all license verification badges for a professional
 */
export function generateLicenseBadges(
  licenses: { authority: string; status?: string; validUntil?: Date | null }[]
): Record<string, boolean> {
  return Object.fromEntries(
    REGULATORY_AUTHORITIES.map((auth) => [
      AUTHORITY_BADGE_MAP[auth],
      hasValidLicense(licenses, auth),
    ])
  );
}

/**
 * Generate all document verification badges for a professional
 */
export function generateDocumentBadges(
  documents: { category: string; status?: string }[]
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(DOCUMENT_BADGE_MAP).map(([category, badgeKey]) => [
      badgeKey,
      hasVerifiedDocument(documents, category),
    ])
  );
}

/**
 * Get metadata for a specific authority
 */
export function getAuthorityMetadata(authority: RegulatoryAuthority): AuthorityMetadata {
  return AUTHORITY_METADATA[authority];
}

/**
 * Validate a license number for a given authority
 */
export function validateLicenseNumber(
  authority: RegulatoryAuthority,
  licenseNumber: string
): { valid: boolean; error?: string } {
  const pattern = LICENSE_REGEX_PATTERNS[authority];
  if (pattern.test(licenseNumber)) {
    return { valid: true };
  }
  return { valid: false, error: LICENSE_ERROR_MESSAGES[authority] };
}
