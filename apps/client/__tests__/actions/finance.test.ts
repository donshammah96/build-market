import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestWithdrawalAction } from "@/app/actions/finance";
import { financeService } from "@/app/lib/domains/finance";
import type { FinanceTransactionDetail } from "@/app/lib/domains/finance/contracts";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const { authMock, userFindUniqueMock, revalidatePathMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/app/lib/domains/finance", () => ({
  financeService: {
    createWithdrawal: vi.fn(),
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("finance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_123" });
    userFindUniqueMock.mockResolvedValue({
      id: "db_user_123",
      email: "pro@example.com",
      role: "PROFESSIONAL",
    });
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    } as never);
  });

  function buildWithdrawalDetail(
    overrides: Partial<FinanceTransactionDetail> = {},
  ): FinanceTransactionDetail {
    return {
      id: "withdrawal_1",
      type: "WITHDRAWAL",
      category: "WITHDRAWAL",
      method: "MPESA",
      status: "PENDING",
      description: "Weekly payout",
      amount: 5000,
      platformFee: 0,
      taxAmount: 0,
      netAmount: 5000,
      currency: "KES",
      referenceCode: null,
      date: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      project: null,
      leadId: null,
      subscriptionId: null,
      failedReason: null,
      providerMetadata: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("returns a structured unauthorized failure when the actor is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const result = await requestWithdrawalAction({
      amount: 5000,
      method: "MPESA",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "unauthorized",
        message: "Unauthorized",
        status: 401,
      },
    });
    expect(financeService.createWithdrawal).not.toHaveBeenCalled();
  });

  it("returns a structured validation failure for invalid withdrawal input", async () => {
    const result = await requestWithdrawalAction({
      amount: 0,
      method: "MPESA",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation_error",
        message: "Amount must be positive",
        status: 400,
        details: expect.any(Array),
      },
    });
    expect(financeService.createWithdrawal).not.toHaveBeenCalled();
  });

  it("returns the stored response for completed idempotent requests", async () => {
    const storedResponse = buildWithdrawalDetail();

    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValueOnce({
      status: "completed",
      response: storedResponse,
    } as never);

    const result = await requestWithdrawalAction({
      amount: 5000,
      method: "MPESA",
    });

    expect(result).toEqual({
      success: true,
      data: storedResponse,
    });
    expect(financeService.createWithdrawal).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/finance",
    );
  });

  it("creates a withdrawal through the finance domain and revalidates finance pages", async () => {
    const createdWithdrawal = buildWithdrawalDetail();

    vi.mocked(financeService.createWithdrawal).mockResolvedValue({
      ok: true,
      data: createdWithdrawal,
    });

    const result = await requestWithdrawalAction({
      amount: 5000,
      method: "MPESA",
      description: "Weekly payout",
    });

    expect(financeService.createWithdrawal).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      {
        amount: 5000,
        method: "MPESA",
        description: "Weekly payout",
      },
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith(
      "idem-key",
      createdWithdrawal,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/finance",
    );
    expect(result).toEqual({
      success: true,
      data: createdWithdrawal,
    });
  });

  it("fails the idempotency record and returns a structured domain failure", async () => {
    vi.mocked(financeService.createWithdrawal).mockResolvedValue({
      ok: false,
      error: "below_minimum",
      message: "Withdrawal amount is below the minimum of 100 KES",
      min: 100,
      status: 400,
    });

    const result = await requestWithdrawalAction({
      amount: 50,
      method: "MPESA",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "invalid_input",
        message: "Withdrawal amount is below the minimum of 100 KES",
        status: 400,
        details: { min: 100 },
      },
    });
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });
});
