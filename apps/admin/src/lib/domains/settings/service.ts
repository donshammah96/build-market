import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ClearCacheResult,
  SettingsActor,
  SettingsDomainError,
  SystemSettings,
  UpdateSettingsInput,
  UpdateSettingsResult,
} from "./contracts";
import { settingsRepository } from "./repository";

function requireSystemAdmin(
  actor: SettingsActor,
): Result<true, SettingsDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.SYSTEM_ADMIN_ONLY,
  );
  if (!policy.success) {
    return err({
      code: "SETTINGS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

export const settingsService = {
  /**
   * Fetch current system settings (singleton "global" row).
   * Requires SYSTEM_ADMIN_ONLY capability.
   */
  async getSystemSettings(
    actor: SettingsActor,
  ): Promise<Result<SystemSettings, SettingsDomainError>> {
    const policy = requireSystemAdmin(actor);
    if (!policy.ok) return policy;

    try {
      const settings = await settingsRepository.findGlobal();
      return ok(settings);
    } catch {
      return err({
        code: "SETTINGS_FETCH_FAILED",
        message: "Failed to fetch system settings",
      });
    }
  },

  /**
   * Update system settings (upsert on singleton "global" row).
   * Requires SYSTEM_ADMIN_ONLY. Tier 1 mutation — callers should enforce
   * recentAuth: { maxAgeSeconds: 180 } in the safeAction wrapper.
   */
  async updateSystemSettings(
    actor: SettingsActor,
    data: UpdateSettingsInput,
  ): Promise<Result<UpdateSettingsResult, SettingsDomainError>> {
    const policy = requireSystemAdmin(actor);
    if (!policy.ok) return policy;

    try {
      const settings = await settingsRepository.upsertGlobal(data);
      return ok({ settings, timestamp: new Date().toISOString() });
    } catch {
      return err({
        code: "SETTINGS_UPDATE_FAILED",
        message: "Failed to update system settings",
      });
    }
  },

  /**
   * Clear Next.js root layout cache.
   * Requires SYSTEM_ADMIN_ONLY capability.
   */
  async clearSystemCache(
    actor: SettingsActor,
  ): Promise<Result<ClearCacheResult, SettingsDomainError>> {
    const policy = requireSystemAdmin(actor);
    if (!policy.ok) return policy;

    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/", "layout");
      return ok({ timestamp: new Date().toISOString() });
    } catch {
      return err({
        code: "CACHE_CLEAR_FAILED",
        message: "Failed to clear system cache",
      });
    }
  },
};
