import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_REGISTRY,
  isDashboardRoute,
  isPublicRoute,
  isVerificationRoute,
} from "@/lib/security/route-registry";
import fs from "node:fs";
import path from "node:path";

describe("Admin Route Registry Governance", () => {
  it("catalogs every route in ADMIN_ROUTE_REGISTRY with valid roles and metadata", () => {
    expect(ADMIN_ROUTE_REGISTRY.length).toBeGreaterThan(0);

    for (const route of ADMIN_ROUTE_REGISTRY) {
      expect(route.path).toBeDefined();
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.allowedRoles.length).toBeGreaterThan(0);
      expect([
        "core",
        "compliance",
        "operations",
        "finance",
        "settings",
      ]).toContain(route.section);
    }
  });

  it("matches public routes cleanly", () => {
    const publicReq = { nextUrl: { pathname: "/unauthorized-sign-in" } } as any;
    expect(isPublicRoute(publicReq)).toBe(true);
  });

  it("matches dashboard and verification routes correctly", () => {
    const dashReq = { nextUrl: { pathname: "/users" } } as any;
    expect(isDashboardRoute(dashReq)).toBe(true);

    const verifReq = { nextUrl: { pathname: "/verifications" } } as any;
    expect(isVerificationRoute(verifReq)).toBe(true);
  });

  it("ensures every filesystem route in src/app/(dashboard) has a corresponding registry entry", () => {
    const dashboardDir = path.resolve(__dirname, "../../src/app/(dashboard)");
    expect(fs.existsSync(dashboardDir)).toBe(true);

    const registeredPaths = new Set(
      ADMIN_ROUTE_REGISTRY.map((entry) => entry.path),
    );

    function scanRoutes(dir: string, currentRoute: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nextRoute =
            currentRoute === "/"
              ? `/${entry.name}`
              : `${currentRoute}/${entry.name}`;
          scanRoutes(path.join(dir, entry.name), nextRoute);
        } else if (entry.name === "page.tsx") {
          // Check if this page path is in the registered set
          expect(
            registeredPaths.has(currentRoute),
            `Unregistered dashboard route found at filesystem path: ${currentRoute}`,
          ).toBe(true);
        }
      }
    }

    scanRoutes(dashboardDir, "/");
  });
});
