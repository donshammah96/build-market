import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    OPS_ADMIN: "OPS_ADMIN",
    VERIFICATION_ADMIN: "VERIFICATION_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { settingsService } from "../service";
import { settingsRepository } from "../repository";
import type { SettingsActor } from "../contracts";
import { AdminRole } from "@build/db";

const mockSettings = {
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
  supportEmail: "support@buildmarket.co.ke",
  adminEmailAlerts: true,
  securityMFA: true,
};

function makeActor(adminRole: AdminRole): SettingsActor {
  return { dbUserId: "actor-1", clerkId: "clerk-1", adminRole };
}

describe("settingsService.getSystemSettings", () => {
  beforeEach(() => {
    vi.mocked(settingsRepository.findGlobal).mockResolvedValue(mockSettings);
  });

  it("returns settings for SUPER_ADMIN", async () => {
    const result = await settingsService.getSystemSettings(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.platformCommission).toBe(10);
  });

  it("denies access for CONTENT_MODERATOR (no SYSTEM_ADMIN_ONLY)", async () => {
    const result = await settingsService.getSystemSettings(
      makeActor(AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SETTINGS_POLICY_DENIED");
  });

  it("denies access for SUPPORT_AGENT", async () => {
    const result = await settingsService.getSystemSettings(
      makeActor(AdminRole.SUPPORT_AGENT),
    );
    expect(result.ok).toBe(false);
  });
});

describe("settingsService.updateSystemSettings", () => {
  beforeEach(() => {
    vi.mocked(settingsRepository.upsertGlobal).mockResolvedValue(mockSettings);
  });

  it("updates settings for SUPER_ADMIN", async () => {
    const result = await settingsService.updateSystemSettings(
      makeActor(AdminRole.SUPER_ADMIN),
      mockSettings,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.settings).toEqual(mockSettings);
  });

  it("denies access for non SUPER_ADMIN roles", async () => {
    const result = await settingsService.updateSystemSettings(
      makeActor(AdminRole.FINANCE_MANAGER),
      mockSettings,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SETTINGS_POLICY_DENIED");
  });
});

describe("settingsService.clearSystemCache", () => {
  it("clears cache for SUPER_ADMIN", async () => {
    const result = await settingsService.clearSystemCache(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.timestamp).toBeDefined();
  });

  it("denies access for CONTENT_MODERATOR", async () => {
    const result = await settingsService.clearSystemCache(
      makeActor(AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
  });
});
