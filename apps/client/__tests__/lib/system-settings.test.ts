import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@build/db", () => ({
  prisma: {
    systemSettings: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from "@build/db";

const mockFindUnique = vi.mocked(prisma.systemSettings.findUnique);
const mockQueryRawUnsafe = vi.mocked(prisma.$queryRawUnsafe);

describe("System Settings Service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { systemSettingsService } = await import("@build/db/system-settings");
    systemSettingsService.invalidateCache();
  });

  it("getPublicSettings returns defaults when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null as any);

    const { getPublicSettings } = await import("@build/db/system-settings");
    const settings = await getPublicSettings();

    expect(settings.maintenanceMode).toBe(false);
    expect(settings.publicSignup).toBe(true);
    expect(settings.allowProfessionalSignup).toBe(true);
    expect(settings.supportEmail).toBe("support@buildmarket.app");
    expect(settings.featureFlags).toEqual({});
  });

  it("getPublicSettings excludes secrets and returns public fields", async () => {
    mockFindUnique.mockResolvedValue({
      maintenanceMode: true,
      maintenanceMessage: "Back soon",
      allowedIPs: ["127.0.0.1"],
      publicSignup: false,
      allowProfessionalSignup: false,
      featureFlags: { enableMessaging: true },
      supportEmail: "help@example.com",
      supportPhone: "+254700000000",
      whatsappNumber: "+254700000000",
    } as any);

    const { getPublicSettings } = await import("@build/db/system-settings");
    const settings = await getPublicSettings();

    expect(settings.maintenanceMode).toBe(true);
    expect(settings.maintenanceMessage).toBe("Back soon");
    expect(settings.allowedIPs).toEqual(["127.0.0.1"]);
    expect(settings.publicSignup).toBe(false);
    expect(settings.featureFlags).toEqual({ enableMessaging: true });
    expect(settings).not.toHaveProperty("mpesaConsumerKey");
    expect(settings).not.toHaveProperty("mpesaPasskey");
  });

  it("getFinancialSettings returns defaults when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null as any);

    const { getFinancialSettings } = await import("@build/db/system-settings");
    const settings = await getFinancialSettings();

    expect(settings.minWithdrawalKes).toBe(1000);
    expect(settings.maxWithdrawalKes).toBe(150000);
    expect(settings.platformCommission).toBe(5);
  });

  it("computePlatformFee calculates correctly", async () => {
    mockFindUnique.mockResolvedValue({
      platformCommission: 10,
      vatRate: 16,
      withholdingTaxRate: 5,
      minWithdrawalKes: 1000,
      maxWithdrawalKes: 150000,
      currency: "KES",
    } as any);

    const { computePlatformFee } = await import("@build/db/system-settings");
    const fee = await computePlatformFee(1000);
    expect(fee).toBe(100);
  });

  it("handles P2022 missing column error by falling back to raw query and defaulting missing fields", async () => {
    const p2022 = Object.assign(
      new Error(
        "The column SystemSettings.enableAutoVerifyEBK does not exist in the current database.",
      ),
      { code: "P2022" },
    );
    mockFindUnique.mockRejectedValue(p2022);
    mockQueryRawUnsafe.mockResolvedValue([
      {
        maintenanceMode: true,
        maintenanceMessage: "Scheduled Maintenance",
        publicSignup: true,
        allowProfessionalSignup: true,
        platformCommission: 7.5,
      },
    ] as any);

    const { getPublicSettings } = await import("@build/db/system-settings");
    const settings = await getPublicSettings();

    expect(settings.maintenanceMode).toBe(true);
    expect(settings.maintenanceMessage).toBe("Scheduled Maintenance");
    expect(mockQueryRawUnsafe).toHaveBeenCalledWith(
      `SELECT * FROM "SystemSettings" WHERE id = 'global' LIMIT 1`,
    );
  });
});
