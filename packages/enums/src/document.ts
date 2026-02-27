/**
 * Document domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// DocumentCategory
// -------------------------------------------------------------------------

export const DOCUMENT_CATEGORIES = [
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
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ID_OR_PASSPORT: "Identity Document (ID/Passport)",
  EDUCATION_CERT: "Degree / Diploma",
  AWARD_OR_RECOGNITION: "Award or Recognition",
  TAX_COMPLIANCE: "Tax Compliance Certificate (KRA TCC)",
  KRA_TAX_COMPLIANCE: "Tax Compliance Certificate (KRA TCC)",
  INSURANCE_POLICY: "Professional Indemnity Insurance",
  CV_OR_RESUME: "CV or Resume",
  PORTFOLIO_DOC: "Portfolio Document",
  NCA_ACCREDITATION: "NCA Accreditation",
  BUSINESS_REGISTRATION: "Business Registration",
  PROFESSIONAL_CERT: "Professional Certificate",
  OTHER: "Other",
};

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return (
    typeof value === "string" &&
    (DOCUMENT_CATEGORIES as readonly string[]).includes(value)
  );
}
