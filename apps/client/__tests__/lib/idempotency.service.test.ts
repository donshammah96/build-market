import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyStatus } from "@prisma/client";
import {
  IDEMPOTENCY_REPLAY_SCOPE_POLICIES,
  IdempotencyService,
} from "@/app/lib/services/idempotency.service";

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

  it("registers an explicit replay policy for every live idempotency scope", () => {
    expect(Object.keys(IDEMPOTENCY_REPLAY_SCOPE_POLICIES).sort()).toEqual([
      "calendar_event",
      "certificate",
      "complete-profile",
      "escrow",
      "idea-books",
      "lead",
      "messaging",
      "onboarding",
      "portfolio",
      "professional_document",
      "professional_license",
      "profile",
      "project",
      "project_milestone",
      "property",
      "property_inquiry",
      "service",
      "store",
      "transaction",
      "withdrawal",
    ]);
  });

  it("preserves reviewed Class B fields for registered business DTO scopes", async () => {
    await IdempotencyService.checkOrCreate("key-1", "store", "user-1", "POST", {
      entityConnect: { store: { connect: { id: "store-1" } } },
      ttlHours: 1,
    });

    await IdempotencyService.complete("key-1", {
      id: "store-1",
      email: "shop@example.com",
      address: "Nairobi",
      mpesaTillNumber: "12345",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "key-1" },
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
          response: {
            id: "store-1",
            email: "shop@example.com",
            address: "Nairobi",
            mpesaTillNumber: "12345",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      }),
    );
  });

  it("rejects Class B fields for scopes that are limited to Class C and Class D", async () => {
    await IdempotencyService.checkOrCreate(
      "key-2",
      "onboarding",
      "user-1",
      "POST",
      { ttlHours: 1 },
    );

    await expect(
      IdempotencyService.complete("key-2", {
        completed: true,
        email: "person@example.com",
      }),
    ).rejects.toThrow(/Class B/);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects Class A fields even when the scope allows reviewed Class B fields", async () => {
    await IdempotencyService.checkOrCreate("key-3", "store", "user-1", "POST", {
      entityConnect: { store: { connect: { id: "store-1" } } },
      ttlHours: 1,
    });

    await expect(
      IdempotencyService.complete("key-3", {
        id: "store-1",
        accessToken: "secret-token",
      }),
    ).rejects.toThrow(/Class A/);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("fails closed when an unregistered scope tries to persist replay data", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      scope: "unsupported_scope",
    });

    await expect(
      IdempotencyService.complete("key-4", { ok: true }),
    ).rejects.toThrow(/No idempotency replay policy/);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects reusing one idempotency key across different registered scopes", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      scope: "store",
      status: IdempotencyStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      IdempotencyService.checkOrCreate("key-4b", "property", "user-1", "POST", {
        entityConnect: { property: { connect: { id: "property-1" } } },
        ttlHours: 1,
      }),
    ).rejects.toThrow(/already bound to scope "store"/);

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("replays completed payloads only when the idempotency record is still valid", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      status: IdempotencyStatus.COMPLETED,
      response: { ok: true },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const replay = await IdempotencyService.checkOrCreate(
      "key-5",
      "store",
      "user-1",
      "POST",
      {
        entityConnect: { store: { connect: { id: "store-1" } } },
        ttlHours: 1,
      },
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
      "key-6",
      "store",
      "user-1",
      "POST",
      {
        entityConnect: { store: { connect: { id: "store-1" } } },
        ttlHours: 1,
      },
    );

    expect(mocks.delete).toHaveBeenCalledWith({ where: { key: "key-6" } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "new" });
  });
});
