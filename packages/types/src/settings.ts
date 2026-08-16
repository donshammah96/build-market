import { z } from "zod";

// =============================================================================
// Constants & Defaults
// =============================================================================

export const DEFAULT_VERIFICATION_RULES = {
  requiredLicenses: {
    ARCHITECT: ["BORAQS"],
    INTERIOR_DESIGNER: [],
    LANDSCAPE_ARCHITECT: ["BORAQS"],
    URBAN_PLANNER: [],
    STRUCTURAL_ENGINEER: ["EBK"],
    CIVIL_ENGINEER: ["EBK"],
    MECHANICAL_ENGINEER: ["EBK"],
    ELECTRICAL_ENGINEER: ["EBK"],
    QUANTITY_SURVEYOR: ["BORAQS"],
    LAND_SURVEYOR: ["ISK"],
    REAL_ESTATE_VALUER: ["VRB"],
    REAL_ESTATE_AGENT: ["EARB"],
    GENERAL_CONTRACTOR: ["NCA"],
    MASON: ["NCA_ACCREDITATION"],
    ELECTRICIAN: ["EPRA"],
    PLUMBER: ["NCA_ACCREDITATION"],
    CARPENTER: ["NCA_ACCREDITATION"],
    JOINER: ["NCA_ACCREDITATION"],
    PAINTER: ["NCA_ACCREDITATION"],
    WELDER: ["NCA_ACCREDITATION"],
    GLAZIER: ["NCA_ACCREDITATION"],
    ROOFER: ["NCA_ACCREDITATION"],
    STEEL_FIXER: ["NCA_ACCREDITATION"],
    FLOORING_SPECIALIST: ["NCA_ACCREDITATION"],
    PLASTERER: ["NCA_ACCREDITATION"],
    HVAC_TECHNICIAN: ["NCA_ACCREDITATION"],
    SOLAR_ENERGY_TECHNICIAN: ["EPRA"],
    BOREHOLE_DRILLER: ["NCA_ACCREDITATION"],
    CCTV_AND_SECURITY_PRO: [],
    INTERNET_AND_NETWORK_PRO: [],
    PROJECT_MANAGER: [],
    CLERK_OF_WORKS: [],
    MATERIAL_SUPPLIER: [],
    EQUIPMENT_RENTER: [],
    OTHER: [],
  },
  requiredDocuments: {
    ARCHITECT: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    INTERIOR_DESIGNER: [
      "ID_OR_PASSPORT",
      "KRA_TAX_COMPLIANCE",
      "PORTFOLIO_DOC",
    ],
    LANDSCAPE_ARCHITECT: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    URBAN_PLANNER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    STRUCTURAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    CIVIL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    MECHANICAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    ELECTRICAL_ENGINEER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    QUANTITY_SURVEYOR: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    LAND_SURVEYOR: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    REAL_ESTATE_VALUER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    REAL_ESTATE_AGENT: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    GENERAL_CONTRACTOR: [
      "ID_OR_PASSPORT",
      "KRA_TAX_COMPLIANCE",
      "BUSINESS_REGISTRATION",
    ],
    MASON: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    ELECTRICIAN: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    PLUMBER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    CARPENTER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    JOINER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    PAINTER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    WELDER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    GLAZIER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    ROOFER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    STEEL_FIXER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    FLOORING_SPECIALIST: [
      "ID_OR_PASSPORT",
      "NCA_ACCREDITATION",
      "KRA_TAX_COMPLIANCE",
    ],
    PLASTERER: ["ID_OR_PASSPORT", "NCA_ACCREDITATION", "KRA_TAX_COMPLIANCE"],
    HVAC_TECHNICIAN: [
      "ID_OR_PASSPORT",
      "NCA_ACCREDITATION",
      "KRA_TAX_COMPLIANCE",
    ],
    SOLAR_ENERGY_TECHNICIAN: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    BOREHOLE_DRILLER: [
      "ID_OR_PASSPORT",
      "NCA_ACCREDITATION",
      "KRA_TAX_COMPLIANCE",
    ],
    CCTV_AND_SECURITY_PRO: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    INTERNET_AND_NETWORK_PRO: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    PROJECT_MANAGER: [
      "ID_OR_PASSPORT",
      "KRA_TAX_COMPLIANCE",
      "PROFESSIONAL_CERT",
    ],
    CLERK_OF_WORKS: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    MATERIAL_SUPPLIER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    EQUIPMENT_RENTER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
    OTHER: ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"],
  },
  requiredStoreDocuments: [
    "BUSINESS_REGISTRATION",
    "KRA_PIN_CERTIFICATE",
    "KRA_TAX_COMPLIANCE",
    "ID_OR_PASSPORT",
    "LEASE_OR_OWNERSHIP",
    "TRADING_LICENSE",
    "OTHER",
  ],
  requiredPropertyDocuments: [
    "TITLE_DEED",
    "OFFICIAL_SEARCH",
    "ID_OR_PASSPORT",
    "LAND_RENT_CLEARANCE",
    "LAND_RATES_COMPLIANCE",
    "MUTATION_FORM",
    "SECTIONAL_PROPERTIES_ACT_DOC",
    "OTHER",
  ],
  maxUploadAttempts: 3,
  maxDocumentsPerProfessional: 50,
  maxDocumentsPerStore: 20,
  maxDocumentsPerProperty: 15,
  autoRejectAfterDays: 30,
  urgentPendingThresholdHours: 48,
  escalationThresholdHours: 72,
  validityPeriodDays: 365,
  documentQuality: {
    maxFileSizeMB: 10,
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    minPortfolioProjects: 3,
    minStoreProducts: 10,
    minPropertyImages: 5,
  },
  rejectionReasonCodes: [
    "EXPIRED_DOCUMENT",
    "POOR_QUALITY",
    "INFO_MISMATCH",
    "MISSING_REQUIRED",
    "SUSPICIOUS",
    "INCOMPLETE_PROFILE",
    "INVALID_ISSUING_AUTHORITY",
  ],
  version: "1.0",
};

export const DEFAULT_PUBLIC_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: null,
  allowedIPs: [] as string[],
  publicSignup: true,
  allowProfessionalSignup: true,
  featureFlags: {},
  verificationRules: DEFAULT_VERIFICATION_RULES,
  supportEmail: "support@buildmarket.app",
  supportPhone: "+254798798770",
  whatsappNumber: "+254798798770",
};

export const DEFAULT_FINANCIAL_SETTINGS = {
  platformCommission: 5,
  vatRate: 16,
  withholdingTaxRate: 5,
  minWithdrawalKes: 1000,
  maxWithdrawalKes: 150000,
  currency: "KES",
};

// =============================================================================
// Zod Schemas
// =============================================================================

export const FeatureFlagsSchema = z.record(z.string(), z.unknown());

export const DocumentQualitySchema = z.object({
  maxFileSizeMB: z.coerce.number().default(10),
  allowedMimeTypes: z
    .array(z.string())
    .default(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  minPortfolioProjects: z.coerce.number().default(3),
  minStoreProducts: z.coerce.number().default(10),
  minPropertyImages: z.coerce.number().default(5),
});

const fastMergeDefaults = <T extends Record<string, string[]>>(
  defaults: T,
  val: Record<string, string[]>,
): T => {
  return Object.assign({}, defaults, val) as T;
};

export const VerificationRulesSchema = z.object({
  requiredLicenses: z
    .record(z.string(), z.array(z.string()))
    .catch({})
    .transform((val) =>
      fastMergeDefaults(
        DEFAULT_VERIFICATION_RULES.requiredLicenses as Record<string, string[]>,
        val,
      ),
    ),
  requiredDocuments: z
    .record(z.string(), z.array(z.string()))
    .catch({})
    .transform((val) =>
      fastMergeDefaults(
        DEFAULT_VERIFICATION_RULES.requiredDocuments as Record<
          string,
          string[]
        >,
        val,
      ),
    ),
  requiredStoreDocuments: z.array(z.string()).optional(),
  requiredPropertyDocuments: z.array(z.string()).optional(),
  maxUploadAttempts: z.coerce.number().default(3),
  maxDocumentsPerProfessional: z.coerce.number().default(50),
  maxDocumentsPerStore: z.coerce.number().default(20),
  maxDocumentsPerProperty: z.coerce.number().default(15),
  autoRejectAfterDays: z.coerce.number().default(30),
  urgentPendingThresholdHours: z.coerce.number().default(48),
  escalationThresholdHours: z.coerce.number().default(72),
  validityPeriodDays: z.coerce.number().default(365),
  documentQuality: DocumentQualitySchema.optional(),
  rejectionReasonCodes: z.array(z.string()).optional(),
  version: z.string().default("1.0"),
});

export const PublicSettingsSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().nullable().default(null),
  allowedIPs: z.array(z.string()).default([]),
  publicSignup: z.boolean().default(true),
  allowProfessionalSignup: z.boolean().default(true),
  featureFlags: FeatureFlagsSchema.default({}),
  verificationRules: VerificationRulesSchema.default(
    DEFAULT_VERIFICATION_RULES as any,
  ),
  supportEmail: z.string().default("support@buildmarket.app"),
  supportPhone: z.string().nullable().default("+254798798770"),
  whatsappNumber: z.string().nullable().default("+254798798770"),
});

export const FinancialSettingsSchema = z.object({
  platformCommission: z.coerce.number().default(5),
  vatRate: z.coerce.number().default(16),
  withholdingTaxRate: z.coerce.number().default(5),
  minWithdrawalKes: z.coerce.number().default(1000),
  maxWithdrawalKes: z.coerce.number().default(150000),
  currency: z.string().default("KES"),
});

export const SystemSettingsSchema = PublicSettingsSchema.merge(
  FinancialSettingsSchema,
);

// =============================================================================
// Type Definitions
// =============================================================================

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type VerificationRules = z.infer<typeof VerificationRulesSchema>;
export type PublicSettings = z.infer<typeof PublicSettingsSchema>;
export type FinancialSettings = z.infer<typeof FinancialSettingsSchema>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;

