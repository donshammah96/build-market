import { describe, expect, it } from "vitest";
import {
  buildCspWithNonce,
  generateCspNonce,
} from "@/app/lib/security/middleware/csp-nonce";

const baseOptions = {
  nonce: "nonce-value",
  appOrigin: "https://app.example.com",
  apiOrigin: "https://api.example.com",
  clerkFrontendApiOrigin: null,
  analyticsOrigin: null,
  isDev: false,
};

describe("csp nonce helpers", () => {
  it("generates a base64 nonce", () => {
    const nonce = generateCspNonce();

    expect(nonce.length).toBeGreaterThanOrEqual(24);
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("generates unique nonces on successive calls", () => {
    const nonces = new Set(Array.from({ length: 50 }, generateCspNonce));

    expect(nonces.size).toBe(50);
  });

  it("builds script-src-elem with a nonce", () => {
    const csp = buildCspWithNonce(baseOptions);

    expect(csp).toContain("script-src 'nonce-nonce-value'");
    expect(csp).toContain("script-src-elem 'nonce-nonce-value'");
    expect(csp).not.toContain("script-src-elem 'unsafe-inline'");
  });

  it("does not include unsafe-inline in script-src-elem", () => {
    const csp = buildCspWithNonce(baseOptions);
    const directive = csp
      .split("; ")
      .find((value) => value.startsWith("script-src-elem"));

    expect(directive).toBeTruthy();
    expect(directive).not.toContain("unsafe-inline");
  });

  it("handles nonce values with special characters", () => {
    const csp = buildCspWithNonce({
      ...baseOptions,
      nonce: "abc+def/gh==",
    });

    expect(csp).toContain("script-src-elem 'nonce-abc+def/gh=='");
    expect(csp.split(";").every((part) => part.trim().length > 0)).toBe(true);
  });

  it("retains core CSP directives", () => {
    const csp = buildCspWithNonce({
      ...baseOptions,
      clerkFrontendApiOrigin: "https://clerk.example.com",
      analyticsOrigin: "https://analytics.example.com",
      isDev: true,
    });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src");
    expect(csp).toContain("img-src");
    expect(csp).toContain("font-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
  });
});
