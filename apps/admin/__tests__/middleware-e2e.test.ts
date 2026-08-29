/**
 * apps/admin/tests/middleware.e2e.test.ts
 * ============================================================================
 * TRUE end-to-end test of the real `export default clerkMiddleware(...)` in
 * apps/admin/src/middleware.ts — as opposed to the predicate-contract
 * reference implementation in tests/satellite-auth-hardening.test.ts (see
 * that file's header, "SCOPE NOTE on item 3").
 *
 * Only the Clerk SDK boundary (`clerkMiddleware`) is mocked, via
 * @build/clerk-test-harness. `createRouteMatcher`, this app's env layer,
 * @build/security-clerk, @build/enums, route-registry, claims, and
 * authorization-policy all run for real, against real `NextRequest`
 * objects. See the harness's own header comment for why `vi.doMock` (not
 * `vi.mock`) is used and why the middleware module is always imported
 * dynamically per test rather than statically at the top of this file.
 *
 * FIXTURE NOTE — READ BEFORE RUNNING
 * ------------------------------------
 * DASHBOARD_PATH / VERIFICATION_PATH / PUBLIC_PATH below are representative
 * examples. This suite deliberately does NOT mock
 * isPublicRoute/isDashboardRoute/isVerificationRoute (real route-registry.ts
 * runs), so it is only as accurate as these fixtures are genuine matches
 * against your actual registered patterns. If route-registry.ts uses
 * different path prefixes, update the constants below to match — do not
 * mock the registry functions to make fixtures "work" without checking
 * they reflect real routes, or this stops being e2e.
 *
 * Similarly, env var names below (NEXT_PUBLIC_CLERK_IS_SATELLITE,
 * NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL, NEXT_PUBLIC_CLERK_DOMAIN,
 * AUTH_DEV_BYPASS) are taken from scripts/verify-vercel-env.ts and the
 * middleware's own comments; confirm they match apps/admin/src/lib/
 * infrastructure/env.ts's actual schema keys.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  installClerkMiddlewareMock,
  setMockAuthState,
  resetMockAuthState,
  spyOnConsoleError,
} from "@build/clerk-test-harness";

installClerkMiddlewareMock();

const PRIMARY_ORIGIN = "https://buildmarket.app";
const ADMIN_SATELLITE_HOST = "admin.buildmarket.app";

const PUBLIC_PATH = "/sign-in";
const DASHBOARD_PATH = "/dashboard/overview";
const VERIFICATION_PATH = "/verification/queue";
const API_DASHBOARD_PATH = "/api/dashboard/metrics";

type MiddlewareFn = (req: NextRequest) => Promise<Response | undefined>;

function req(path: string, host = ADMIN_SATELLITE_HOST): NextRequest {
  return new NextRequest(`https://${host}${path}`);
}

/**
 * Fresh import of the middleware module (and everything it transitively
 * imports, including env.ts) after env vars are stubbed for this test.
 * Required because env.ts parses process.env once at module load — this
 * is what lets each test exercise a distinct satellite/prod/dev config.
 */
async function loadMiddleware(): Promise<MiddlewareFn> {
  vi.resetModules();
  const mod = await import("../src/middleware");
  return mod.default as MiddlewareFn;
}

function baseSatelliteEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "true");
  vi.stubEnv(
    "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
    `${PRIMARY_ORIGIN}/sign-in`,
  );
  vi.stubEnv("NEXT_PUBLIC_CLERK_DOMAIN", ADMIN_SATELLITE_HOST);
  vi.stubEnv("AUTH_DEV_BYPASS", "false");
  vi.stubEnv("QUEUE_PROVIDER", "bullmq");
}

beforeEach(() => {
  resetMockAuthState();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("apps/admin real middleware — unauthenticated satellite redirect", () => {
  it("redirects an unauthenticated page request to the PRIMARY sign-in origin, not a relative /sign-in on the satellite host", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(DASHBOARD_PATH));

    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(307);
    const location = res!.headers.get("location");
    expect(location).not.toBeNull();
    const locationUrl = new URL(location!);
    // The regression this guards: a relative NEXT_PUBLIC_CLERK_SIGN_IN_URL
    // resolving against req.url would send the browser BACK to the
    // satellite host — the exact redirect-loop bug from the autopsy.
    expect(locationUrl.origin).toBe(PRIMARY_ORIGIN);
    expect(locationUrl.searchParams.get("redirect_url")).toBe(
      `https://${ADMIN_SATELLITE_HOST}${DASHBOARD_PATH}`,
    );
  });

  it("returns a JSON 401 (not an HTML redirect) for an unauthenticated API route", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(API_DASHBOARD_PATH));

    expect(res!.status).toBe(401);
    expect(res!.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res!.json()).toEqual({ error: "Unauthorized" });
  });

  it("does not throw a (simulated) Clerk boot error when the primary sign-in URL cannot be resolved — fails open and logs loudly instead", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "true");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL", "");
    vi.stubEnv("AUTH_DEV_BYPASS", "false");
    vi.stubEnv("QUEUE_PROVIDER", "bullmq");
    const errorSpy = spyOnConsoleError();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    // Bare preview host: deriveFallbackPrimarySignInUrl also returns null
    // (no apex to strip to) — both the env var AND the heuristic fail.
    const res = await middleware(
      req(DASHBOARD_PATH, "build-market-admin-git-preview.vercel.app"),
    );

    // Must not throw — the options resolver disabled satellite mode for
    // this request instead of handing (simulated) Clerk an unresolvable
    // signInUrl, which real Clerk would reject for every route on the site.
    expect(res).toBeDefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("apps/admin real middleware — authenticated role matrix", () => {
  it("allows a user whose normalized role is permitted on a verification route", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    const { ADMIN_ROUTE_POLICY_MAP } =
      await import("../src/lib/security/authorization-policy");
    const allowedRole = ADMIN_ROUTE_POLICY_MAP.verification[0];

    setMockAuthState({
      userId: "user_ok",
      sessionClaims: { metadata: { role: allowedRole, status: "ACTIVE" } },
    });

    const res = await middleware(req(VERIFICATION_PATH));
    expect(res).toBeUndefined(); // pass-through: handler returns bare `return;`
  });

  it("denies (403 JSON) an authenticated API request with a role absent from ADMIN_ROUTE_POLICY_MAP.dashboard", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();

    setMockAuthState({
      userId: "user_wrong_role",
      sessionClaims: {
        metadata: { role: "NOT_A_REAL_ROLE", status: "ACTIVE" },
      },
    });

    const res = await middleware(req("/api/dashboard/whoami"));
    expect(res!.status).toBe(403);
    expect((await res!.json()).reason).toBe("not_admin");
  });

  it("blocked-status gate fires BEFORE the role check, even for an otherwise-valid role", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    const { ADMIN_ROUTE_POLICY_MAP } =
      await import("../src/lib/security/authorization-policy");
    const allowedRole = ADMIN_ROUTE_POLICY_MAP.dashboard[0];

    setMockAuthState({
      userId: "user_blocked",
      sessionClaims: { metadata: { role: allowedRole, status: "SUSPENDED" } },
    });

    const res = await middleware(req(DASHBOARD_PATH));
    expect(res!.status).toBe(307);
    const location = new URL(res!.headers.get("location")!);
    expect(location.pathname).toBe("/unauthorized-sign-in");
    expect(location.searchParams.get("reason")).toBe("SUSPENDED");
  });
});

describe("apps/admin real middleware — dev bypass carve-out", () => {
  it("short-circuits all auth checks when NODE_ENV=development and AUTH_DEV_BYPASS=true", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_BYPASS", "true");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "false");
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null }); // even unauthenticated

    const res = await middleware(req(DASHBOARD_PATH, "localhost:3500"));
    expect(res).toBeUndefined();
  });

  it("does NOT bypass in production even if AUTH_DEV_BYPASS is somehow true (fail-closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DEV_BYPASS", "true");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "false");
    vi.stubEnv("QUEUE_PROVIDER", "bullmq");
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(DASHBOARD_PATH, "localhost:3500"));
    expect(res).toBeDefined();
    expect(res!.status).not.toBe(200);
  });
});

describe("apps/admin real middleware — public routes never touch auth", () => {
  it("passes a public route through with no auth() call at all", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    // Deliberately unset: the harness throws from inside auth() if it's
    // ever invoked while state is undefined, turning an accidental auth()
    // call on a public route into a hard test failure instead of a silent
    // pass.
    setMockAuthState(undefined);

    const res = await middleware(req(PUBLIC_PATH));
    expect(res).toBeUndefined();
  });
});
