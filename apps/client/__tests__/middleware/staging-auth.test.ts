import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  handleStagingProtection,
  isStagingProtectionExempt,
  parseBasicAuthHeader,
} from "@/app/lib/security/middleware/staging-auth";
import { env } from "@/app/lib/infrastructure/env";

describe("staging environment protection (anti-crawling & basic auth)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseBasicAuthHeader", () => {
    it("parses valid Basic auth credentials", () => {
      // "buildmarket:stagingsecret123" -> base64 "YnVpbGRtYXJrZXQ6c3RhZ2luZ3NlY3JldDEyMw=="
      const authHeader = "Basic YnVpbGRtYXJrZXQ6c3RhZ2luZ3NlY3JldDEyMw==";
      const parsed = parseBasicAuthHeader(authHeader);

      expect(parsed).toEqual({
        user: "buildmarket",
        pass: "stagingsecret123",
      });
    });

    it("returns null for null, empty, or non-Basic authorization headers", () => {
      expect(parseBasicAuthHeader(null)).toBeNull();
      expect(parseBasicAuthHeader("")).toBeNull();
      expect(parseBasicAuthHeader("Bearer token123")).toBeNull();
      expect(parseBasicAuthHeader("Basic ")).toBeNull();
      expect(parseBasicAuthHeader("Basic invalid_no_colon")).toBeNull();
    });
  });

  describe("isStagingProtectionExempt", () => {
    it("exempts /api/healthz liveness probe", () => {
      const req = new NextRequest("http://localhost:3500/api/healthz");
      expect(isStagingProtectionExempt(req)).toBe(true);
    });

    it("exempts third-party webhooks (/api/webhooks/*)", () => {
      const clerkWebhook = new NextRequest(
        "http://localhost:3500/api/webhooks/clerk",
      );
      const stripeWebhook = new NextRequest(
        "http://localhost:3500/api/webhooks/stripe",
      );
      const resendWebhook = new NextRequest(
        "http://localhost:3500/api/webhooks/resend",
      );

      expect(isStagingProtectionExempt(clerkWebhook)).toBe(true);
      expect(isStagingProtectionExempt(stripeWebhook)).toBe(true);
      expect(isStagingProtectionExempt(resendWebhook)).toBe(true);
    });

    it("exempts /.well-known/ routes for SSL/DCV verification", () => {
      const challengeReq = new NextRequest(
        "http://localhost:3500/.well-known/cf-custom-hostname-challenge/5530422d-4eae-4414-a450-a4da56a18772",
      );
      expect(isStagingProtectionExempt(challengeReq)).toBe(true);
    });

    it("does not exempt standard public or protected pages", () => {
      const homeReq = new NextRequest("http://localhost:3500/");
      const leadsReq = new NextRequest("http://localhost:3500/leads");
      const apiReq = new NextRequest("http://localhost:3500/api/properties");

      expect(isStagingProtectionExempt(homeReq)).toBe(false);
      expect(isStagingProtectionExempt(leadsReq)).toBe(false);
      expect(isStagingProtectionExempt(apiReq)).toBe(false);
    });
  });

  describe("handleStagingProtection", () => {
    it("no-ops (returns null) when stagingAuth is disabled (production safety invariant)", () => {
      // Ensure stagingAuth is disabled
      (env as any).stagingAuth = {
        isEnabled: false,
        user: "buildmarket",
        password: "secretpassword",
        secret: "sharedsecret",
      };

      const req = new NextRequest("http://localhost:3500/");
      const result = handleStagingProtection(req);

      expect(result).toBeNull();
    });

    describe("when stagingAuth is enabled (DD_ENV === 'staging')", () => {
      beforeEach(() => {
        (env as any).stagingAuth = {
          isEnabled: true,
          user: "buildmarket",
          password: "superstagingpassword",
          secret: "sharedstagingsecret",
        };
      });

      it("returns 401 with WWW-Authenticate header for unauthenticated requests", () => {
        const req = new NextRequest("http://localhost:3500/");
        const result = handleStagingProtection(req);

        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
        expect(result?.headers.get("WWW-Authenticate")).toContain(
          'Basic realm="BuildMarket Staging"',
        );
      });

      it("allows requests with valid HTTP Basic Auth credentials", () => {
        // "buildmarket:superstagingpassword" -> base64 "YnVpbGRtYXJrZXQ6c3VwZXJzdGFnaW5ncGFzc3dvcmQ="
        const req = new NextRequest("http://localhost:3500/dashboard", {
          headers: {
            authorization: "Basic YnVpbGRtYXJrZXQ6c3VwZXJzdGFnaW5ncGFzc3dvcmQ=",
          },
        });

        const result = handleStagingProtection(req);
        expect(result).toBeNull();
      });

      it("blocks requests with incorrect HTTP Basic Auth credentials", () => {
        // "buildmarket:wrongpassword" -> base64 "YnVpbGRtYXJrZXQ6d3JvbmdwYXNzd29yZA=="
        const req = new NextRequest("http://localhost:3500/dashboard", {
          headers: {
            authorization: "Basic YnVpbGRtYXJrZXQ6d3JvbmdwYXNzd29yZA==",
          },
        });

        const result = handleStagingProtection(req);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
      });

      it("allows requests with valid x-staging-secret header", () => {
        const req = new NextRequest("http://localhost:3500/api/properties", {
          headers: {
            "x-staging-secret": "sharedstagingsecret",
          },
        });

        const result = handleStagingProtection(req);
        expect(result).toBeNull();
      });

      it("allows requests with valid bm_staging_auth cookie", () => {
        const req = new NextRequest("http://localhost:3500/", {
          headers: {
            cookie: "bm_staging_auth=sharedstagingsecret",
          },
        });

        const result = handleStagingProtection(req);
        expect(result).toBeNull();
      });

      it("exempts webhook requests even without credentials", () => {
        const webhookReq = new NextRequest(
          "http://localhost:3500/api/webhooks/clerk",
          {
            method: "POST",
          },
        );

        const result = handleStagingProtection(webhookReq);
        expect(result).toBeNull();
      });
    });
  });
});
