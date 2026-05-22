import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { redirectToDashboardForRole } from "@/app/lib/security/middleware/redirect-policy";
import { ROUTES } from "@/lib/links";

describe("redirectToDashboardForRole", () => {
  const baseUrl = "http://localhost:3500";

  it("redirects client actors to the homeowner dashboard", () => {
    const response = redirectToDashboardForRole(
      new NextRequest(`${baseUrl}/`),
      "CLIENT",
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.userDashboard,
    );
  });

  it("redirects professional actors to the professional dashboard", () => {
    const response = redirectToDashboardForRole(
      new NextRequest(`${baseUrl}/`),
      "PROFESSIONAL",
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.professionalDashboard,
    );
  });

  it("falls back to the homeowner dashboard when the role is missing", () => {
    const response = redirectToDashboardForRole(new NextRequest(`${baseUrl}/`));

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      ROUTES.userDashboard,
    );
  });
});
