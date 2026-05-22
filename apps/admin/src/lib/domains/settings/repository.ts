import { prisma } from "@build/db";
import { invalidateCache } from "@build/db/system-settings";
import { revalidatePath } from "next/cache";
import type { SystemSettings, UpdateSettingsInput } from "./contracts";

const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  publicSignup: true,
  enableAutoVerifyNCA: false,
  enableAutoVerifyEPRA: false,
  enableAutoVerifyBORAQS: false,
  enforceProfessionalLicenses: false,
  enforcePropertyDocuments: false,
  enableLandRegistryCheck: false,
  enforceStorePermits: false,
  requireTaxCompliance: false,
  platformCommission: 10,
  supportEmail: "support@buildmarket.co.ke",
  adminEmailAlerts: true,
  securityMFA: true,
};

/**
 * Persistence-only layer for system settings.
 * Manages the singleton "global" settings row.
 * Handles Decimal → number conversion for platformCommission.
 * No authorization. No response shaping beyond typed DTOs.
 */
export const settingsRepository = {
  async findGlobal(): Promise<SystemSettings> {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "global" },
    });

    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...settings,
      platformCommission: Number(settings.platformCommission ?? 10),
      enableAutoVerifyNCA: settings.enableAutoVerifyNCA ?? false,
      enableAutoVerifyEPRA:
        ((settings as Record<string, unknown>)
          .enableAutoVerifyEPRA as boolean) ?? false,
      enableAutoVerifyBORAQS:
        ((settings as Record<string, unknown>)
          .enableAutoVerifyBORAQS as boolean) ?? false,
      enforceProfessionalLicenses:
        ((settings as Record<string, unknown>)
          .enforceProfessionalLicenses as boolean) ?? false,
      enforcePropertyDocuments:
        ((settings as Record<string, unknown>)
          .enforcePropertyDocuments as boolean) ?? false,
      enableLandRegistryCheck:
        ((settings as Record<string, unknown>)
          .enableLandRegistryCheck as boolean) ?? false,
      enforceStorePermits:
        ((settings as Record<string, unknown>)
          .enforceStorePermits as boolean) ?? false,
      requireTaxCompliance:
        ((settings as Record<string, unknown>)
          .requireTaxCompliance as boolean) ?? false,
    };
  },

  async upsertGlobal(data: UpdateSettingsInput): Promise<SystemSettings> {
    const settings = await prisma.systemSettings.upsert({
      where: { id: "global" },
      update: { ...data },
      create: { id: "global", ...data },
    });

    invalidateCache();
    revalidatePath("/settings");

    return {
      ...settings,
      platformCommission: Number(settings.platformCommission),
    } as unknown as SystemSettings;
  },
};
