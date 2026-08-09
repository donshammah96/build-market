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
  });

  it("includes required Clerk fallback directives in script-src-elem", () => {
    const csp = buildCspWithNonce(baseOptions);
    const directive = csp
      .split("; ")
      .find((value) => value.startsWith("script-src-elem"));

    expect(directive).toBeTruthy();
    expect(directive).toContain("'unsafe-inline'");
    expect(directive).toContain("'strict-dynamic'");
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

  describe("unsafe-eval gating", () => {
    it("omits 'unsafe-eval' from script-src in production", () => {
      const csp = buildCspWithNonce({ ...baseOptions, isDev: false });
      const scriptSrc = csp
        .split("; ")
        .find((v) => v.startsWith("script-src "));

      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it("includes 'unsafe-eval' in script-src only in dev", () => {
      const csp = buildCspWithNonce({ ...baseOptions, isDev: true });
      const scriptSrc = csp
        .split("; ")
        .find((v) => v.startsWith("script-src "));

      expect(scriptSrc).toContain("'unsafe-eval'");
    });

    it("never adds 'unsafe-eval' to script-src-elem regardless of env", () => {
      for (const isDev of [true, false]) {
        const csp = buildCspWithNonce({ ...baseOptions, isDev });
        const directive = csp
          .split("; ")
          .find((v) => v.startsWith("script-src-elem"));

        expect(directive).not.toContain("'unsafe-eval'");
      }
    });
  });

  describe("Clerk satellite origins", () => {
    it("does not include a wildcard buildmarket.app origin", () => {
      const csp = buildCspWithNonce(baseOptions);

      expect(csp).not.toContain("https://*.buildmarket.app");
    });

    it("includes explicitly-passed satellite origins in script-src and connect-src", () => {
      const csp = buildCspWithNonce({
        ...baseOptions,
        clerkSatelliteOrigins: ["https://clerk.admin.buildmarket.app"],
      });
      const scriptSrc = csp
        .split("; ")
        .find((v) => v.startsWith("script-src "));
      const connectSrc = csp
        .split("; ")
        .find((v) => v.startsWith("connect-src"));

      expect(scriptSrc).toContain("https://clerk.admin.buildmarket.app");
      expect(connectSrc).toContain("https://clerk.admin.buildmarket.app");
    });

    it("defaults to no satellite origins when omitted (fails closed)", () => {
      const csp = buildCspWithNonce(baseOptions);
      const scriptSrc = csp
        .split("; ")
        .find((v) => v.startsWith("script-src "));

      expect(scriptSrc).not.toContain("buildmarket.app/*");
    });
  });

  describe("style-src inline compatibility", () => {
    it("includes unsafe-inline and Vercel Live origins in style-src and style-src-elem", () => {
      const csp = buildCspWithNonce(baseOptions);

      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src-elem 'self' 'unsafe-inline'");
      expect(csp).toContain("https://vercel.live");
    });

    it("keeps style-src-attr unsafe-inline-only (nonces don't cover attributes)", () => {
      const csp = buildCspWithNonce(baseOptions);

      expect(csp).toContain("style-src-attr 'unsafe-inline'");
    });
  });

  describe("optional hardening directives", () => {
    it("adds upgrade-insecure-requests in production only", () => {
      const prod = buildCspWithNonce({ ...baseOptions, isDev: false });
      const dev = buildCspWithNonce({ ...baseOptions, isDev: true });

      expect(prod).toContain("upgrade-insecure-requests");
      expect(dev).not.toContain("upgrade-insecure-requests");
    });

    it("omits report-uri when not provided", () => {
      const csp = buildCspWithNonce(baseOptions);

      expect(csp).not.toContain("report-uri");
    });

    it("adds report-uri when provided", () => {
      const csp = buildCspWithNonce({
        ...baseOptions,
        reportUri: "/api/csp-report",
      });

      expect(csp).toContain("report-uri /api/csp-report");
    });

    it("includes frame-src with default Vercel Live origins", () => {
      const csp = buildCspWithNonce(baseOptions);

      expect(csp).toContain(
        "frame-src 'self' https://vercel.live https://*.vercel.live",
      );
    });

    it("adds Clerk challenge origins to frame-src when provided", () => {
      const csp = buildCspWithNonce({
        ...baseOptions,
        clerkChallengeOrigins: ["https://challenges.cloudflare.com"],
      });

      expect(csp).toContain(
        "frame-src 'self' https://vercel.live https://*.vercel.live https://challenges.cloudflare.com",
      );
    });
  });

  it("produces no empty directives regardless of option combination", () => {
    const csp = buildCspWithNonce({
      ...baseOptions,
      isDev: true,
      clerkFrontendApiOrigin: "https://clerk.example.com",
      analyticsOrigin: "https://analytics.example.com",
      clerkSatelliteOrigins: ["https://clerk.admin.buildmarket.app"],
      clerkChallengeOrigins: ["https://challenges.cloudflare.com"],
      reportUri: "/api/csp-report",
    });

    expect(csp.split("; ").every((part) => part.trim().length > 0)).toBe(true);
  });
});
