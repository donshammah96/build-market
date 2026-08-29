import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  deriveFallbackPrimarySignInUrl,
  getSafeRedirectUrl,
  isAbsoluteHttpUrl,
  isClaimFresh,
  resolvePrimarySignInUrl,
} from "@build/security-clerk";
import { isBlockedUserStatus } from "@build/enums";
import { verifySatelliteEnv } from "../scripts/verify-vercel-env";

/**
 * tests/satellite-auth-hardening.test.ts
 * ============================================================================
 * Covers the six regression scenarios called out in
 * AUTH_HARDENING_RECOMMENDATIONS.md / SATELLITE_DOMAIN_AUTH_AUTOPSY.md that
 * motivated the @build/security-clerk / @build/env-validation extraction.
 *
 * SCOPE NOTE on item 3 (blocked-status-before-role ordering): the real
 * ordering lives inside `clerkMiddleware(...)` closures in
 * apps/admin/src/middleware.ts and apps/verification-ops/middleware.ts,
 * which aren't exported as standalone testable functions (they're wrapped
 * by Clerk's middleware factory and expect a real NextRequest). Rather than
 * stand up a Clerk request-mocking harness here, this test exercises a
 * minimal reference implementation of the shared contract both middleware
 * files follow — "check isBlockedUserStatus first; only fall through to
 * role checks if not blocked" — using the same `isBlockedUserStatus` import
 * both files use. This proves the *predicate contract* both middlewares are
 * built on, not the two Next.js `NextResponse` call sites directly. A
 * true end-to-end test of the actual middleware exports would need
 * `@clerk/testing` (or equivalent NextRequest/Clerk session mocks) wired
 * into the app's own test setup — flagged as a follow-up, not attempted
 * here to avoid a partial/misleading mock of Clerk's session resolution.
 */

function buildReq(host: string, protocol = "https:") {
  return { nextUrl: { protocol, host } };
}

describe("1. Rejection of relative NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL", () => {
  it("isAbsoluteHttpUrl rejects a relative path", () => {
    expect(isAbsoluteHttpUrl("/sign-in")).toBe(false);
  });

  it("isAbsoluteHttpUrl rejects protocol-relative and non-http(s) schemes", () => {
    expect(isAbsoluteHttpUrl("//buildmarket.app/sign-in")).toBe(false);
    expect(isAbsoluteHttpUrl("ftp://buildmarket.app/sign-in")).toBe(false);
    expect(isAbsoluteHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("isAbsoluteHttpUrl accepts absolute http(s) URLs", () => {
    expect(isAbsoluteHttpUrl("https://accounts.buildmarket.app/sign-in")).toBe(
      true,
    );
    expect(isAbsoluteHttpUrl("http://localhost:3500/sign-in")).toBe(true);
  });

  it("resolvePrimarySignInUrl does NOT pass through a relative configured value", () => {
    const req = buildReq("admin.buildmarket.app");
    const resolved = resolvePrimarySignInUrl(req, "/sign-in", "test");
    // Must not equal the raw relative value — it should fall back to
    // host-derivation instead of silently accepting the relative path.
    expect(resolved).not.toBe("/sign-in");
    expect(resolved).toBe("https://buildmarket.app/sign-in");
  });
});

describe("2. deriveFallbackPrimarySignInUrl and shared-hosting preview suffixes", () => {
  it("returns null for a bare *.vercel.app host (no safe apex to derive)", () => {
    const req = buildReq("build-market-admin-git-feature-x.vercel.app");
    expect(deriveFallbackPrimarySignInUrl(req)).toBeNull();
  });

  it("returns null for a bare *.vercel.sh host", () => {
    const req = buildReq("build-market-admin-git-feature-x.vercel.sh");
    expect(deriveFallbackPrimarySignInUrl(req)).toBeNull();
  });

  it("derives an apex sign-in URL for a real subdomain", () => {
    const req = buildReq("admin.buildmarket.app");
    expect(deriveFallbackPrimarySignInUrl(req)).toBe(
      "https://buildmarket.app/sign-in",
    );
  });

  it("returns null when the host has no subdomain to strip", () => {
    const req = buildReq("buildmarket.app");
    expect(deriveFallbackPrimarySignInUrl(req)).toBeNull();
  });
});

describe("3. Blocked-status gate fires before role checks (shared predicate contract)", () => {
  type AccessMetadata = { status?: string; role?: string };

  /**
   * Minimal reference implementation of the ordering both
   * apps/admin/src/middleware.ts and apps/verification-ops/middleware.ts
   * follow: blocked-status short-circuits to "denied: blocked" before role
   * is ever consulted, even when the role itself would otherwise pass.
   */
  function evaluateAccess(
    metadata: AccessMetadata | undefined,
    hasAllowedRole: (role: string | undefined) => boolean,
  ): { allowed: boolean; reason?: "blocked" | "not_admin" } {
    if (isBlockedUserStatus(metadata?.status)) {
      return { allowed: false, reason: "blocked" };
    }
    if (!hasAllowedRole(metadata?.role)) {
      return { allowed: false, reason: "not_admin" };
    }
    return { allowed: true };
  }

  it("denies a blocked user even with a valid ADMIN role", () => {
    const result = evaluateAccess(
      { status: "SUSPENDED", role: "ADMIN" },
      (role) => role === "ADMIN",
    );
    expect(result).toEqual({ allowed: false, reason: "blocked" });
  });

  it("denies with not_admin reason (not blocked reason) for a non-blocked, wrong-role user", () => {
    const result = evaluateAccess(
      { status: "ACTIVE", role: "CLIENT" },
      (role) => role === "ADMIN",
    );
    expect(result).toEqual({ allowed: false, reason: "not_admin" });
  });

  it("allows a non-blocked user with an allowed role", () => {
    const result = evaluateAccess(
      { status: "ACTIVE", role: "ADMIN" },
      (role) => role === "ADMIN",
    );
    expect(result).toEqual({ allowed: true });
  });

  it.each(["SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"])(
    "treats %s as blocked regardless of role",
    (status) => {
      const result = evaluateAccess(
        { status, role: "ADMIN" },
        () => true, // role check would always pass
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("blocked");
    },
  );
});

describe("4. WeakMap memoization — resolvePrimarySignInUrl runs its resolution exactly once per request", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("logs the misconfiguration once, not twice, for two calls with the same req", () => {
    const req = buildReq("admin.buildmarket.app");

    const first = resolvePrimarySignInUrl(req, "/not-absolute", "test");
    const second = resolvePrimarySignInUrl(req, "/not-absolute", "test");

    expect(first).toBe(second);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves and logs independently for two distinct req objects", () => {
    const reqA = buildReq("admin.buildmarket.app");
    const reqB = buildReq("verification.buildmarket.app");

    resolvePrimarySignInUrl(reqA, "/not-absolute", "test");
    resolvePrimarySignInUrl(reqB, "/not-absolute", "test");

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("returns the same cached result on repeated calls even without a configured value", () => {
    const req = buildReq("client.buildmarket.app");
    const first = resolvePrimarySignInUrl(req);
    const second = resolvePrimarySignInUrl(req);
    expect(first).toBe(second);
    expect(first).toBe("https://buildmarket.app/sign-in");
  });
});

describe("5. getSafeRedirectUrl validation across relative/absolute targets", () => {
  it("allows a same-app relative path", () => {
    expect(getSafeRedirectUrl("/homeowner-dashboard")).toBe(
      "/homeowner-dashboard",
    );
  });

  it("rejects protocol-relative and backslash-prefixed paths (open-redirect shapes)", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBeNull();
    expect(getSafeRedirectUrl("/\\evil.com")).toBeNull();
  });

  it("allows any *.buildmarket.app subdomain", () => {
    expect(
      getSafeRedirectUrl("https://verification.buildmarket.app/queue"),
    ).toBe("https://verification.buildmarket.app/queue");
    expect(getSafeRedirectUrl("https://buildmarket.app/")).toBe(
      "https://buildmarket.app/",
    );
  });

  it("rejects an arbitrary external origin", () => {
    expect(getSafeRedirectUrl("https://evil.com/phish")).toBeNull();
  });

  it("allows a configured envUrls origin even off the buildmarket.app apex", () => {
    const envUrls = {
      appUrl: "https://buildmarket.app",
      adminAppUrl: "https://build-market-admin-preview.vercel.app",
      clientAppUrl: undefined,
      verificationAppUrl: undefined,
    };
    expect(
      getSafeRedirectUrl(
        "https://build-market-admin-preview.vercel.app/dashboard",
        envUrls,
      ),
    ).toBe("https://build-market-admin-preview.vercel.app/dashboard");
  });

  it("rejects a preview origin that is NOT in the configured envUrls allow-list", () => {
    const envUrls = {
      appUrl: "https://buildmarket.app",
      adminAppUrl: "https://build-market-admin-preview.vercel.app",
    };
    expect(
      getSafeRedirectUrl(
        "https://some-other-preview.vercel.app/dashboard",
        envUrls,
      ),
    ).toBeNull();
  });

  it("allows localhost for local dev", () => {
    expect(getSafeRedirectUrl("http://localhost:3000/onboarding")).toBe(
      "http://localhost:3000/onboarding",
    );
  });

  it("rejects null/empty/non-string targets", () => {
    expect(getSafeRedirectUrl(null)).toBeNull();
    expect(getSafeRedirectUrl(undefined)).toBeNull();
    expect(getSafeRedirectUrl("")).toBeNull();
    expect(getSafeRedirectUrl("   ")).toBeNull();
  });
});

describe("6. isClaimFresh behavior for valid, expired, and missing iat", () => {
  it("returns true for a claim issued just now, within the window", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isClaimFresh({ iat: nowSeconds }, 180)).toBe(true);
  });

  it("returns true for a claim right at the boundary of the freshness window", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isClaimFresh({ iat: nowSeconds - 180 }, 180)).toBe(true);
  });

  it("returns false for an expired (stale) claim just past the window", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isClaimFresh({ iat: nowSeconds - 181 }, 180)).toBe(false);
  });

  it("returns false for a Tier 2 (300s) check on a claim older than 300s", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isClaimFresh({ iat: nowSeconds - 301 }, 300)).toBe(false);
    expect(isClaimFresh({ iat: nowSeconds - 299 }, 300)).toBe(true);
  });

  it("returns false when iat is missing", () => {
    expect(isClaimFresh({}, 180)).toBe(false);
  });

  it("returns false when sessionClaims is null, undefined, or not an object", () => {
    expect(isClaimFresh(null, 180)).toBe(false);
    expect(isClaimFresh(undefined, 180)).toBe(false);
    expect(isClaimFresh("not-an-object", 180)).toBe(false);
  });

  it("returns false for a claim with iat in the future (clock skew / forged claim)", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isClaimFresh({ iat: nowSeconds + 60 }, 180)).toBe(false);
  });
});

describe("Bonus: scripts/verify-vercel-env.ts CI guard", () => {
  it("fails when satellite is true and primarySignInUrl is unset in production", () => {
    const result = verifySatelliteEnv(
      { NEXT_PUBLIC_CLERK_IS_SATELLITE: "true" },
      "production",
      "admin",
    );
    expect(result.ok).toBe(false);
  });

  it("fails when satellite is true and primarySignInUrl is relative in staging", () => {
    const result = verifySatelliteEnv(
      {
        NEXT_PUBLIC_CLERK_IS_SATELLITE: "true",
        NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL: "/sign-in",
      },
      "staging",
      "verification-ops",
    );
    expect(result.ok).toBe(false);
  });

  it("passes when satellite is true and primarySignInUrl is absolute", () => {
    const result = verifySatelliteEnv(
      {
        NEXT_PUBLIC_CLERK_IS_SATELLITE: "true",
        NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL:
          "https://accounts.buildmarket.app/sign-in",
      },
      "production",
      "admin",
    );
    expect(result.ok).toBe(true);
  });

  it("passes (not applicable) when satellite is false, regardless of profile", () => {
    const result = verifySatelliteEnv(
      { NEXT_PUBLIC_CLERK_IS_SATELLITE: "false" },
      "production",
      "client",
    );
    expect(result.ok).toBe(true);
  });

  it("skips (passes) for non-gated profiles like preview", () => {
    const result = verifySatelliteEnv(
      { NEXT_PUBLIC_CLERK_IS_SATELLITE: "true" },
      "preview",
      "admin",
    );
    expect(result.ok).toBe(true);
  });
});
