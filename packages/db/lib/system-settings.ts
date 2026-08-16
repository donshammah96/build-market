/**
 * System Settings Service
 *
 * @deprecated Per ADR-002 and ADR-003, business domain services and in-memory caches
 * should not reside inside `@build/db`. This module is retained for backward compatibility.
 * Prefer domain-specific service layers in `apps/client` or `apps/admin` backed by `@build/redis`.
 *
 * Provides cached access to SystemSettings from the database.
 * Uses Zod for runtime validation and type inference.
 * Implements a Singleton pattern for efficient caching.
 */
import { prisma } from "./prisma.js";
import { Profession } from "@prisma/client";
import {
  DEFAULT_VERIFICATION_RULES,
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_FINANCIAL_SETTINGS,
  FeatureFlagsSchema,
  DocumentQualitySchema,
  VerificationRulesSchema,
  PublicSettingsSchema,
  FinancialSettingsSchema,
  SystemSettingsSchema,
  type FeatureFlags,
  type VerificationRules,
  type PublicSettings,
  type FinancialSettings,
  type SystemSettings,
} from "@build/types";

// Re-export constants, schemas, and types for backwards compatibility
export {
  DEFAULT_VERIFICATION_RULES,
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_FINANCIAL_SETTINGS,
  FeatureFlagsSchema,
  DocumentQualitySchema,
  VerificationRulesSchema,
  PublicSettingsSchema,
  FinancialSettingsSchema,
  SystemSettingsSchema,
  type FeatureFlags,
  type VerificationRules,
  type PublicSettings,
  type FinancialSettings,
  type SystemSettings,
};

// =============================================================================
// Type Definitions (Inferred from Zod)
// =============================================================================

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
      let timeoutHandle: NodeJS.Timeout | undefined;
      try {
        const queryPromise = prisma.systemSettings.findUnique({
          where: { id: "global" },
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                Object.assign(new Error("DB query timed out after 3000ms"), {
                  code: "ETIMEDOUT",
                }),
              ),
            3000,
          );
        });

        const row = await Promise.race([queryPromise, timeoutPromise]);

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
        const prismaCode =
          error instanceof Error &&
          "code" in error &&
          typeof (error as Record<string, unknown>)["code"] === "string"
            ? (error as Record<string, unknown>)["code"]
            : "UNKNOWN";

        // Defensive handling for P2022 (Column missing in DB table due to un-migrated schema)
        if (prismaCode === "P2022") {
          try {
            const rawRows = await prisma.$queryRawUnsafe<
              Record<string, unknown>[]
            >(`SELECT * FROM "SystemSettings" WHERE id = 'global' LIMIT 1`);
            const rawRow = rawRows && rawRows.length > 0 ? rawRows[0] : null;
            if (rawRow) {
              console.warn(
                JSON.stringify({
                  event: "system_settings_schema_drift",
                  severity: "WARN",
                  prismaCode,
                  message:
                    "SystemSettings table missing columns (P2022) — loaded raw row with defaults; deploy prisma migration",
                }),
              );
              const parsed = SystemSettingsSchema.parse(rawRow);
              const publicParsed = PublicSettingsSchema.parse(parsed);
              const financialParsed = FinancialSettingsSchema.parse(parsed);

              this.cache = {
                full: parsed,
                publicParsed,
                financialParsed,
                timestamp: Date.now(),
                fromFallback: false,
              };
              return parsed;
            }
          } catch {
            // Fall through to hardcoded defaults if raw query also fails
          }
        }

        // Emit a structured JSON log so Vercel's log pipeline can index this
        // as a distinct event rather than an unstructured string blob.
        // Do NOT expose error.message in any API response — logged internally only.
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
        if (timeoutHandle) clearTimeout(timeoutHandle);
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
