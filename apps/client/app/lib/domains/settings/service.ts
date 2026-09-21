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
import { RedisCache } from "@build/redis";
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

  // L1 In-Memory Cache to minimize Redis round trips within active processes
  private cache: {
    full: SystemSettings;
    publicParsed: PublicSettings;
    financialParsed: FinancialSettings;
    timestamp: number;
    /** True when the entry was populated from hardcoded defaults due to a DB failure. */
    fromFallback: boolean;
  } | null = null;

  // L2 Distributed Redis Cache for multi-instance synchronization
  private readonly redisCache: RedisCache<SystemSettings>;
  private readonly MEMORY_CACHE_TTL_MS = 10_000; // 10 seconds in-memory TTL
  private readonly REDIS_CACHE_TTL_SECONDS = 300; // 5 minutes distributed TTL
  private pendingRequest: Promise<SystemSettings> | null = null;

  private constructor() {
    this.redisCache = new RedisCache<SystemSettings>("settings:system", {
      ttl: this.REDIS_CACHE_TTL_SECONDS,
    });
  }

  public static getInstance(): SystemSettingsService {
    if (!SystemSettingsService.instance) {
      SystemSettingsService.instance = new SystemSettingsService();
    }
    return SystemSettingsService.instance;
  }

  /**
   * Invalidate both L1 in-memory cache and L2 distributed Redis cache.
   */
  public async invalidateCache(): Promise<void> {
    this.cache = null;
    try {
      await this.redisCache.delete("global");
    } catch {
      // Non-blocking in environments where Redis is not configured
    }
  }

  /**
   * Synchronous cache invalidation for local process memory.
   */
  public invalidateLocalMemoryCache(): void {
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
    // 1. L1 In-Memory Cache Check
    if (
      this.cache &&
      Date.now() - this.cache.timestamp < this.MEMORY_CACHE_TTL_MS
    ) {
      return this.cache.full;
    }

    // 2. In-flight Request Deduplication
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    // 3. Launch Request (L2 Redis -> Database -> Safe Fallback)
    this.pendingRequest = (async () => {
      try {
        // Step A: Check L2 Distributed Redis Cache
        try {
          const cachedRedis = await this.redisCache.get("global");
          if (cachedRedis) {
            const parsed = SystemSettingsSchema.parse(cachedRedis);
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
          // Redis cache miss or unconfigured; proceed to DB query
        }

        // Step B: Query Database via persistence repository
        const row = await settingsRepository.findGlobalWithTimeout(3000);
        const parsed = SystemSettingsSchema.parse(row ?? {});
        const publicParsed = PublicSettingsSchema.parse(parsed);
        const financialParsed = FinancialSettingsSchema.parse(parsed);

        // Populate L1 In-Memory Cache
        this.cache = {
          full: parsed,
          publicParsed,
          financialParsed,
          timestamp: Date.now(),
          fromFallback: false,
        };

        // Populate L2 Distributed Redis Cache asynchronously (non-blocking)
        try {
          await this.redisCache.set(
            "global",
            parsed,
            this.REDIS_CACHE_TTL_SECONDS,
          );
        } catch {
          // Non-blocking if Redis is unreachable
        }

        return parsed;
      } catch (error) {
        const prismaCode =
          error instanceof Error &&
          "code" in error &&
          typeof (error as Record<string, unknown>)["code"] === "string"
            ? (error as Record<string, unknown>)["code"]
            : "UNKNOWN";

        // Emit structured critical log for telemetry
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
    await this.getSettings();
    return this.cache!.publicParsed;
  }

  public async getFinancialSettings(): Promise<FinancialSettings> {
    await this.getSettings();
    return this.cache!.financialParsed;
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

export async function invalidateCache(): Promise<void> {
  await systemSettingsService.invalidateCache();
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
