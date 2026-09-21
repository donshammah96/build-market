import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetFinancialSettings = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());
const mockEnforceClientMutationPolicy = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/domains/settings", () => ({
  getFinancialSettings: (...args: unknown[]) =>
    mockGetFinancialSettings(...args),
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  enforceClientMutationPolicy: (...args: unknown[]) =>
    mockEnforceClientMutationPolicy(...args),
}));

vi.mock("@build/db", () => ({
  prisma: {
    professionalTransaction: {
      create: (...args: unknown[]) => mockCreate(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
  },
}));

vi.mock("@/app/lib/errors/result", () => ({
  ok: (data: unknown) => ({ ok: true, data }),
  err: (error: any) => ({ ok: false, ...error }),
}));

vi.mock("@/app/lib/security/roles", () => ({
  normalizeRole: (role: string) => role,
}));

vi.mock("@/app/lib/validation/finance-validation", () => ({
  serializeTransactionDecimals: (t: unknown) => t,
  transactionDetailSelect: {},
  transactionListSelect: {},
}));

describe("createWithdrawal - withdrawal limits", () => {
  let financeService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockGetFinancialSettings.mockReset();
    mockGetFinancialSettings.mockResolvedValue({
      minWithdrawalKes: 1000,
      maxWithdrawalKes: 150000,
      platformCommission: 5,
      vatRate: 16,
      withholdingTaxRate: 5,
      currency: "KES",
    });

    mockAggregate.mockReset();
    mockAggregate.mockResolvedValue({ _sum: { netAmount: 10000 } });

    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      id: "tx_1",
      amount: 5000,
      netAmount: 5000,
      status: "PENDING",
    });

    mockEnforceClientMutationPolicy.mockReset();
    mockEnforceClientMutationPolicy.mockResolvedValue({ ok: true });

    const mod = await import("../../app/lib/domains/finance/service");
    financeService = mod.financeService;
  });

  it("rejects amount below minimum", async () => {
    const result = await financeService.createWithdrawal(
      { userId: "user_1", role: "PROFESSIONAL" },
      {
        amount: 500,
        method: "MPESA",
      },
    );

    expect("error" in result).toBe(true);
    if ("error" in result && result.error === "below_minimum") {
      expect(result.error).toBe("below_minimum");
      expect(result.min).toBe(1000);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects amount above maximum", async () => {
    const result = await financeService.createWithdrawal(
      { userId: "user_1", role: "PROFESSIONAL" },
      {
        amount: 200000,
        method: "MPESA",
      },
    );

    expect("error" in result).toBe(true);
    if ("error" in result && result.error === "above_maximum") {
      expect(result.error).toBe("above_maximum");
      expect(result.max).toBe(150000);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts amount within range when balance is sufficient", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 10000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    const result = await financeService.createWithdrawal(
      { userId: "user_1", role: "PROFESSIONAL" },
      {
        amount: 5000,
        method: "MPESA",
      },
    );

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("accepts amount at exact minimum", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 5000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    const result = await financeService.createWithdrawal(
      { userId: "user_1", role: "PROFESSIONAL" },
      {
        amount: 1000,
        method: "MPESA",
      },
    );

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("accepts amount at exact maximum", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 200000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    const result = await financeService.createWithdrawal(
      { userId: "user_1", role: "PROFESSIONAL" },
      {
        amount: 150000,
        method: "MPESA",
      },
    );

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });
});
