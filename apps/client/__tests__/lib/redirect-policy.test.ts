import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getSafeRedirectUrl,
  redirectToDashboardForRole,
  redirectToUnauthorizedSignIn,
} from "@/app/lib/security/middleware/redirect-policy";
import { ROUTES } from "@/lib/links";

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
