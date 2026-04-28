import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWithdrawal } from "@/lib/services/finance";

const mockGetFinancialSettings = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());

vi.mock("@build/db/system-settings", () => ({
  getFinancialSettings: (...args: unknown[]) =>
    mockGetFinancialSettings(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    professionalTransaction: {
      create: (...args: unknown[]) => mockCreate(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
  },
}));

describe("createWithdrawal - withdrawal limits", () => {
  beforeEach(() => {
    mockGetFinancialSettings.mockReset();
    mockGetFinancialSettings.mockResolvedValue({
      minWithdrawalKes: 1000,
      maxWithdrawalKes: 150000,
      platformCommission: 5,
      vatRate: 16,
      withholdingTaxRate: 5,
      currency: "KES",
    });

    mockAggregate.mockResolvedValue({ _sum: { netAmount: 10000 } });
    mockCreate.mockResolvedValue({
      id: "tx_1",
      amount: 5000,
      netAmount: 5000,
      status: "PENDING",
    });
  });

  it("rejects amount below minimum", async () => {
    const result = await createWithdrawal("user_1", {
      amount: 500,
      method: "MPESA",
    });

    expect("error" in result).toBe(true);
    if ("error" in result && result.error === "below_minimum") {
      expect(result.error).toBe("below_minimum");
      expect(result.min).toBe(1000);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects amount above maximum", async () => {
    const result = await createWithdrawal("user_1", {
      amount: 200000,
      method: "MPESA",
    });

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

    const result = await createWithdrawal("user_1", {
      amount: 5000,
      method: "MPESA",
    });

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("accepts amount at exact minimum", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 5000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    const result = await createWithdrawal("user_1", {
      amount: 1000,
      method: "MPESA",
    });

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("accepts amount at exact maximum", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { netAmount: 200000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    const result = await createWithdrawal("user_1", {
      amount: 150000,
      method: "MPESA",
    });

    expect("data" in result).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });
});
