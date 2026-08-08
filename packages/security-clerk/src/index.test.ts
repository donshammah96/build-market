import { describe, expect, it, vi } from "vitest";
import {
  deriveFallbackPrimarySignInUrl,
  getSafeRedirectUrl,
  isAbsoluteHttpUrl,
  isClaimFresh,
  normalizeClerkDomain,
  resolvePrimarySignInUrl,
} from "./index.js";

describe("security-clerk", () => {
  describe("isAbsoluteHttpUrl", () => {
    it("validates absolute http(s) URLs", () => {
      expect(isAbsoluteHttpUrl("http://localhost:3500")).toBe(true);
      expect(isAbsoluteHttpUrl("https://buildmarket.app")).toBe(true);
    });

    it("rejects non-absolute/invalid URLs", () => {
      expect(isAbsoluteHttpUrl("/relative/path")).toBe(false);
      expect(isAbsoluteHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isAbsoluteHttpUrl(null)).toBe(false);
      expect(isAbsoluteHttpUrl(undefined)).toBe(false);
    });
  });

  describe("normalizeClerkDomain", () => {
    it("strips schemes and returns bare hostname", () => {
      expect(normalizeClerkDomain("https://admin.buildmarket.app")).toBe(
        "admin.buildmarket.app",
      );
      expect(normalizeClerkDomain("http://admin.buildmarket.app/")).toBe(
        "admin.buildmarket.app",
      );
    });

    it("returns plain host string if no scheme present", () => {
      expect(normalizeClerkDomain("admin.buildmarket.app")).toBe(
        "admin.buildmarket.app",
      );
      expect(normalizeClerkDomain("  admin.buildmarket.app  ")).toBe(
        "admin.buildmarket.app",
      );
    });

    it("returns null for empty or invalid inputs", () => {
      expect(normalizeClerkDomain(null)).toBeNull();
      expect(normalizeClerkDomain(undefined)).toBeNull();
      expect(normalizeClerkDomain("")).toBeNull();
      expect(normalizeClerkDomain("   ")).toBeNull();
    });
  });

  describe("deriveFallbackPrimarySignInUrl", () => {
    it("derives apex sign-in URL from subdomain host", () => {
      const req = {
        nextUrl: {
          protocol: "https:",
          host: "admin.buildmarket.app",
        },
      };
      expect(deriveFallbackPrimarySignInUrl(req)).toBe(
        "https://buildmarket.app/sign-in",
      );
    });

    it("returns null for apex hosts (2 or fewer labels)", () => {
      const req = {
        nextUrl: {
          protocol: "https:",
          host: "buildmarket.app",
        },
      };
      expect(deriveFallbackPrimarySignInUrl(req)).toBeNull();
    });

    it("returns null for preview host domains like vercel.app", () => {
      const req = {
        nextUrl: {
          protocol: "https:",
          host: "my-preview-app.vercel.app",
        },
      };
      expect(deriveFallbackPrimarySignInUrl(req)).toBeNull();
    });
  });

  describe("resolvePrimarySignInUrl", () => {
    it("uses configured URL if it is absolute HTTP(S)", () => {
      const req = {
        nextUrl: { protocol: "https:", host: "admin.buildmarket.app" },
      };
      const result = resolvePrimarySignInUrl(
        req,
        "https://buildmarket.app/custom-sign-in",
      );
      expect(result).toBe("https://buildmarket.app/custom-sign-in");
    });

    it("falls back to derived URL and logs error if configured URL is invalid", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const req = {
        nextUrl: { protocol: "https:", host: "admin.buildmarket.app" },
      };
      const result = resolvePrimarySignInUrl(req, "/relative-sign-in");
      expect(result).toBe("https://buildmarket.app/sign-in");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("is not an absolute http(s) URL"),
      );
      consoleSpy.mockRestore();
    });

    it("memoizes resolved result on request object via WeakMap", () => {
      const req = {
        nextUrl: { protocol: "https:", host: "admin.buildmarket.app" },
      };
      const first = resolvePrimarySignInUrl(
        req,
        "https://buildmarket.app/sign-in",
      );
      // Pass invalid on 2nd call to prove WeakMap cache is returned without re-resolving/logging
      const second = resolvePrimarySignInUrl(req, "/invalid");
      expect(second).toBe(first);
    });
  });

  describe("getSafeRedirectUrl", () => {
    it("allows valid relative paths", () => {
      expect(getSafeRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/profile/settings?foo=bar")).toBe(
        "/profile/settings?foo=bar",
      );
    });

    it("blocks protocol-relative or malicious relative paths", () => {
      expect(getSafeRedirectUrl("//evil.com")).toBeNull();
      expect(getSafeRedirectUrl("/\\evil.com")).toBeNull();
      expect(getSafeRedirectUrl("/:evil.com")).toBeNull();
    });

    it("allows *.buildmarket.app absolute targets", () => {
      expect(getSafeRedirectUrl("https://buildmarket.app/login")).toBe(
        "https://buildmarket.app/login",
      );
      expect(
        getSafeRedirectUrl("https://verification.buildmarket.app/ops"),
      ).toBe("https://verification.buildmarket.app/ops");
    });

    it("allows matching hosts in AllowedEnvUrls", () => {
      const envUrls = {
        adminAppUrl: "https://admin-staging.example.com",
      };
      expect(
        getSafeRedirectUrl("https://admin-staging.example.com/login", envUrls),
      ).toBe("https://admin-staging.example.com/login");
    });

    it("allows localhost loopback targets", () => {
      expect(getSafeRedirectUrl("http://localhost:3500/dashboard")).toBe(
        "http://localhost:3500/dashboard",
      );
      expect(getSafeRedirectUrl("http://127.0.0.1:3001/dashboard")).toBe(
        "http://127.0.0.1:3001/dashboard",
      );
    });

    it("blocks unknown external hosts", () => {
      expect(getSafeRedirectUrl("https://evil.com/phishing")).toBeNull();
    });
  });

  describe("isClaimFresh", () => {
    it("returns true when claim iat is within maxAgeSeconds", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const sessionClaims = { iat: nowSeconds - 60 }; // 60 seconds ago
      expect(isClaimFresh(sessionClaims, 180)).toBe(true);
    });

    it("returns false when claim iat is older than maxAgeSeconds", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const sessionClaims = { iat: nowSeconds - 200 }; // 200 seconds ago
      expect(isClaimFresh(sessionClaims, 180)).toBe(false);
    });

    it("returns false for missing, invalid, or non-numeric iat", () => {
      expect(isClaimFresh(null, 180)).toBe(false);
      expect(isClaimFresh({}, 180)).toBe(false);
      expect(isClaimFresh({ iat: "invalid" }, 180)).toBe(false);
    });
  });
});
