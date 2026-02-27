import { z } from "zod";
import {
  LICENSE_AUTHORITIES,
  LICENSE_AUTHORITY_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORIES,
} from "@build/enums";

// 1. Define Regex Patterns for Kenyan Authorities
const REGEX_PATTERNS = {
  // EARB: Typically "Reg. No. 0000" or just numbers
  EARB: /^(?:Reg\.?\s?No\.?\s?)?\d{3,6}$/i,

  // NCA: Typically "NCA/123/4567" or similar
  NCA: /^NCA\/\d{1,5}\/\d{1,5}$/i,

  // EBK: "A1234" or "B1234" (Graduate/Professional Engineers)
  EBK: /^[A-Z]\d{3,5}$/,

  // BORAQS: "A123" or "QS123"
  BORAQS: /^(?:A|QS|B)\d{3,5}$/i,

  // ERC: "Class C-1", "Class A-1" etc.
  ERC: /^Class\s[A-C]-[1-3]$/i,

  // EPRA: Same as ERC or updated pattern
  EPRA: /^(?:Class\s[A-C]-[1-3]|EPRA\/\d+\/\d+)$/i,

  // VRB: "VRB 123" or just numbers
  VRB: /^(?:VRB\s?|Reg\.?\s?No\.?\s?)?\d{1,6}$/i,

  // NEMA: Matches "NEMA/EIA/5/1234" or "NEMA/WM/1234"
  // Handles variations with varying segment lengths
  NEMA: /^NEMA\/(?:EIA|WM|SPR|EA)\/(?:\d+\/)?\d+$/i,
};

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
/**
 * Document categories that represent verifiable badges/credentials
 */
const BADGE_DOCUMENT_CATEGORIES = [
  "ID_OR_PASSPORT",
  "EDUCATION_CERT",
  "AWARD_OR_RECOGNITION",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
  "CV_OR_RESUME",
  "PORTFOLIO_DOC",
  "NCA_ACCREDITATION",
  "BUSINESS_REGISTRATION",
  "PROFESSIONAL_CERT",
  "OTHER",
] as const satisfies readonly DocumentCategory[];

export type BadgeDocumentCategory = (typeof BADGE_DOCUMENT_CATEGORIES)[number];
// Base Schema ( Common fields for all licenses)
const baseLicenseSchema = z.object({
  expiryDate: z
    .date()
    .min(new Date(), { message: "License has already expired" })
    .optional(), // Optional because some legacy licenses might not show it
  certificateUrl: z
    .string()
    .url({ message: "Please upload a valid certificate image/PDF" }),
});

// Discriminated Union for different license types
export const professionalLicenseSchema = z.discriminatedUnion("authority", [
  // --- REAL ESTATE AGENTS ---
  baseLicenseSchema.extend({
    authority: z.literal("EARB"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.EARB, {
      message:
        "Invalid EARB Licence Number. Format should be 'Reg. No. 12345' or '12345' ",
    }),
  }),
  // --- CONTRACTORS ---
  baseLicenseSchema.extend({
    authority: z.literal("NCA"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.NCA, {
      message:
        "Invalid NCA Licence Number. Format should be 'NCA/123/4567' or similar",
    }),
  }),
  // --- ENGINEERS ---
  baseLicenseSchema.extend({
    authority: z.literal("EBK"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.EBK, {
      message:
        "Invalid EBK Licence Number. Format should be 'A1234' or 'B1234'",
    }),
  }),
  // --- ARCHITECTS & QS ---
  baseLicenseSchema.extend({
    authority: z.literal("BORAQS"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.BORAQS, {
      message:
        "Invalid BORAQS Licence Number. Format should be 'A123' or 'QS123'",
    }),
  }),
  // --- ELECTRICIANS ---
  baseLicenseSchema.extend({
    authority: z.literal("ERC"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.ERC, {
      message:
        "Invalid ERC Licence Number. Format should be 'Class A-1' or 'Class B-2'",
    }),
  }),
  baseLicenseSchema.extend({
    authority: z.literal("EPRA"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.EPRA, {
      message:
        "Invalid EPRA Licence Number. Format should be 'Class A-1' or 'EPRA/123/456'",
    }),
  }),
  // --- VALUERS ---
  baseLicenseSchema.extend({
    authority: z.literal("VRB"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.VRB, {
      message:
        "Invalid VRB Licence Number. Format should be '1234' or 'VRB 1234'",
    }),
  }),
  // --- NEMA ---
  baseLicenseSchema.extend({
    authority: z.literal("NEMA"),
    licenseNumber: z.string().regex(REGEX_PATTERNS.NEMA, {
      message:
        "Invalid NEMA Licence Number. Format should be 'NEMA/EIA/5/1234' or 'NEMA/WM/1234'",
    }),
  }),
]);

export type ProfessionalLicenseInput = z.infer<
  typeof professionalLicenseSchema
>;
