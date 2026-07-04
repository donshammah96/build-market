import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  redirectToDashboardForRole,
  redirectToUnauthorizedSignIn,
} from "@/app/lib/security/middleware/redirect-policy";
import { ROUTES } from "@/lib/links";

const BASE_URL = "http://localhost:3500";

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
