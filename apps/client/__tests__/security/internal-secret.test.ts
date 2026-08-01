import { describe, expect, it, vi, beforeEach } from "vitest";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";
import { env } from "@/app/lib/infrastructure/env";

describe("ensureValidInternalSecret", () => {
  const SECRET = "test-internal-secret-key-12345";

  beforeEach(() => {
    (env.services as { internalApiSecret: string }).internalApiSecret = SECRET;
  });

  it("returns null when secret is valid", () => {
    const res = ensureValidInternalSecret(SECRET);
    expect(res).toBeNull();
  });

  it("returns 403 when secret is missing/null", () => {
    const res = ensureValidInternalSecret(null);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("returns 403 when secret is incorrect", () => {
    const res = ensureValidInternalSecret("wrong-secret");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("returns 403 when secret has different length", () => {
    const res = ensureValidInternalSecret(SECRET + "extra");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("returns 503 when internalApiSecret environment variable is not configured", () => {
    (
      env.services as { internalApiSecret: string | undefined }
    ).internalApiSecret = undefined;
    const res = ensureValidInternalSecret(SECRET);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });
});
