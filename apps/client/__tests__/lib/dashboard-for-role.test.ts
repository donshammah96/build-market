import { describe, expect, it } from "vitest";
import { ROUTES, dashboardForRole } from "@/lib/routes";

describe("dashboardForRole", () => {
  it("returns the homeowner dashboard for client roles", () => {
    expect(dashboardForRole("CLIENT")).toBe(ROUTES.userDashboard);
    expect(dashboardForRole("client")).toBe(ROUTES.userDashboard);
  });

  it("returns the professional dashboard for professional roles", () => {
    expect(dashboardForRole("PROFESSIONAL")).toBe(ROUTES.professionalDashboard);
    expect(dashboardForRole("professional")).toBe(ROUTES.professionalDashboard);
  });

  it("defaults to the homeowner dashboard for admin, unknown, and missing roles", () => {
    expect(dashboardForRole("ADMIN")).toBe(ROUTES.userDashboard);
    expect(dashboardForRole("UNKNOWN")).toBe(ROUTES.userDashboard);
    expect(dashboardForRole(undefined)).toBe(ROUTES.userDashboard);
  });
});
