import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";
import type { SystemSettings, UpdateSettingsInput } from "./contracts";

const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  publicSignup: true,
  enableAutoVerifyNCA: false,
  enableAutoVerifyEPRA: false,
  enableAutoVerifyBORAQS: false,
  enableAutoVerifyEBK: false,
  enableAutoVerifyEARB: false,
  enableAutoVerifyVRB: false,
  enableAutoVerifyISK: false,
  enforceProfessionalLicenses: false,
  enforcePropertyDocuments: false,
  enableLandRegistryCheck: false,
  enforceStorePermits: false,
  requireTaxCompliance: false,
  platformCommission: 10,
  supportEmail: "support@buildmarket.app",
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
      enableAutoVerifyEPRA: settings.enableAutoVerifyEPRA ?? false,
      enableAutoVerifyBORAQS: settings.enableAutoVerifyBORAQS ?? false,
      enableAutoVerifyEBK: settings.enableAutoVerifyEBK ?? false,
      enableAutoVerifyEARB: settings.enableAutoVerifyEARB ?? false,
      enableAutoVerifyVRB: settings.enableAutoVerifyVRB ?? false,
      enableAutoVerifyISK: settings.enableAutoVerifyISK ?? false,

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

    revalidatePath("/settings");

    return {
      ...settings,
      platformCommission: Number(settings.platformCommission),
    } as unknown as SystemSettings;
  },
};
