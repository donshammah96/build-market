"use server";

import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "./_core/validation";
import { SystemSettingsSchema } from "./types";
import { settingsService } from "@/lib/domains/settings/service";

/**
 * Get current system settings.
 * Fetches the singleton row 'global', returns defaults if missing.
 * Requires SYSTEM_ADMIN_ONLY capability.
 */
export async function getSystemSettings() {
  return safeAction("getSystemSettings", async ({ actor }) => {
    const result = await settingsService.getSystemSettings(actor);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Updates system-wide settings.
 * Uses 'global' ID to enforce singleton pattern.
 * Tier 1 mutation — requires recentAuth and SYSTEM_ADMIN_ONLY capability.
 */
export async function updateSystemSettings(data: unknown) {
  return safeAction(
    "updateSystemSettings",
    async ({ actor }) => {
      const validated = parseActionInput(
        SystemSettingsSchema,
        data,
        "Invalid settings data",
      );

      const result = await settingsService.updateSystemSettings(
        actor,
        validated,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      return result.data.settings;
    },
    {
      recentAuth: { maxAgeSeconds: 180 },
      auditLog: {
        operation: "UPDATE_SYSTEM_SETTINGS",
        resourceType: "system_settings",
        getTargetId: () => "global",
        getDetails: () =>
          typeof data === "object" ? (data as Record<string, unknown>) : {},
      },
    },
  );
}

/**
 * Clears all Next.js caches by revalidating the root layout.
 * Requires SYSTEM_ADMIN_ONLY capability.
 */
export async function clearSystemCache() {
  return safeAction("clearSystemCache", async ({ actor }) => {
    const result = await settingsService.clearSystemCache(actor);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}
