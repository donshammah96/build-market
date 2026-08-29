/**
 * System Settings Facade (FULLY DEPRECATED)
 *
 * @deprecated Per ADR-002, ADR-003, and DB-PACKAGE-AUTOPSY Finding 2, domain business logic,
 * constants, validation schemas, and in-memory caches MUST NOT reside in the persistence layer (`@build/db`).
 *
 * - For schemas, types, and defaults: import from `@build/types`.
 * - For client domain services: import from `@/app/lib/domains/settings` (`apps/client`).
 * - For admin domain services: import from `@/lib/domains/settings` (`apps/admin`).
 */

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
import { prisma } from "./prisma.js";
import type { Profession } from "@prisma/client";

/** @deprecated Import from `@build/types` */
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

/** @deprecated Import from `@build/types` */
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

/** @deprecated Import from `@build/types` */
export type StoreDocumentType =
  | "BUSINESS_REGISTRATION"
  | "KRA_TAX_COMPLIANCE"
  | "KRA_PIN_CERTIFICATE"
  | "ID_OR_PASSPORT"
  | "LEASE_OR_OWNERSHIP"
  | "TRADING_LICENSE"
  | "OTHER";

/** @deprecated Import from `@build/types` */
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

/**
 * @deprecated Use domain service from `@/app/lib/domains/settings` (`apps/client`)
 * or `@/lib/domains/settings` (`apps/admin`).
 */
class DeprecatedSystemSettingsService {
  private static instance: DeprecatedSystemSettingsService;
  private cache: {
    full: SystemSettings;
    publicParsed: PublicSettings;
    financialParsed: FinancialSettings;
    timestamp: number;
    fromFallback: boolean;
  } | null = null;
  private readonly CACHE_TTL_MS = 60_000;
  private pendingRequest: Promise<SystemSettings> | null = null;

  private constructor() {}

  public static getInstance(): DeprecatedSystemSettingsService {
    if (!DeprecatedSystemSettingsService.instance) {
      DeprecatedSystemSettingsService.instance =
        new DeprecatedSystemSettingsService();
    }
    return DeprecatedSystemSettingsService.instance;
  }

  public invalidateCache(): void {
    this.cache = null;
  }

  public isServingFallback(): boolean {
    return this.cache?.fromFallback ?? false;
  }

  public async getSettings(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.full;
    }
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

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
        const parsed = SystemSettingsSchema.parse(row ?? {});
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
      } catch {
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
    await this.getSettings();
    return this.cache!.publicParsed;
  }

  public async getFinancialSettings(): Promise<FinancialSettings> {
    await this.getSettings();
    return this.cache!.financialParsed;
  }
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export const systemSettingsService =
  DeprecatedSystemSettingsService.getInstance();

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getSystemSettings() {
  return systemSettingsService.getSettings();
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getPublicSettings(): Promise<PublicSettings> {
  return systemSettingsService.getPublicSettings();
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getFinancialSettings(): Promise<FinancialSettings> {
  return systemSettingsService.getFinancialSettings();
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export function invalidateCache(): void {
  systemSettingsService.invalidateCache();
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export function isServingFallback(): boolean {
  return systemSettingsService.isServingFallback();
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
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

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function computePlatformFee(amount: number): Promise<number> {
  const { platformCommission } = await getFinancialSettings();
  return Math.round((amount * platformCommission) / 100);
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getVerificationRules(): Promise<VerificationRules> {
  const settings = await getSystemSettings();
  return settings.verificationRules;
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getRequiredDocumentsForProfession(
  profession: string,
): Promise<string[]> {
  const rules = await getVerificationRules();
  const key = profession as Profession;
  return (
    rules.requiredDocuments[key] ??
    rules.requiredDocuments.OTHER ?? ["ID_OR_PASSPORT", "KRA_TAX_COMPLIANCE"]
  );
}

/** @deprecated Import from `@/app/lib/domains/settings` (`apps/client`) */
export async function getRequiredLicensesForProfession(
  profession: string,
): Promise<string[]> {
  const rules = await getVerificationRules();
  const key = profession as Profession;
  return rules.requiredLicenses[key] ?? [];
}
