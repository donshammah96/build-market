import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@build/db", () => ({
  prisma: {
    systemSettings: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

describe("System Settings Service", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindUnique.mockReset();
  });

  it("getPublicSettings returns defaults when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const { getPublicSettings } = await import("@build/db/system-settings");
    const settings = await getPublicSettings();

    expect(settings.maintenanceMode).toBe(false);
    expect(settings.publicSignup).toBe(true);
    expect(settings.allowProfessionalSignup).toBe(true);
    expect(settings.supportEmail).toBe("support@buildmarket.co.ke");
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
    });

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
    mockFindUnique.mockResolvedValue(null);

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
    });

    const { computePlatformFee } = await import("@build/db/system-settings");
    const fee = await computePlatformFee(1000);
    expect(fee).toBe(100);
  });
});
