import { describe, it, expect, vi } from "vitest";
import {
  hashApiKey,
  authenticateEnterpriseClient,
} from "../../../app/api/v1/shared/enterprise-auth";
import { prisma } from "@build/db";

import { env } from "../../../app/lib/infrastructure/env";

vi.mock("@build/db", () => ({
  prisma: {
    enterpriseApiClient: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Enterprise API Client Authentication", () => {
  it("computes deterministic sha256 hash from raw API key", () => {
    const rawKey = "bm_live_sec_123456789";
    const hash1 = hashApiKey(rawKey);
    const hash2 = hashApiKey(rawKey);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("rejects requests missing Bearer authorization header", async () => {
    const result = await authenticateEnterpriseClient(null, "directory:read");
    expect(result.authorized).toBe(false);
    expect(result.errorStatus).toBe(401);
  });

  it("authorizes valid active client with required scope", async () => {
    const rawKey = "bm_live_test_key_valid";
    const hashed = hashApiKey(rawKey);

    (prisma.enterpriseApiClient.findUnique as any).mockResolvedValue({
      id: "client-1",
      name: "Acme Analytics",
      hashedApiKey: hashed,
      scopes: ["directory:read"],
      rateLimitRpm: 60,
      isActive: true,
      revokedAt: null,
    });

    const result = await authenticateEnterpriseClient(
      `Bearer ${rawKey}`,
      "directory:read",
    );
    expect(result.authorized).toBe(true);
    expect(result.client.name).toBe("Acme Analytics");
  });

  it("rejects active client missing required scope", async () => {
    const rawKey = "bm_live_test_key_wrong_scope";
    const hashed = hashApiKey(rawKey);

    (prisma.enterpriseApiClient.findUnique as any).mockResolvedValue({
      id: "client-2",
      name: "Acme Data",
      hashedApiKey: hashed,
      scopes: ["market-data:read"],
      rateLimitRpm: 60,
      isActive: true,
      revokedAt: null,
    });

    const result = await authenticateEnterpriseClient(
      `Bearer ${rawKey}`,
      "directory:read",
    );
    expect(result.authorized).toBe(false);
    expect(result.errorStatus).toBe(403);
    expect(result.errorMessage).toContain("directory:read");
  });

  it("rejects revoked client API keys", async () => {
    const rawKey = "bm_live_test_key_revoked";
    const hashed = hashApiKey(rawKey);

    (prisma.enterpriseApiClient.findUnique as any).mockResolvedValue({
      id: "client-3",
      name: "Acme Old",
      hashedApiKey: hashed,
      scopes: ["directory:read"],
      rateLimitRpm: 60,
      isActive: true,
      revokedAt: new Date(),
    });

    const result = await authenticateEnterpriseClient(
      `Bearer ${rawKey}`,
      "directory:read",
    );
    expect(result.authorized).toBe(false);
    expect(result.errorStatus).toBe(403);
  });

  it("authenticates via fallback previous secret and updates record with current hash", async () => {
    const rawKey = "bm_live_test_key_migration";
    const currentHashed = hashApiKey(rawKey);
    const fallbackSecret = "previous_secret_123456789_value";
    const previousHashed = hashApiKey(rawKey, fallbackSecret);

    const originalSecret = (env.services as any)
      .enterpriseApiKeyPreviousHashSecret;
    (env.services as any).enterpriseApiKeyPreviousHashSecret = fallbackSecret;

    try {
      (prisma.enterpriseApiClient.findUnique as any).mockImplementation(
        ({ where }: any) => {
          if (where.hashedApiKey === currentHashed) return null;
          if (where.hashedApiKey === previousHashed) {
            return {
              id: "client-migration-1",
              name: "Migrating Client",
              hashedApiKey: previousHashed,
              scopes: ["directory:read"],
              rateLimitRpm: 60,
              isActive: true,
              revokedAt: null,
            };
          }
          return null;
        },
      );

      (prisma.enterpriseApiClient.update as any).mockResolvedValue({
        id: "client-migration-1",
        hashedApiKey: currentHashed,
      });

      const result = await authenticateEnterpriseClient(
        `Bearer ${rawKey}`,
        "directory:read",
      );

      expect(result.authorized).toBe(true);
      expect(result.client.name).toBe("Migrating Client");
      expect(prisma.enterpriseApiClient.update).toHaveBeenCalledWith({
        where: { id: "client-migration-1" },
        data: { hashedApiKey: currentHashed },
      });
    } finally {
      (env.services as any).enterpriseApiKeyPreviousHashSecret = originalSecret;
    }
  });

  it("rejects fallback client if inactive or revoked", async () => {
    const rawKey = "bm_live_test_key_fallback_revoked";
    const currentHashed = hashApiKey(rawKey);
    const fallbackSecret = "previous_secret_123456789_value";
    const previousHashed = hashApiKey(rawKey, fallbackSecret);

    const originalSecret = (env.services as any)
      .enterpriseApiKeyPreviousHashSecret;
    (env.services as any).enterpriseApiKeyPreviousHashSecret = fallbackSecret;

    try {
      (prisma.enterpriseApiClient.findUnique as any).mockImplementation(
        ({ where }: any) => {
          if (where.hashedApiKey === currentHashed) return null;
          if (where.hashedApiKey === previousHashed) {
            return {
              id: "client-migration-2",
              name: "Revoked Migrating Client",
              hashedApiKey: previousHashed,
              scopes: ["directory:read"],
              rateLimitRpm: 60,
              isActive: false,
              revokedAt: new Date(),
            };
          }
          return null;
        },
      );

      const result = await authenticateEnterpriseClient(
        `Bearer ${rawKey}`,
        "directory:read",
      );

      expect(result.authorized).toBe(false);
      expect(result.errorStatus).toBe(403);
      expect(prisma.enterpriseApiClient.update).not.toHaveBeenCalled();
    } finally {
      (env.services as any).enterpriseApiKeyPreviousHashSecret = originalSecret;
    }
  });
});
