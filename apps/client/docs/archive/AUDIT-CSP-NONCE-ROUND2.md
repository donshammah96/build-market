# Staff-Level Audit — CSP Nonce Implementation (Round 2)

**Scope:** `csp-nonce.ts`, `middleware.ts`, `layout.tsx`, `next-config-csp.ts`,
`csp-nonce.test.ts`, `route-guards.test.ts`  
**Date:** 2026-05-01  
**Baseline:** Round 1 audit dated 2026-05-01

---

## Round 1 Finding Resolution

All ten findings from the previous audit are addressed. Tracking them
explicitly before moving to new findings:

| ID   | Finding                                                                    | Status                                                                                          |
| ---- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| F-01 | Entropy defect — UUID string instead of raw bytes                          | ✅ Fixed: `crypto.getRandomValues(new Uint8Array(16))`                                          |
| F-02 | Nonce-bearing CSP on redirect responses                                    | ✅ Fixed: redirects return bare responses; only `applyDocumentCspHeaders` emits CSP             |
| F-03 | `script-src` missing nonce while `script-src-elem` had it                  | ✅ Fixed: both now carry `'nonce-${nonce}'`                                                     |
| F-04 | Test suite missing uniqueness, entropy, and injection safety cases         | ✅ Fixed: uniqueness (50 samples), length ≥24, special-char nonce test added                    |
| F-05 | `btoa` encoding UUID string, not bytes                                     | ✅ Fixed: encoding follows `getRandomValues` path                                               |
| F-06 | `expectCspHeaders` absent from most test cases                             | ✅ Fixed: `expectDocumentCspHeaders` / `expectRedirectNoCsp` applied to all 12 cases            |
| F-07 | `toOrigin` helper misplaced in middleware                                  | ⚠️ Partially addressed — helper stays in middleware; see R2-01 below                            |
| F-08 | No enforcement that middleware always takes precedence for document routes | ⚠️ Partially addressed — comment updated; still no machine check                                |
| F-09 | `nonce` typed as `string \| undefined`                                     | ✅ Fixed: `?? ""` fallback                                                                      |
| F-10 | Critical security directives untested                                      | ✅ Fixed: `object-src`, `base-uri`, `frame-ancestors`, `form-action`, `worker-src` all asserted |

---

## New Findings

### R2-01 — Medium: `next-config-csp.ts` `script-src-elem` Regression

### Severity: Medium — Phase 2 blocker\*\*

`next-config-csp.ts` `buildCspValue` now emits:

```bash
script-src-elem https://app... https://api...
```

No `'unsafe-inline'` and no nonce. This is a **silent security regression**
compared to the previous version: in Phase 1 the static fallback used
`'unsafe-inline'` as a catch-all for requests not handled by middleware; the
comment stated "remove in Phase 2." The current version removed `'unsafe-inline'`
**without** adding a nonce (which is correct — a static header cannot carry a
per-request nonce), but the comment says "Phase 2: remove unsafe-inline from
script-src-elem after nonce rollout." This implies it has been removed now.

The actual state:

- Routes processed by middleware: receive a nonce-bearing CSP → inline Clerk
  scripts work ✓
- Routes **not** processed by middleware (or any request where middleware
  produces no `Content-Security-Policy` header): the static header from
  `next.config.ts` applies, and `script-src-elem` has no `'unsafe-inline'` and
  no nonce → **Clerk bootstrap scripts are CSP-blocked on those routes**

The middleware matcher explicitly excludes `_next/static/**`, font files,
images, and other static assets. Those are not HTML documents so the concern is
minor there. But any request that Next.js processes as a document request and
that somehow escapes the middleware (edge runtime unavailability, misconfigured
matcher, or a locally served path like `/api/health`) will get a broken CSP.

**Required fix — two options:**

Option A (conservative): Restore `'unsafe-inline'` in `script-src-elem` of the
static header until Phase 2 is confirmed complete in production with no
violations. This is the documented intent of the "fallback" strategy.

```typescript
// next-config-csp.ts
// FALLBACK: Middleware injects a per-request nonce for document requests.
// 'unsafe-inline' here covers routes that escape the middleware matcher.
// Remove in Phase 2 after confirming zero CSP violations in production.
`script-src-elem 'unsafe-inline' ${dedup(scriptOrigins).join(" ")}`,
```

Option B (aggressive): Accept the regression as intentional Phase 2 completion
and document it, but require a test that proves no inline scripts exist outside
of middleware-covered routes.

Option A is recommended. The original plan explicitly sequenced this: Phase 1
validates the nonce path works; Phase 2 removes `'unsafe-inline'`. Jumping to
Phase 2 semantics in the static header while Phase 1 is still being validated
is a premature hardening that risks breaking auth silently.

---

### R2-02 — Medium: `middleware.ts` Falls Through to `applyDocumentCspHeaders`

After the `isProtectedRoute` Block Without an Explicit Pass Decision

### Severity: Medium — correctness / observability gap\*\*

The end of the protected route block:

```typescript
// 3. Protected routes...
if (isProtectedRoute(nextReq)) {
  // ... various redirects ...

  logMiddlewareDecision(nextReq, "mw_allow_protected", { ... });
  // ← No return here
}

// 4. All other routes - allow access
logMiddlewareDecision(nextReq, "mw_allow_default");
return applyDocumentCspHeaders(nextReq, nonce, cspValue);
```

When a protected route is allowed through (user is authenticated, onboarded,
and role-gated), the code logs `"mw_allow_protected"` but then **falls through**
to also log `"mw_allow_default"` and execute `applyDocumentCspHeaders`.

This means every allowed protected route produces **two log events** and the
nonce is applied correctly (because `applyDocumentCspHeaders` is called at the
bottom). However:

1. The observability contract (ADR-005) requires one structured log event per
   request at the point of response. Emitting two events per request corrupts
   metrics that count log events as a proxy for request count.
2. A future engineer adding a `return` to the log line in section 3 will
   silently break the response — the fall-through is load-bearing but looks
   accidental.

This is a pre-existing structural issue, not introduced by the CSP work, but
the CSP work surfaced it because `applyDocumentCspHeaders` is now only called
for document responses and its placement matters.

**Required fix:**

```typescript
logMiddlewareDecision(nextReq, "mw_allow_protected", {
  source: status.source,
  role: status.role,
});
return applyDocumentCspHeaders(nextReq, nonce, cspValue); // ← explicit return
```

Remove the fall-through section 4 log for routes that reach the section 3
allow path. This makes the control flow explicit, eliminates the double log,
and makes the code reviewable.

---

### R2-03 — Medium: `btoa(String.fromCharCode(...bytes))` Stack Overflow Risk

for Large Arrays

#### Severity: Medium — latent reliability defect

```typescript
if (typeof btoa === "function") {
  return btoa(String.fromCharCode(...bytes));
}
```

`String.fromCharCode(...bytes)` uses the spread operator to pass all 16
elements of `bytes` as individual arguments to `fromCharCode`. For 16 bytes
this is safe. If the nonce size is ever increased (e.g., to 32 bytes for
SHA-256 alignment), the spread still works. However, for any array of more than
~65,536 elements, the spread causes a `Maximum call stack size exceeded` error.

This is not an immediate defect at 16 bytes, but the implementation pattern is
dangerous to copy. The correct idiom for arbitrary-length byte arrays is:

```typescript
if (typeof btoa === "function") {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
```

At 16 bytes the performance difference is immaterial. The loop idiom is safer
to read, copy, and extend.

---

### R2-04 — Low: `next-config-csp.ts` Has Duplicate Origin Array Logic with

`csp-nonce.ts`

### Severity: Low — maintainability debt (carry-forward from Round 1)\*\*

The origin arrays (`connectOrigins`, `scriptOrigins`, `styleOrigins`,
`imgOrigins`, `fontOrigins`) are now maintained in two files with identical
content. A new third-party origin (e.g., a new Cloudinary region, a new Clerk
CDN endpoint) must be added in both files or the static fallback and the
middleware CSP diverge silently.

The Round 1 audit raised this as a structural observation and recommended
resolving it in Phase 2. It remains unresolved. There is no new urgency before
Phase 2, but it should be tracked explicitly as a Phase 2 work item.

**Phase 2 recommendation:** Extract the origin arrays to a shared constants
file importable by both modules:

```typescript
// app/lib/security/middleware/csp-origins.ts
// bootstrap-safe: contains only string literals, no env imports.
export const CSP_SCRIPT_ORIGINS_STATIC = [
  "https://*.clerk.accounts.dev",
  "https://cdn.jsdelivr.net",
  "https://img.clerk.com",
] as const;
```

Both `csp-nonce.ts` and `next-config-csp.ts` import from this file and
add their dynamic env-derived values on top. Changes to origin allowlists
happen in one place.

---

### R2-05 — Low: `route-guards.test.ts` Does Not Mock `csp-nonce` Module —

`generateCspNonce` Runs Against Real `crypto` in Test Environment

### Severity: Low — test hermetics\*\*

The middleware test suite does not mock `@/app/lib/security/middleware/csp-nonce`.
This means `generateCspNonce()` runs in Vitest's jsdom or node environment on
every test invocation. In Node 15+, `globalThis.crypto.getRandomValues` is
available via the Web Crypto API built into Node, so the tests pass. In jsdom
(which is the default Vitest environment for Next.js projects), `crypto` may be
available via polyfill depending on the Vitest config.

The concern is not that the tests fail — they likely pass. The concern is that
the test is inadvertently testing two things: routing logic and nonce generation.
If `crypto` is unavailable in a CI environment or test runner configuration,
the entire test suite fails with an unhelpful `"CSP nonce generation requires
crypto.getRandomValues"` error that has nothing to do with route guard logic.

**Recommended fix:**

Mock the nonce generation in the route guard tests to return a stable value,
so tests are hermetically testing only routing behavior:

```typescript
// In route-guards.test.ts, after other vi.mock() calls:
vi.mock("@/app/lib/security/middleware/csp-nonce", () => ({
  generateCspNonce: () => "test-nonce-stable",
  buildCspWithNonce: ({ nonce }: { nonce: string }) =>
    `script-src 'nonce-${nonce}'; script-src-elem 'nonce-${nonce}'`,
}));
```

This also makes the `expectDocumentCspHeaders` assertions more precise —
the test can assert the exact nonce value rather than just the `'nonce-`
prefix.

---

### R2-06 — Low: `route-guards.test.ts` `expectRedirectNoCsp` Will Fail

Against the Current `middleware.ts`

### Severity: Low — test/implementation contract mismatch\*\*

`expectRedirectNoCsp` asserts:

```typescript
expect(csp).toBeNull();
```

The current `middleware.ts` redirect paths return the result of
`redirectToMaintenance(nextReq)`, `redirectToSignIn(nextReq, pathname)`, etc.
These are imported from `redirect-policy.ts` which is **not mocked** in the
test suite. The actual implementation of these functions is unknown from the
uploaded files, but they produce `NextResponse` objects. If any of those
functions internally set a `Content-Security-Policy` header (perhaps from a
previous version of the code that applied CSP to redirects), the assertion
`expect(csp).toBeNull()` will fail.

More importantly, since `redirect-policy.ts` is not mocked, the tests are
testing the real redirect-policy behavior. If `redirectToSignIn` changes its
response shape, the route guard tests silently start testing a different
contract.

**Recommended fix:**

Either:

1. Mock `redirect-policy.ts` to return plain `NextResponse.redirect(...)` calls
   so the test controls the response shape:

```typescript
vi.mock("@/app/lib/security/middleware/redirect-policy", () => ({
  redirectToSignIn: (req: NextRequest, path: string) =>
    NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(path)}`, req.url),
      307,
    ),
  redirectToMaintenance: (req: NextRequest) =>
    NextResponse.redirect(new URL("/maintenance", req.url), 307),
  // ... etc.
}));
```

1. Or, explicitly assert in the test docs that `redirect-policy.ts` functions
   must never set `Content-Security-Policy` on their responses, and add a
   dedicated test in `redirect-policy.test.ts` that verifies this invariant.

Option 1 gives stronger test isolation. Option 2 is acceptable if the team
prefers integration-style middleware tests.

---

## Summary Table

| ID    | Severity   | File                   | Category                     | Action Required                                                         |
| ----- | ---------- | ---------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| R2-01 | **Medium** | `next-config-csp.ts`   | Security regression          | Restore `'unsafe-inline'` in static fallback until Phase 2 is confirmed |
| R2-02 | **Medium** | `middleware.ts`        | Control flow / observability | Add explicit `return` after `mw_allow_protected` log                    |
| R2-03 | **Medium** | `csp-nonce.ts`         | Reliability                  | Replace spread with loop in `btoa` path                                 |
| R2-04 | Low        | Both CSP files         | Maintainability              | Track as Phase 2 work item: extract shared origin constants             |
| R2-05 | Low        | `route-guards.test.ts` | Test hermetics               | Mock `csp-nonce` module in route guard tests                            |
| R2-06 | Low        | `route-guards.test.ts` | Test/impl contract           | Mock `redirect-policy` or add invariant test for no-CSP-on-redirect     |

---

## Resolution Status (2026-05-01)

| ID    | Status   | Resolution Note                                                                                              |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------ |
| R2-01 | ✅ Fixed | Restored `script-src-elem 'unsafe-inline'` in the static fallback while nonce rollout is validated.          |
| R2-02 | ✅ Fixed | Added explicit `return applyDocumentCspHeaders(...)` for allowed protected routes to prevent double logging. |
| R2-03 | ✅ Fixed | Replaced `String.fromCharCode(...bytes)` with a loop before `btoa` encoding.                                 |
| R2-04 | ⚠️ Open  | Origin arrays still duplicated between `csp-nonce.ts` and `next-config-csp.ts`.                              |
| R2-05 | ✅ Fixed | `csp-nonce` is mocked in route guard tests with a stable nonce and CSP string.                               |
| R2-06 | ✅ Fixed | `redirect-policy` is mocked in route guard tests to enforce no-CSP-on-redirect invariant.                    |

---

## Pre-Phase-2 Checklist (Updated)

- [x] R2-01: Static fallback `script-src-elem` restored to `'unsafe-inline'`
      pending Phase 2 production confirmation
- [x] R2-02: Explicit `return applyDocumentCspHeaders(...)` added after
      `mw_allow_protected` log — eliminates double log event and fall-through ambiguity
- [x] R2-03: `btoa` path uses loop instead of spread
- [x] R2-05: `csp-nonce` module mocked in route guard tests
- [x] R2-06: `redirect-policy` mocked in route guard tests, or invariant test
      added to `redirect-policy.test.ts`
- [ ] Phase 2 production gate: zero CSP violations in browser console over 24h
      staging canary before removing `'unsafe-inline'` from static header
- [ ] Phase 2: consolidate duplicate origin arrays into shared constants file
      before removing `'unsafe-inline'` (to avoid origin drift between static and
      dynamic CSP paths during the cutover)

---

## Verification Commands

```bash
# CSP unit tests
pnpm -C apps/client exec vitest run __tests__/security/csp-nonce.test.ts --maxWorkers=1

# Middleware route guard tests
pnpm -C apps/client exec vitest run __tests__/middleware/route-guards.test.ts --maxWorkers=1

# Typecheck
pnpm run client:tsc-noemit

# Security drift (must remain 0)
pnpm run client:report-security-drift:strict
```
