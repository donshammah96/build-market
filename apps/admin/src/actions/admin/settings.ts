"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, type SystemSettingsInput } from "./shared";
import { SystemSettingsSchema } from "./types";
import { prisma } from "@build/db";
import { invalidateCache } from "@build/db/system-settings";

// ============================================================================
// Types
// ============================================================================

export type SystemSettings = {
  maintenanceMode: boolean;
  publicSignup: boolean;
  enableAutoVerifyNCA: boolean;
  platformCommission: number;
  supportEmail: string;
  adminEmailAlerts: boolean;
  securityMFA: boolean;
};

const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  publicSignup: true,
  enableAutoVerifyNCA: false,
  platformCommission: 10,
  supportEmail: "support@buildmarket.co.ke",
  adminEmailAlerts: true,
  securityMFA: true,
};

// ============================================================================
// Actions
// ============================================================================

/**
 * Get current system settings.
 * Fetches the singleton row 'global', returns defaults if missing.
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  try {
    await assertAdmin();

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
    };
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return null;
  }
}

/**
 * Updates system-wide settings.
 * Uses 'global' ID to enforce singleton pattern.
 * Returns the updated settings for optimistic UI updates.
 */
export async function updateSystemSettings(data: SystemSettingsInput) {
  try {
    await assertAdmin();

    const validated = SystemSettingsSchema.parse(data);

    const settings = await prisma.systemSettings.upsert({
      where: { id: "global" },
      update: {
        ...validated,
        platformCommission: validated.platformCommission,
        enableAutoVerifyNCA: validated.enableAutoVerifyNCA,
      },
      create: {
        id: "global",
        ...validated,
        platformCommission: validated.platformCommission,
        enableAutoVerifyNCA: validated.enableAutoVerifyNCA,
      },
    });

    invalidateCache();
    revalidatePath("/settings");

    // Return updated settings for optimistic updates
    return {
      success: true,
      data: {
        ...settings,
        platformCommission: Number(settings.platformCommission),
      },
      timestamp: new Date().toISOString(),
    };
  } catch {
    console.error("Failed to update settings:");
    return { success: false, error: "Failed to update settings" };
  }
}

/**
 * Clears all Next.js caches by revalidating the root layout.
 */
export async function clearSystemCache() {
  try {
    await assertAdmin();
    revalidatePath("/", "layout");
    return { 
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return { success: false, error: "Failed to clear cache" };
  }
}
