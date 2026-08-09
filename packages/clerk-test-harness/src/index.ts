/**
 * @build/clerk-test-harness
 * ============================================================================
 * Shared vitest harness for writing TRUE end-to-end tests against the real
 * `export default clerkMiddleware(handler, optionsResolver)` in
 * apps/admin/src/middleware.ts and apps/verification-ops/middleware.ts —
 * as opposed to the predicate-contract reference implementation in
 * tests/satellite-auth-hardening.test.ts (see that file's "SCOPE NOTE on
 * item 3" for why it stopped short of this).
 *
 * DESIGN PRINCIPLE
 * -----------------
 * Mock ONLY the Clerk SDK boundary — `clerkMiddleware` itself, the piece
 * that would otherwise require a live Clerk session/JWT verification
 * round-trip. Everything else runs FOR REAL against real `NextRequest`
 * objects:
 *   - `createRouteMatcher` (pure pattern matcher, no network dependency)
 *   - the app's own env layer (env.ts / env-wrapper.ts)
 *   - @build/security-clerk (resolvePrimarySignInUrl, normalizeClerkDomain, ...)
 *   - @build/enums (isBlockedUserStatus)
 *   - the app's own route-registry / claims / authorization-policy modules
 *
 * That's what makes this "true e2e": you're exercising the actual handler
 * and options-resolver closures Next.js would invoke in production, not a
 * re-implementation of the ordering/predicates they're built on.
 *
 * WHY vi.doMock, NOT vi.mock
 * ---------------------------
 * Vitest statically hoists literal `vi.mock(...)` call expressions found in
 * a test file's own source to the top of that file, above its imports.
 * That hoisting only fires for calls written directly in the test file —
 * calling `vi.mock` from inside an imported helper function (like this one)
 * does NOT get picked up by the hoisting transform.
 *
 * We deliberately use `vi.doMock` (the explicit non-hoisted API) instead of
 * fighting that: `installClerkMiddlewareMock()` is called once, synchronously,
 * at the top of each test file (after all static imports, before any test
 * runs), and every target module (`@clerk/nextjs/server`, the app's
 * `middleware.ts`) is loaded via a *dynamic* `await import(...)` inside
 * `loadMiddleware()` — never as a static top-level import in the test file.
 * Because the mock registration always executes before those dynamic
 * imports resolve, non-hoisted `vi.doMock` is sufficient and correct here.
 * Do NOT convert this to `vi.mock` and do NOT statically import the app's
 * middleware.ts at the top of a test file — doing either breaks the
 * per-test env-var-then-fresh-import pattern this harness depends on.
 *
 * PER-TEST ENV RE-IMPORT PATTERN
 * -------------------------------
 * Each app's env.ts parses `process.env` once, at module load. To exercise
 * different satellite/non-satellite, dev/prod, bypass/no-bypass
 * configurations across tests, test files should:
 *   1. `vi.stubEnv(...)` the relevant vars
 *   2. `vi.resetModules()`
 *   3. `await import("../src/middleware")` (or `"../middleware"`) fresh
 *
 * `vi.resetModules()` clears the resolved-module cache (forcing env.ts to
 * re-parse `process.env`) but does NOT clear `vi.doMock` registrations —
 * mocks registered once at file-load time stay active across resets. This
 * is exactly the property the pattern above relies on.
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock auth state
// ---------------------------------------------------------------------------

export interface MockAuthState {
  userId: string | null;
  sessionClaims?: unknown;
  /**
   * Only consulted if an app's middleware calls `authObj.has({ role })`
   * (apps/admin's `hasAllowedRole()` no longer does — Finding 8 removed
   * that dead branch — but the shape is kept here for completeness / in
   * case it's deliberately reintroduced with Clerk Organizations
   * configured). Defaults to always-false to match production reality.
   */
  has?: (args: { role: string }) => boolean;
  /**
   * Response returned by `authObj.redirectToSignIn()` — the path
   * apps/admin's middleware falls through to when NOT on a satellite
   * domain (or when satellite resolution already failed above it).
   * Defaults to a relative "/sign-in" redirect with `redirect_url`
   * appended, which is deliberately the SAME relative shape that produces
   * a redirect loop on a satellite domain if the satellite branch above
   * it doesn't intercept first — so tests can assert the satellite branch
   * really does intercept before this default ever fires.
   */
  redirectToSignInResponse?: (args: { returnBackUrl: string }) => Response;
}

let currentAuthState: MockAuthState | undefined = { userId: null };

/** Set the auth state the next middleware invocation(s) will observe. */
export function setMockAuthState(state: MockAuthState | undefined): void {
  currentAuthState = state;
}

export function resetMockAuthState(): void {
  currentAuthState = { userId: null };
}

function defaultRedirectToSignIn(args: { returnBackUrl: string }): Response {
  const url = new URL("/sign-in", args.returnBackUrl);
  url.searchParams.set("redirect_url", args.returnBackUrl);
  // Use the web-standard Response instead of NextResponse.redirect so this
  // harness has no runtime dependency on next/server. NextResponse.redirect
  // is identical under the hood: a 307 with a Location header.
  return new Response(null, {
    status: 307,
    headers: { Location: url.toString() },
  });
}

function buildAuthObject() {
  if (currentAuthState === undefined) {
    // Intentionally thrown: a test that sets state to `undefined` is
    // asserting the handler must NOT call auth() at all for this request
    // (e.g. a public route). If it does, fail loudly instead of silently
    // returning a plausible-looking unauthenticated object.
    throw new Error(
      "[clerk-test-harness] auth() was called but no mock auth state was " +
        "set. If this request is expected to hit a public route that never " +
        "consults auth(), this failure means it did — a real regression. " +
        "Otherwise call setMockAuthState(...) before invoking middleware.",
    );
  }
  const state = currentAuthState;
  return {
    userId: state.userId,
    sessionClaims: state.sessionClaims,
    has: state.has ?? (() => false),
    redirectToSignIn: state.redirectToSignInResponse ?? defaultRedirectToSignIn,
  };
}

// ---------------------------------------------------------------------------
// Simulated Clerk options validation
// ---------------------------------------------------------------------------
//
// Real Clerk throws at request time if `isSatellite: true` is returned from
// the options resolver without a well-formed `domain` and absolute-URL
// `signInUrl` — for EVERY request, including public ones, since Clerk
// resolves these options before the handler body runs. Both apps' options
// resolvers exist specifically to guarantee this never happens (see the
// large comment block above each app's dynamic options resolver). This
// simulation is what actually PROVES that guarantee at the e2e level,
// instead of just trusting the resolver's own internal logic.

function simulateClerkOptionValidation(options: unknown, req: unknown): void {
  const opts = options as
    | { isSatellite?: boolean; domain?: unknown; signInUrl?: unknown }
    | undefined;
  if (!opts?.isSatellite) return;

  const host = (req as { nextUrl?: { host?: string } })?.nextUrl?.host;
  const looksAbsoluteHttpUrl = (v: unknown) =>
    typeof v === "string" && /^https?:\/\//i.test(v);

  if (!opts.domain || typeof opts.domain !== "string") {
    throw new Error(
      `[clerk-test-harness] Simulated Clerk boot error: isSatellite=true ` +
        `but no valid "domain" was supplied for host "${host}". Real Clerk ` +
        `throws here for every request, not just this one.`,
    );
  }

  if (!looksAbsoluteHttpUrl(opts.signInUrl)) {
    throw new Error(
      `[clerk-test-harness] Simulated Clerk boot error: isSatellite=true ` +
        `but "signInUrl" (${JSON.stringify(opts.signInUrl)}) is not an ` +
        `absolute http(s) URL for host "${host}". This is precisely the ` +
        `failure mode the options resolver's fail-open branch exists to ` +
        `prevent — if this throws, that guarantee has regressed.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

type Handler = (
  auth: () => Promise<ReturnType<typeof buildAuthObject>>,
  req: unknown,
  event?: unknown,
) => unknown;

type OptionsResolver = ((req: unknown) => unknown) | unknown;

/**
 * Registers a `vi.doMock` for "@clerk/nextjs/server" that keeps the real
 * `createRouteMatcher` (and everything else the module exports) but
 * replaces `clerkMiddleware` with a thin, directly-invokable wrapper around
 * the real `handler` / `optionsResolver` closures your app's middleware.ts
 * passes to it.
 *
 * Call this ONCE at the top of a test file, after static imports, before
 * any test runs and before any dynamic `import("../middleware")`.
 */
export function installClerkMiddlewareMock(): void {
  vi.doMock("@clerk/nextjs/server", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("@clerk/nextjs/server")>();
    return {
      ...actual,
      clerkMiddleware: (handler: Handler, optionsResolver: OptionsResolver) => {
        return async (req: unknown, event?: unknown) => {
          const options =
            typeof optionsResolver === "function"
              ? (optionsResolver as (req: unknown) => unknown)(req)
              : optionsResolver;

          simulateClerkOptionValidation(options, req);

          const authFn = async () => buildAuthObject();
          return handler(authFn, req, event);
        };
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Misc test utilities
// ---------------------------------------------------------------------------

/** Spies on console.error and silences it, returning the spy for assertions. */
export function spyOnConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}
