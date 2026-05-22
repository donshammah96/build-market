/**
 * System Settings Service
 *
 * Provides cached access to SystemSettings from the database.
 * Uses Zod for runtime validation and type inference.
 * Implements a Singleton pattern for efficient caching.
 */
import { z } from "zod";
import { prisma } from "./prisma";
import { Profession } from "@prisma/client";

// =============================================================================
// Constants & Defaults
// =============================================================================

// Define defaults FIRST to avoid circular dependency in Zod schemas
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
  allowedIPs: [],
  publicSignup: true,
  allowProfessionalSignup: true,
  featureFlags: {},
  verificationRules: DEFAULT_VERIFICATION_RULES,
  supportEmail: "support@buildmarket.co.ke",
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

const FeatureFlagsSchema = z.record(z.string(), z.unknown());

const DocumentQualitySchema = z.object({
  maxFileSizeMB: z.coerce.number().default(10),
  allowedMimeTypes: z
    .array(z.string())
    .default(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  minPortfolioProjects: z.coerce.number().default(3),
  minStoreProducts: z.coerce.number().default(10),
  minPropertyImages: z.coerce.number().default(5),
});

// Helper: Fast object merge using Object.assign instead of object spread,
// avoiding z.preprocess(). Runs after basic type checking.
const fastMergeDefaults = <T extends Record<string, string[]>>(
  defaults: T,
  val: Record<string, string[]>,
): T => {
  return Object.assign({}, defaults, val) as T;
};

const VerificationRulesSchema = z.object({
  // Use z.record(z.string(), ...) to avoid the nativeEnum key reflection overhead.
  // Use .catch() or .transform() to apply defaults instantly.
  requiredLicenses: z
    .record(z.string(), z.array(z.string()))
    .catch({})
    .transform((val) =>
      fastMergeDefaults(
        DEFAULT_VERIFICATION_RULES.requiredLicenses as any,
        val,
      ),
    ),
  requiredDocuments: z
    .record(z.string(), z.array(z.string()))
    .catch({})
    .transform((val) =>
      fastMergeDefaults(
        DEFAULT_VERIFICATION_RULES.requiredDocuments as any,
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

const PublicSettingsSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().nullable().default(null),
  allowedIPs: z.array(z.string()).default([]),
  publicSignup: z.boolean().default(true),
  allowProfessionalSignup: z.boolean().default(true),
  featureFlags: FeatureFlagsSchema.default({}),
  verificationRules: VerificationRulesSchema.default(
    DEFAULT_VERIFICATION_RULES as any,
  ),
  supportEmail: z.string().default("support@buildmarket.co.ke"),
  supportPhone: z.string().nullable().default("+254798798770"),
  whatsappNumber: z.string().nullable().default("+254798798770"),
});

const FinancialSettingsSchema = z.object({
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
// Type Definitions (Inferred from Zod)
// =============================================================================

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type VerificationRules = z.infer<typeof VerificationRulesSchema>;
export type PublicSettings = z.infer<typeof PublicSettingsSchema>;
export type FinancialSettings = z.infer<typeof FinancialSettingsSchema>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;

// Document Types (kept as manual types for now as they are Enums/Unions)
export type ProfessionalDocumentType =
  | "ID_OR_PASSPORT"
  | "KRA_TAX_COMPLIANCE"
  | "EDUCATION_CERT"
  | "PORTFOLIO_DOC"
  | "NCA_LICENSE"
  | "NCA_ACCREDITATION"
  | "EBK_LICENSE"
  | "BORAQS_LICENSE"
  | "EPRA_LICENSE"
  | "VRB_LICENSE"
  | "ISK_LICENSE"
  | "INSURANCE_POLICY"
  | "BUSINESS_REGISTRATION"
  | "PROFESSIONAL_CERT"
  | "OTHER";

export type StoreDocumentType =
  | "BUSINESS_REGISTRATION"
  | "KRA_TAX_COMPLIANCE"
  | "KRA_PIN_CERTIFICATE"
  | "ID_OR_PASSPORT"
  | "LEASE_OR_OWNERSHIP"
  | "TRADING_LICENSE"
  | "OTHER";

export type PropertyDocumentType =
  | "TITLE_DEED"
  | "OFFICIAL_SEARCH"
  | "ID_OR_PASSPORT"
  | "SALE_AGREEMENT"
  | "LAND_RENT_CLEARANCE"
  | "LAND_RATES_COMPLIANCE"
  | "MUTATION_FORM"
  | "SECTIONAL_PROPERTIES_ACT_DOC"
  | "OTHER";

// =============================================================================
// Service Implementation
// =============================================================================

class SystemSettingsService {
  private static instance: SystemSettingsService;

  // Cache all pre-parsed forms to avoid Zod overhead on repeated getter calls
  private cache: {
    full: SystemSettings;
    publicParsed: PublicSettings;
    financialParsed: FinancialSettings;
    timestamp: number;
    /** True when the entry was populated from hardcoded defaults due to a DB failure. */
    fromFallback: boolean;
  } | null = null;

  private readonly CACHE_TTL_MS = 60_000; // 60 seconds
  private pendingRequest: Promise<SystemSettings> | null = null;

  private constructor() {}

  public static getInstance(): SystemSettingsService {
    if (!SystemSettingsService.instance) {
      SystemSettingsService.instance = new SystemSettingsService();
    }
    return SystemSettingsService.instance;
  }

  public invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Returns true when the last successful settings fetch fell back to
   * hardcoded defaults due to a database connectivity failure.
   */
  public isServingFallback(): boolean {
    return this.cache?.fromFallback ?? false;
  }

  public async getSettings(): Promise<SystemSettings> {
    // 1. Cache Check
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.full;
    }

    // 2. Request Deduplication: Return pending promise if request is in flight
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    // 3. Launch Request
    this.pendingRequest = (async () => {
      try {
        const row = await prisma.systemSettings.findUnique({
          where: { id: "global" },
        });

        // Parse once sequentially
        const parsed = SystemSettingsSchema.parse(row ?? {});
        const publicParsed = PublicSettingsSchema.parse(parsed);
        const financialParsed = FinancialSettingsSchema.parse(parsed);

        // Store pre-parsed objects in memory
        this.cache = {
          full: parsed,
          publicParsed,
          financialParsed,
          timestamp: Date.now(),
          fromFallback: false,
        };
        return parsed;
      } catch (error) {
        // Emit a structured JSON log so Vercel's log pipeline can index this
        // as a distinct event rather than an unstructured string blob.
        // Do NOT expose error.message in any API response — logged internally only.
        const prismaCode =
          error instanceof Error &&
          "code" in error &&
          typeof (error as Record<string, unknown>)["code"] === "string"
            ? (error as Record<string, unknown>)["code"]
            : "UNKNOWN";
        console.error(
          JSON.stringify({
            event: "system_settings_db_failure",
            severity: "CRITICAL",
            prismaCode,
            message:
              "SystemSettings DB fetch failed — serving hardcoded defaults",
          }),
        );
        const fallback = SystemSettingsSchema.parse({
          ...DEFAULT_PUBLIC_SETTINGS,
          ...DEFAULT_FINANCIAL_SETTINGS,
        });
        const publicParsed = PublicSettingsSchema.parse(fallback);
        const financialParsed = FinancialSettingsSchema.parse(fallback);

        this.cache = {
          full: fallback,
          publicParsed,
          financialParsed,
          timestamp: Date.now(),
          fromFallback: true,
        };
        return fallback;
      } finally {
        this.pendingRequest = null;
      }
    })();

    return this.pendingRequest;
  }

  public async getPublicSettings(): Promise<PublicSettings> {
    await this.getSettings(); // Ensures cache is populated
    return this.cache!.publicParsed; // Zero-parsing fast return
  }

  public async getFinancialSettings(): Promise<FinancialSettings> {
    await this.getSettings(); // Ensures cache is populated
    return this.cache!.financialParsed; // Zero-parsing fast return
  }
}

export const systemSettingsService = SystemSettingsService.getInstance();

// =============================================================================
// Backward Compatibility Exports (Wrappers)
// =============================================================================

export async function getSystemSettings() {
  return systemSettingsService.getSettings();
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return systemSettingsService.getPublicSettings();
}

export async function getFinancialSettings(): Promise<FinancialSettings> {
  return systemSettingsService.getFinancialSettings();
}

export function invalidateCache(): void {
  systemSettingsService.invalidateCache();
}

/**
 * Returns true when the service last fell back to hardcoded defaults due to a
 * database connectivity failure. Callers can use this to emit observability
 * headers (e.g. X-Settings-Source: fallback) without changing response shape.
 */
export function isServingFallback(): boolean {
  return systemSettingsService.isServingFallback();
}

/**
 * Check if a feature flag is enabled. Supports nested keys via dot notation.
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const settings = await getPublicSettings();
  const flags = settings.featureFlags || {};

  const parts = flag.split(".");
  // Typed as unknown initially to avoid explicit 'any'
  let current: unknown = flags;

  for (const part of parts) {
    if (
      current === undefined ||
      current === null ||
      typeof current !== "object"
    ) {
      return false;
    }
    // Type assertion to access property safely - we know it's an object/record here
    current = (current as Record<string, unknown>)[part];
  }

  return current === true;
}

export async function computePlatformFee(amount: number): Promise<number> {
  const { platformCommission } = await getFinancialSettings();
  return Math.round((amount * platformCommission) / 100);
}

export async function getVerificationRules(): Promise<VerificationRules> {
  const settings = await getSystemSettings();
  return settings.verificationRules;
}

export async function getRequiredDocumentsForProfession(
  profession: string,
): Promise<string[]> {
  const rules = await getVerificationRules();
  // Safe access using the specific profession key
  // Cast to Profession if string matches to work with Record<Profession, ...>
  // or rely on the fact that Zod returns a plain object where keys are just strings at runtime

  // Note: Zod record keys are strings in the inferred type, even if defined with nativeEnum.
  // However, we should be careful.
  // If `profession` is a user input string, it might not be a valid key.

  const key = profession as Profession; // Optimistic cast for access
  const docs = rules.requiredDocuments[key] ??
    rules.requiredDocuments.OTHER ?? ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"];
  return docs;
}

export async function getRequiredLicensesForProfession(
  profession: string,
): Promise<string[]> {
  const rules = await getVerificationRules();
  const key = profession as Profession;
  return rules.requiredLicenses[key] ?? [];
}
