import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  DELETE,
  GET,
  PATCH,
} from "@/app/api/professional-portal/finance/transactions/[id]/route";
import { POST } from "@/app/api/professional-portal/finance/withdraw/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { financeService } from "@/app/lib/domains/finance";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockFail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockComplete = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGenerateKey = vi.hoisted(() => vi.fn().mockReturnValue("idem-key"));
const mockCheckOrCreate = vi.hoisted(() => vi.fn());
const mockGetTransactionDetail = vi.hoisted(() => vi.fn());
const mockUpdateTransaction = vi.hoisted(() => vi.fn());
const mockDeleteTransaction = vi.hoisted(() => vi.fn());
const mockCreateWithdrawal = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "pro@example.com",
          userRole: "professional",
        },
        { id: "txn_123" },
      );
  },
}));

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: mockGenerateKey,
    checkOrCreate: mockCheckOrCreate,
    fail: mockFail,
    complete: mockComplete,
  },
}));

vi.mock("@/app/lib/domains/finance", () => ({
  financeService: {
    getTransactionDetail: mockGetTransactionDetail,
    updateTransaction: mockUpdateTransaction,
    deleteTransaction: mockDeleteTransaction,
    createWithdrawal: mockCreateWithdrawal,
  },
  UpdateTransactionSchema: {
    safeParse: vi.fn((body: unknown) => ({ success: true, data: body })),
  },
  WithdrawSchema: {
    safeParse: vi.fn((body: unknown) => ({ success: true, data: body })),
  },
}));

describe("professional finance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockCheckOrCreate.mockResolvedValue({ status: "new" });
  });

  it("returns the serialized transaction detail for the authenticated professional", async () => {
    mockGetTransactionDetail.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "txn_123",
        amount: 1250.5,
        platformFee: 50,
        taxAmount: 16,
        netAmount: 1184.5,
        status: "SUCCESS",
        type: "WITHDRAWAL",
        category: "WITHDRAWAL",
        method: "MPESA",
        description: "Withdrawal",
        currency: "KES",
        referenceCode: "REF-123",
        date: new Date("2026-03-10T12:00:00.000Z"),
        completedAt: null,
        createdAt: new Date("2026-03-10T12:00:00.000Z"),
        leadId: null,
        subscriptionId: null,
        failedReason: null,
        providerMetadata: null,
        updatedAt: new Date("2026-03-10T12:00:00.000Z"),
        project: null,
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/transactions/txn_123",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(financeService.getTransactionDetail).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      "txn_123",
    );
    expect(payload.data.amount).toBe(1250.5);
    expect(payload.data.netAmount).toBe(1184.5);
  });

  it("updates transaction descriptions and completes idempotency records", async () => {
    mockUpdateTransaction.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "txn_123",
        amount: 1200,
        platformFee: 50,
        taxAmount: 16,
        netAmount: 1134,
        status: "SUCCESS",
        type: "WITHDRAWAL",
        category: "WITHDRAWAL",
        method: "MPESA",
        description: "Updated note",
        currency: "KES",
        referenceCode: "REF-123",
        date: new Date("2026-03-10T12:00:00.000Z"),
        completedAt: null,
        createdAt: new Date("2026-03-10T12:00:00.000Z"),
        leadId: null,
        subscriptionId: null,
        failedReason: null,
        providerMetadata: null,
        updatedAt: new Date("2026-03-10T12:00:00.000Z"),
        project: null,
      },
    });

    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/transactions/txn_123",
        {
          method: "PATCH",
          body: JSON.stringify({ description: "Updated note" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(financeService.updateTransaction).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      "txn_123",
      { description: "Updated note" },
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith(
      "idem-key",
      expect.objectContaining({ description: "Updated note" }),
    );
    expect(payload.data.description).toBe("Updated note");
  });

  it("rejects deletion for non-deletable transactions", async () => {
    mockDeleteTransaction.mockResolvedValueOnce({
      ok: false,
      error: "not_deletable",
      message: "Only PENDING or CANCELLED transactions can be deleted",
      status: 400,
    });

    const response = await DELETE(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/transactions/txn_123",
        { method: "DELETE" },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(financeService.deleteTransaction).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      "txn_123",
    );
    expect(payload.error).toContain("Only PENDING or CANCELLED transactions");
  });

  it("creates withdrawals and returns the created domain payload", async () => {
    mockCreateWithdrawal.mockResolvedValue({
      ok: true,
      data: {
        id: "withdrawal_1",
        amount: 5000,
        method: "MPESA",
        status: "PENDING",
      },
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amount: 5000, method: "MPESA" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(financeService.createWithdrawal).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      {
        amount: 5000,
        method: "MPESA",
        description: undefined,
      },
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      id: "withdrawal_1",
      amount: 5000,
      method: "MPESA",
      status: "PENDING",
    });
    expect(payload.data.id).toBe("withdrawal_1");
  });

  it("maps domain withdrawal business-rule failures to bad requests", async () => {
    mockCreateWithdrawal.mockResolvedValue({
      ok: false,
      error: "below_minimum",
      message: "Withdrawal amount is below the minimum of 100 KES",
      min: 100,
      status: 400,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amount: 50, method: "MPESA" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
    expect(payload.error).toContain("minimum of 100 KES");
  });
});
