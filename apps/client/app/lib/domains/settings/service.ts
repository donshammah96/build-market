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
import { settingsRepository } from "./repository";
import type { Profession } from "@prisma/client";

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

export class SystemSettingsService {
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
        const row = await settingsRepository.findGlobalWithTimeout(3000);

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

        // Emit a structured JSON log so Vercel's log pipeline can index this
        // as a distinct event rather than an unstructured string blob.
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
// Helper Wrappers
// =============================================================================

export async function getSystemSettings(): Promise<SystemSettings> {
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

export function isServingFallback(): boolean {
  return systemSettingsService.isServingFallback();
}

export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const settings = await getPublicSettings();
  const flags = settings.featureFlags || {};

  const parts = flag.split(".");
  let current: unknown = flags;

  for (const part of parts) {
    if (
      current === undefined ||
      current === null ||
      typeof current !== "object"
    ) {
      return false;
    }
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
  const key = profession as Profession;
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
