import { beforeEach, describe, expect, it, vi } from "vitest";
import { financeService } from "@/app/lib/domains/finance/service";

const prismaMock = vi.hoisted(() => ({
  professionalTransaction: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
}));

const getFinancialSettingsMock = vi.hoisted(() => vi.fn());

const userProfileDomainMock = vi.hoisted(() => ({
  enforceClientMutationPolicy: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@build/db/system-settings", () => ({
  getFinancialSettings: getFinancialSettingsMock,
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  enforceClientMutationPolicy:
    userProfileDomainMock.enforceClientMutationPolicy,
}));

describe("financeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userProfileDomainMock.enforceClientMutationPolicy.mockResolvedValue({
      ok: true,
      routing: null,
    });
    getFinancialSettingsMock.mockResolvedValue({
      minWithdrawalKes: 100,
      maxWithdrawalKes: 100000,
    });
  });

  it("blocks withdrawal when government procurement compliance is incomplete", async () => {
    userProfileDomainMock.enforceClientMutationPolicy.mockResolvedValue({
      ok: false,
      message:
        "Government entity procurement compliance is incomplete. Missing required fields: companyRegistration.",
      routing: {
        clientType: "GOVERNMENT_ENTITY",
        onboardingBranch: "government_entity",
        requiresDedicatedProcurementCheck: true,
        projectCreationPolicy: "government_entity_procurement_check",
        paymentInitiationPolicy: "government_entity_procurement_check",
        status: "pending_information",
        missingRequirements: ["companyRegistration"],
      },
    });

    const result = await financeService.createWithdrawal(
      { userId: "pro-1", role: "professional" },
      { amount: 500, method: "MPESA" },
    );

    expect(
      userProfileDomainMock.enforceClientMutationPolicy,
    ).toHaveBeenCalledWith({
      clientUserId: "pro-1",
      policy: "paymentInitiationPolicy",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
      expect(result.status).toBe(403);
      expect(result.message).toContain("procurement compliance");
    }
    expect(getFinancialSettingsMock).not.toHaveBeenCalled();
  });

  it("creates withdrawal when payment policy check passes", async () => {
    prismaMock.professionalTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 6000 } })
      .mockResolvedValueOnce({ _sum: { amount: 1000 } });

    prismaMock.professionalTransaction.create.mockResolvedValue({
      id: "txn-1",
      type: "WITHDRAWAL",
      category: "WITHDRAWAL",
      method: "MPESA",
      status: "PENDING",
      description: "Withdrawal Request",
      amount: 2000,
      platformFee: 0,
      taxAmount: 0,
      netAmount: 2000,
      currency: "KES",
      referenceCode: null,
      date: new Date("2026-04-04T10:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-04-04T10:00:00.000Z"),
      project: null,
      leadId: null,
      subscriptionId: null,
      failedReason: null,
      providerMetadata: null,
      updatedAt: new Date("2026-04-04T10:00:00.000Z"),
    });

    const result = await financeService.createWithdrawal(
      { userId: "pro-1", role: "professional" },
      { amount: 2000, method: "MPESA" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("txn-1");
      expect(result.data.amount).toBe(2000);
    }
    expect(prismaMock.professionalTransaction.create).toHaveBeenCalledTimes(1);
  });
});
