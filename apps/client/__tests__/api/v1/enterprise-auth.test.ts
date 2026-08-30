import { describe, it, expect, vi } from "vitest";
import {
  hashApiKey,
  authenticateEnterpriseClient,
} from "../../../app/api/v1/shared/enterprise-auth";
import { prisma } from "@build/db";

vi.mock("@build/db", () => ({
  prisma: {
    enterpriseApiClient: {
      findUnique: vi.fn(),
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
});
