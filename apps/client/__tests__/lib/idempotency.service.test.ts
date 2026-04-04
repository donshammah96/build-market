import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyStatus } from "@prisma/client";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    idempotencyKey: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      delete: mocks.delete,
      update: mocks.update,
    },
  },
}));

describe("IdempotencyService replay data policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.delete.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
  });

  it("redacts sensitive fields before persisting replay payloads", async () => {
    await IdempotencyService.complete("key-1", {
      email: "person@example.com",
      profile: {
        phoneNumber: "+254700000000",
        displayName: "Jane Doe",
      },
      accessToken: "token-value",
      safeValue: "kept",
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "key-1" },
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
          response: {
            email: "[REDACTED]",
            profile: {
              phoneNumber: "[REDACTED]",
              displayName: "Jane Doe",
            },
            accessToken: "[REDACTED]",
            safeValue: "kept",
          },
        }),
      }),
    );
  });

  it("normalizes non-JSON replay values before persistence", async () => {
    await IdempotencyService.complete("key-2", {
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      sequence: BigInt(12),
      optional: undefined,
    });

    const updateCall = mocks.update.mock.calls[0]?.[0];
    expect(updateCall.data.response).toEqual({
      issuedAt: "2026-01-01T00:00:00.000Z",
      sequence: "12",
      optional: null,
    });
  });

  it("replays completed payloads only when the idempotency record is still valid", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      status: IdempotencyStatus.COMPLETED,
      response: { ok: true },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const replay = await IdempotencyService.checkOrCreate(
      "key-3",
      "store",
      "user-1",
      "POST",
      "store-1",
      1,
    );

    expect(replay).toEqual({ status: "completed", response: { ok: true } });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("recreates expired idempotency records instead of replaying stale payloads", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      status: IdempotencyStatus.COMPLETED,
      response: { ok: true },
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await IdempotencyService.checkOrCreate(
      "key-4",
      "store",
      "user-1",
      "POST",
      "store-1",
      1,
    );

    expect(mocks.delete).toHaveBeenCalledWith({ where: { key: "key-4" } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "new" });
  });
});
