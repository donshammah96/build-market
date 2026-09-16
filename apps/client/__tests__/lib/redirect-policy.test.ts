import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";
import {
  redirectToDashboardForRole,
  redirectToUnauthorizedSignIn,
  redirectToSignIn,
  AUTH_BOUNCE_COOKIE,
  readBounce,
  clearAuthBounce,
} from "@/app/lib/security/middleware/redirect-policy";
import { fingerprintPublishableKey } from "@/app/lib/security/clerk-fingerprint";
import { ROUTES } from "@/lib/routes";

const BASE_URL = "http://localhost:3500";

describe("getSafeRedirectUrl", () => {
  it("allows safe internal relative paths", () => {
    expect(getSafeRedirectUrl("/homeowner-dashboard")).toBe(
      "/homeowner-dashboard",
    );
    expect(getSafeRedirectUrl("/profile/complete")).toBe("/profile/complete");
    expect(getSafeRedirectUrl("/professional-portal/dashboard")).toBe(
      "/professional-portal/dashboard",
    );
  });

  it("allows absolute URLs on buildmarket.app and satellite subdomains", () => {
    expect(getSafeRedirectUrl("https://verification.buildmarket.app/")).toBe(
      "https://verification.buildmarket.app/",
    );
    expect(getSafeRedirectUrl("https://admin.buildmarket.app/dashboard")).toBe(
      "https://admin.buildmarket.app/dashboard",
    );
    expect(getSafeRedirectUrl("https://buildmarket.app/sign-in")).toBe(
      "https://buildmarket.app/sign-in",
    );
  });

  it("allows local development loopback URLs", () => {
    expect(getSafeRedirectUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/",
    );
    expect(getSafeRedirectUrl("http://127.0.0.1:3005/dashboard")).toBe(
      "http://127.0.0.1:3005/dashboard",
    );
  });

  it("rejects empty, null, or undefined values", () => {
    expect(getSafeRedirectUrl(null)).toBeNull();
    expect(getSafeRedirectUrl(undefined)).toBeNull();
    expect(getSafeRedirectUrl("")).toBeNull();
    expect(getSafeRedirectUrl("   ")).toBeNull();
  });

  it("rejects protocol-relative open redirect attempts", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBeNull();
    expect(
      getSafeRedirectUrl("//verification.buildmarket.app.evil.com"),
    ).toBeNull();
  });

  it("rejects backslash and colon open redirect bypass attempts", () => {
    expect(getSafeRedirectUrl("/\\evil.com")).toBeNull();
    expect(getSafeRedirectUrl("/:evil.com")).toBeNull();
  });

  it("rejects non-http/https protocols", () => {
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeRedirectUrl("data:text/html,hack")).toBeNull();
  });

  it("rejects untrusted third-party domains", () => {
    expect(getSafeRedirectUrl("https://evil.com")).toBeNull();
    expect(getSafeRedirectUrl("https://evilbuildmarket.app")).toBeNull();
    expect(
      getSafeRedirectUrl("https://phishing.com/verification.buildmarket.app"),
    ).toBeNull();
  });
});

describe("redirectToDashboardForRole", () => {
  it("redirects client actors to the homeowner dashboard", () => {
    const response = redirectToDashboardForRole(
      new NextRequest(`${BASE_URL}/`),
      "CLIENT",
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.userDashboard,
    );
  });

  it("redirects professional actors to the professional dashboard", () => {
    const response = redirectToDashboardForRole(
      new NextRequest(`${BASE_URL}/`),
      "PROFESSIONAL",
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.professionalDashboard,
    );
  });

  it("falls back to the homeowner dashboard when the role is missing", () => {
    const response = redirectToDashboardForRole(
      new NextRequest(`${BASE_URL}/`),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.userDashboard,
    );
  });
});

describe("redirectToUnauthorizedSignIn", () => {
  it("produces a 307 redirect to /unauthorized-sign-in", () => {
    const req = new NextRequest(`${BASE_URL}/dashboard`);
    const res = redirectToUnauthorizedSignIn(req, "SUSPENDED");

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/unauthorized-sign-in");
  });

  it.each(["SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"] as const)(
    "encodes the reason=%s query parameter",
    (status) => {
      const req = new NextRequest(`${BASE_URL}/dashboard`);
      const res = redirectToUnauthorizedSignIn(req, status);

      const location = new URL(res.headers.get("location")!);
      expect(location.searchParams.get("reason")).toBe(status);
    },
  );

  it("works for a custom reason string", () => {
    const req = new NextRequest(`${BASE_URL}/protected`);
    const res = redirectToUnauthorizedSignIn(req, "CUSTOM_REASON");

    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("reason")).toBe("CUSTOM_REASON");
  });
});

describe("fingerprintPublishableKey", () => {
  it("returns null for null, undefined, or empty values", () => {
    expect(fingerprintPublishableKey(null)).toBeNull();
    expect(fingerprintPublishableKey(undefined)).toBeNull();
    expect(fingerprintPublishableKey("")).toBeNull();
    expect(fingerprintPublishableKey("   ")).toBeNull();
  });

  it("returns unknown_prefix for keys without pk_test_ or pk_live_", () => {
    expect(fingerprintPublishableKey("sk_test_12345")).toBe("unknown_prefix");
  });

  it("correctly decodes the embedded FAPI host without revealing the raw token", () => {
    // base64("clerk.staging.buildmarket.app$") = "Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk"
    const liveKey = "pk_live_Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk";
    const fingerprint = fingerprintPublishableKey(liveKey);

    expect(fingerprint).toBe("pk_live:clerk.staging.buildmarket.app");
    expect(fingerprint).not.toContain("Y2xlcm");
  });

  it("handles pk_test keys and stripped base64 padding", () => {
    // base64("accounts.example.com$") = "YWNjb3VudHMuZXhhbXBsZS5jb20k"
    const testKey = "pk_test_YWNjb3VudHMuZXhhbXBsZS5jb20k";
    expect(fingerprintPublishableKey(testKey)).toBe(
      "pk_test:accounts.example.com",
    );
  });
});

describe("Bounce Breaker Policy", () => {
  it("readBounce extracts integer count from request cookie", () => {
    const reqNoCookie = new NextRequest(`${BASE_URL}/onboarding`);
    expect(readBounce(reqNoCookie)).toBe(0);

    const reqWithCookie = new NextRequest(`${BASE_URL}/onboarding`, {
      headers: { Cookie: `${AUTH_BOUNCE_COOKIE}=2` },
    });
    expect(readBounce(reqWithCookie)).toBe(2);
  });

  it("clearAuthBounce sets maxAge to 0", () => {
    const res = NextResponse.next();
    clearAuthBounce(res);
    const cookie = res.cookies.get(AUTH_BOUNCE_COOKIE);
    expect(cookie?.maxAge).toBe(0);
  });

  it("redirectToSignIn sets bounce cookie to 1 on first hop", () => {
    const req = new NextRequest(`${BASE_URL}/onboarding`);
    const res = redirectToSignIn(req);

    expect(res.status).toBe(307);
    const bounceCookie = res.cookies.get(AUTH_BOUNCE_COOKIE);
    expect(bounceCookie?.value).toBe("1");
    expect(bounceCookie?.httpOnly).toBe(true);
  });

  it("redirectToSignIn increments bounce cookie on second hop", () => {
    const req = new NextRequest(`${BASE_URL}/onboarding`, {
      headers: { Cookie: `${AUTH_BOUNCE_COOKIE}=1` },
    });
    const res = redirectToSignIn(req);

    expect(res.status).toBe(307);
    const bounceCookie = res.cookies.get(AUTH_BOUNCE_COOKIE);
    expect(bounceCookie?.value).toBe("2");
  });

  it("redirectToSignIn returns 503 AUTH_REDIRECT_LOOP_BROKEN when bounces >= 2 in diagnostic environment", async () => {
    // env.isDev is true in tests
    const req = new NextRequest(`${BASE_URL}/onboarding`, {
      headers: { Cookie: `${AUTH_BOUNCE_COOKIE}=2` },
    });
    const res = redirectToSignIn(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("AUTH_REDIRECT_LOOP_BROKEN");
    expect(data.bounces).toBe(2);
    expect(data.pathname).toBe("/onboarding");
    expect(data).toHaveProperty("clerkPublishableKeyFingerprint");
    expect(data).toHaveProperty("clerkIsSatellite");
  });

  it("preserves CSP nonce when already on /sign-in route", () => {
    const req = new NextRequest(`${BASE_URL}/sign-in`);
    const res = redirectToSignIn(req, undefined, {
      nonce: "test-nonce-123",
      cspValue: "script-src 'nonce-test-nonce-123'",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-nonce")).toBe("test-nonce-123");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "test-nonce-123",
    );
  });
});
