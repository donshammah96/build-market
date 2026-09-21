import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { getAdminSecurityHeaders } from "@/lib/security/security-headers";

describe("security-headers", () => {
  it("should return non-empty security headers array from security-headers helper", () => {
    const headers = getAdminSecurityHeaders();
    expect(headers.length).toBeGreaterThan(0);

    const keys = headers.map((h) => h.key);
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("Content-Security-Policy-Report-Only");
  });

  it("should configure headers in next.config.ts for all route paths", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const configuredHeaders = await nextConfig.headers!();

    expect(configuredHeaders).toHaveLength(1);
    const targetRoute = configuredHeaders[0];
    expect(targetRoute).toBeDefined();
    expect(targetRoute?.source).toBe("/:path*");

    const headerKeys = targetRoute?.headers.map((h) => h.key) ?? [];
    expect(headerKeys).toContain("X-Frame-Options");
    expect(headerKeys).toContain("X-Content-Type-Options");
    expect(headerKeys).toContain("Referrer-Policy");
    expect(headerKeys).toContain("Permissions-Policy");
    expect(headerKeys).toContain("Strict-Transport-Security");
    expect(headerKeys).toContain("Content-Security-Policy-Report-Only");
  });

  it("should ensure typescript ignoreBuildErrors is disabled in next.config.ts", () => {
    expect(nextConfig.typescript?.ignoreBuildErrors).toBe(false);
  });
});
