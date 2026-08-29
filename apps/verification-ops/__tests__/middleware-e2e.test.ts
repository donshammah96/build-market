/**
 * apps/verification-ops/tests/middleware.e2e.test.ts
 * ============================================================================
 * TRUE end-to-end test of the real `export default clerkMiddleware(...)` in
 * apps/verification-ops/middleware.ts. See apps/admin/tests/middleware.e2e.test.ts
 * and @build/clerk-test-harness's header comment for the full rationale —
 * same approach here: only `clerkMiddleware` is mocked, everything else
 * (createRouteMatcher, envConfig, toBool, @build/security-clerk,
 * @build/enums, this file's local parseSessionMetadata/normalizeAdminAccessRole)
 * runs for real.
 *
 * apps/verification-ops has NO dev-bypass carve-out (unlike apps/admin) —
 * that asymmetry is itself covered below, since silently copy-pasting the
 * admin bypass branch into this app would be a real regression: this app
 * fronts a regulator compliance surface.
 *
 * FIXTURE NOTE: PROTECTED_PATH / API_PATH below are representative — this
 * app's own middleware.ts defines its public routes inline via
 * createRouteMatcher([...]) (real matcher used here, not mocked), so those
 * three literal patterns ("/sign-in(.*)", "/unauthorized(.*)",
 * "/unauthorized-sign-in(.*)") are exact, but PROTECTED_PATH/API_PATH are
 * just any path that doesn't match them — adjust if useful but no exact
 * match to an external registry is required here (unlike apps/admin).
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
const VOPS_HOST = "verification.buildmarket.app";
const PROTECTED_PATH = "/queue/license-reviews";
const API_PATH = "/api/cases/123";

type MiddlewareFn = (req: NextRequest) => Promise<Response | undefined>;

function req(path: string, host = VOPS_HOST): NextRequest {
  return new NextRequest(`https://${host}${path}`);
}

async function loadMiddleware(): Promise<MiddlewareFn> {
  vi.resetModules();
  const mod = await import("../middleware");
  return mod.default as MiddlewareFn;
}

function baseSatelliteEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "true");
  vi.stubEnv(
    "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
    `${PRIMARY_ORIGIN}/sign-in`,
  );
  vi.stubEnv("NEXT_PUBLIC_CLERK_DOMAIN", VOPS_HOST);
}

beforeEach(() => {
  resetMockAuthState();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("apps/verification-ops real middleware — satellite redirect + toBool parity", () => {
  it("redirects unauthenticated page requests to the primary sign-in origin", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(PROTECTED_PATH));

    expect(res!.status).toBe(307);
    const location = new URL(res!.headers.get("location")!);
    expect(location.origin).toBe(PRIMARY_ORIGIN);
    expect(location.searchParams.get("redirect_url")).toBe(
      `https://${VOPS_HOST}${PROTECTED_PATH}`,
    );
  });

  it('treats the string "false" as satellite-disabled (regression guard for the fixed toBool() type bug)', async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "false");
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(PROTECTED_PATH));

    // With isSatellite falsy, the unauthenticated branch must fall through
    // to the plain relative "/sign-in" redirect on THIS host, not attempt a
    // primary-origin resolution. A pre-fix toBool() that treated the
    // *string* "false" as truthy (Finding: cross-app parity bug) would
    // incorrectly take the satellite branch here instead.
    const location = new URL(res!.headers.get("location")!);
    expect(location.origin).toBe(`https://${VOPS_HOST}`);
    expect(location.pathname).toBe("/sign-in");
  });

  it("returns JSON 401 for unauthenticated API routes", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(API_PATH));
    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "Unauthorized" });
  });

  it("does not throw a (simulated) Clerk boot error when no signInUrl can be resolved on a bare preview host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "true");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL", "");
    const errorSpy = spyOnConsoleError();
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(
      req(PROTECTED_PATH, "build-market-vops-git-preview.vercel.app"),
    );

    expect(res).toBeDefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("apps/verification-ops real middleware — container role gate + blocked ordering", () => {
  it("allows a role that normalizes to ADMIN through (NextResponse.next(), not a redirect)", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({
      userId: "user_ok",
      sessionClaims: {
        metadata: { role: "VERIFICATION_ADMIN", status: "ACTIVE" },
      },
    });

    const res = await middleware(req(PROTECTED_PATH));
    // This app's handler explicitly returns NextResponse.next() on the
    // pass-through path (unlike apps/admin's bare `return;`) — assert the
    // real shape rather than assuming it matches the other app.
    expect(res!.status).toBe(200);
    expect(res!.headers.get("location")).toBeNull();
  });

  it("denies a blocked user even with an ADMIN-normalized role, with reason=<status> not reason=not_admin", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({
      userId: "user_blocked",
      sessionClaims: { metadata: { role: "ADMIN", status: "BANNED" } },
    });

    const res = await middleware(req(API_PATH));
    expect(res!.status).toBe(403);
    expect((await res!.json()).reason).toBe("BANNED");
  });

  it("denies a non-blocked, non-admin role with reason=not_admin", async () => {
    baseSatelliteEnv();
    const middleware = await loadMiddleware();
    setMockAuthState({
      userId: "user_wrong_role",
      sessionClaims: { metadata: { role: "CLIENT", status: "ACTIVE" } },
    });

    const res = await middleware(req(API_PATH));
    expect(res!.status).toBe(403);
    expect((await res!.json()).reason).toBe("not_admin");
  });
});

describe("apps/verification-ops real middleware — no dev-bypass carve-out exists", () => {
  it("still enforces auth in NODE_ENV=development — there is no bypass branch to hit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", "false");
    const middleware = await loadMiddleware();
    setMockAuthState({ userId: null });

    const res = await middleware(req(PROTECTED_PATH));
    expect(res).toBeDefined();
    expect(res!.status).not.toBe(200);
  });
});

describe("apps/verification-ops real middleware — public routes via real createRouteMatcher", () => {
  it.each(["/sign-in", "/unauthorized", "/unauthorized-sign-in"])(
    "passes %s through with no auth() call",
    async (path) => {
      baseSatelliteEnv();
      const middleware = await loadMiddleware();
      // Deliberately unset: the harness throws from inside auth() if it's
      // ever invoked while state is undefined — turns an accidental auth()
      // call on a public route into a hard failure instead of a silent pass.
      setMockAuthState(undefined);

      const res = await middleware(req(path));
      expect(res!.status).toBe(200);
    },
  );
});
