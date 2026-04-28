import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@build/db", () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  County: {},
  StoreType: {},
  StoreCategory: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/store.config", () => ({
  STORE_CONFIG: {
    IDEMPOTENCY_KEY_TTL_HOURS: 1,
  },
}));

vi.mock("../../../lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("scoped-idempotency-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../shared", () => ({
  safeAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: "admin";
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "admin",
        });
        return { success: true, data, timestamp: new Date().toISOString() };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
      }
    },
  ),
  safeVerificationAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: "admin" | "verification_admin";
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "admin",
        });
        return { success: true, data, timestamp: new Date().toISOString() };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
      }
    },
  ),
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@build/db";
import { deleteStore, toggleStoreFeatured, verifyStore } from "../stores";
import { logAdminAction } from "../shared";
import { IdempotencyService } from "../../../lib/services/idempotency.service";

const IDEMPOTENCY_KEY = "idem-key-1";

describe("admin stores actions governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("rejects verifyStore when idempotency key is missing", async () => {
    const response = await verifyStore("store_1", "   ");

    expect(response.success).toBe(false);
    expect(response.error).toBe("Idempotency-Key is required");
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
    expect(prisma.store.update).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("returns cached response for verifyStore replay", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "completed",
      response: {
        verified: true,
        store: {
          id: "store_1",
          name: "Cached Store",
          verified: true,
        },
      },
    });

    const response = await verifyStore("store_1", IDEMPOTENCY_KEY);

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      verified: true,
      store: {
        id: "store_1",
        name: "Cached Store",
        verified: true,
      },
    });
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
    expect(prisma.store.update).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("applies idempotent toggleStoreFeatured mutation", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      featured: false,
    } as never);
    vi.mocked(prisma.store.update).mockResolvedValue({
      id: "store_1",
      name: "Store A",
      featured: true,
    } as never);

    const response = await toggleStoreFeatured("store_1", IDEMPOTENCY_KEY);

    expect(response.success).toBe(true);
    expect(prisma.store.update).toHaveBeenCalled();
    expect(IdempotencyService.complete).toHaveBeenCalled();
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "FEATURE_STORE",
        targetType: "store",
        targetId: "store_1",
      }),
    );
  });

  it("applies idempotent deleteStore mutation with audit", async () => {
    vi.mocked(prisma.store.delete).mockResolvedValue({
      id: "store_1",
      name: "Store A",
    } as never);

    const response = await deleteStore("store_1", IDEMPOTENCY_KEY);

    expect(response.success).toBe(true);
    expect(prisma.store.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "store_1" } }),
    );
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "DELETE_STORE",
        targetType: "store",
        targetId: "store_1",
      }),
    );
  });
});
