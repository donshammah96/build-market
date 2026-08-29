# Staff-Level Audit: CSP Nonce Implementation

**Scope:** `csp-nonce.ts`, `middleware.ts`, `layout.tsx`, `next-config-csp.ts`,
`csp-nonce.test.ts`, `route-guards.test.ts`  
**Date:** 2026-05-01  
**ADRs consulted:** ADR-002, ADR-003, ADR-004, ADR-008  
**Verdict:** Proceed with conditions — the core nonce architecture is sound and
the security direction is correct, but four defects require resolution before
Phase 2 (removing `'unsafe-inline'` from the static fallback), and a fifth
requires resolution before production deploy.

---

## Summary of Findings

| ID   | Severity     | Location                | Category                                                                                                                                                         |
| ---- | ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | **Critical** | `csp-nonce.ts` L23      | Nonce entropy defect — UUID is not random bytes                                                                                                                  |
| F-02 | **High**     | `middleware.ts` L45–55  | `x-nonce` not forwarded to Server Components on redirects                                                                                                        |
| F-03 | **High**     | `csp-nonce.ts` L104–105 | `script-src` retains origin allowlist while `script-src-elem` is nonce-gated — split semantics are exploitable                                                   |
| F-04 | **High**     | `csp-nonce.test.ts`     | Test suite does not verify nonce uniqueness, entropy, or cross-request isolation                                                                                 |
| F-05 | **Medium**   | `csp-nonce.ts` L10–16   | `btoa` path encodes UUID string characters, not raw bytes — produces weak nonces in browsers                                                                     |
| F-06 | **Medium**   | `route-guards.test.ts`  | `expectCspHeaders` is not called on redirect responses in 8 of 12 tests                                                                                          |
| F-07 | **Medium**   | `middleware.ts`         | `csp-nonce` module imported but `env` module is already imported — `toOrigin` helper belongs in a shared utility, not middleware                                 |
| F-08 | **Low**      | `next-config-csp.ts`    | Comment says "fallback" but no code path enforces that middleware CSP always takes precedence for document requests                                              |
| F-09 | **Low**      | `layout.tsx` L92        | `nonce` typed as `string \| undefined`; `ClerkProvider` `nonce` prop requires `string` — silent degradation when header is absent                                |
| F-10 | **Low**      | `csp-nonce.test.ts`     | `"retains core CSP directives"` test does not assert `object-src 'none'`, `base-uri 'self'`, or `frame-ancestors` — the highest-security directives are untested |

---

## F-01 — Critical: Nonce Entropy Defect

### What is wrong

`generateCspNonce()` calls `crypto.randomUUID()` and then base64-encodes the
**string representation** of the UUID:

```typescript
return base64Encode(globalThis.crypto.randomUUID());
// e.g. base64("550e8400-e29b-41d4-a716-446655440000")
// → "NTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAw"
```

A UUID is a 128-bit value, but its canonical string form (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
contains 32 hex characters plus 4 hyphens. Base64-encoding that 36-character
ASCII string does **not** produce 128 bits of entropy — it produces 36 × log₂(256) ≈ 288
bits of base64 encoding of a string where the actual random bits are only the
hex nibbles, constrained by UUID version 4 structure (6 fixed bits). The
resulting nonce is longer than necessary but the entropy ceiling is ~122 bits
(UUID v4 spec), which is fine for a nonce; however, the **encoding** is wrong
for security tooling.

The MDN CSP nonce specification and Next.js nonce documentation both require
the nonce value to be **base64-encoded random bytes**, not base64-encoded UUID
strings. Many CSP validators and security scanners will flag this because the
nonce contains only hex characters `[0-9a-f]` and hyphens when decoded, making
it statistically distinguishable from random bytes and potentially exploitable
in environments that perform entropy analysis on nonces.

### Required fix

```typescript
export function generateCspNonce(): string {
  // 16 cryptographically random bytes → 128 bits of entropy → 24-char base64 string.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  // Convert to base64 safely in both browser (btoa) and Node/Edge (Buffer).
  if (typeof btoa === "function") {
    return btoa(String.fromCharCode(...bytes));
  }
  return Buffer.from(bytes).toString("base64");
}
```

Remove the `base64Encode` helper — it is only used by `generateCspNonce` and
the `btoa`/`Buffer` split belongs inside the function for clarity.

---

## F-02 — High: `x-nonce` Not Forwarded to Server Components on Redirects

### What is wrong

`withCspHeaders` sets `x-nonce` on the **response** headers:

```typescript
const withCspHeaders = (response, nonce, cspValue) => {
  response.headers.set("x-nonce", nonce); // ← response header
  response.headers.set("Content-Security-Policy", cspValue);
  return response;
};
```

Setting `x-nonce` on the response headers makes it available to the browser,
not to Server Components. Server Components read incoming **request** headers
via `headers()` from `next/headers`. The root layout does:

```typescript
const nonce = headersList.get("x-nonce") ?? undefined;
```

`nextWithCspHeaders` correctly sets the nonce on the **request** headers for
pass-through responses:

```typescript
const nextWithCspHeaders = (req, nonce, cspValue) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce); // ← request header ✓
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return withCspHeaders(response, nonce, cspValue);
};
```

But **all redirect paths** go through `withCspHeaders` directly — they never
set the request-side `x-nonce`. For redirect responses this does not matter
(the browser follows the redirect, a new request is issued, a new nonce is
generated), but the inconsistency is architecturally confusing and a latent
bug for any future path that calls `withCspHeaders` expecting `x-nonce` to be
available downstream.

More importantly: the **CSP header on redirect responses** (`307`) is sent to
the browser, but a `307` response does not render HTML, so the nonce in the CSP
header on a redirect is meaningless — the browser ignores it. Emitting a
nonce-bearing CSP on every redirect adds overhead without security benefit and
leaks the nonce value in redirect response headers, which is visible to network
observers before the final document response.

### Required fix

1. Remove `withCspHeaders` from all redirect paths. Redirects do not render
   HTML, so they do not need a nonce-bearing CSP header.
2. For redirects, emit only a CSP-less response (or a minimal static CSP
   without a nonce). The nonce-bearing CSP should only appear on responses that
   deliver a document body.
3. Rename `nextWithCspHeaders` to `applyDocumentCspHeaders` to make its
   document-only semantics clear.

```typescript
// Only set the nonce-bearing CSP header on document (200) responses.
const applyDocumentCspHeaders = (
  req: NextRequest,
  nonce: string,
  cspValue: string,
): NextResponse => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspValue);
  return response;
};

// Redirects: no nonce needed, no HTML rendered.
const redirect = (url: string | URL, status = 307): NextResponse =>
  NextResponse.redirect(url, status);
```

---

## F-03 — High: `script-src` and `script-src-elem` Split Semantics

### What is wrong

The output CSP contains:

```
script-src 'self' https://app... https://api... https://*.clerk.accounts.dev ...
script-src-elem 'nonce-abc123' 'self' https://app... ...
```

`script-src` is the **fallback** directive. `script-src-elem` is the
**specific** directive for `<script>` elements. When both are present,
browsers use `script-src-elem` for `<script>` tags and ignore `script-src`
for that purpose.

The problem is that `script-src` still contains all origin allowlists without
a nonce. In some edge cases — particularly in legacy browsers that support
`script-src` but not `script-src-elem` — the origin-only `script-src` is
used as the governing directive, completely bypassing nonce enforcement.

More critically, in any browser, `script-src` applies to `eval()` and
dynamically constructed scripts (via `new Function`, etc.). Having it without
`'none'` or `'nonce-...'` means dynamic script evaluation from any allowed
origin can still execute without a nonce.

The plan document notes `'strict-dynamic'` as a question for Phase 2, but the
`script-src` / `script-src-elem` split should be resolved now:

### Required fix

Option A (minimal — remove `script-src` and rely on `script-src-elem` fallback):

```
// Remove the standalone `script-src` line entirely.
// Browsers that support `script-src-elem` use it for <script> elements.
// Browsers that do not support `script-src-elem` fall back to `script-src`
// (in which case the nonce has no effect, but neither does the restriction).
```

Option B (defense-in-depth — add the nonce to `script-src` as well):

```typescript
`script-src 'nonce-${nonce}' ${dedup(scriptOrigins).join(" ")}`,
`script-src-elem 'nonce-${nonce}' ${dedup(scriptOrigins).join(" ")}`,
```

Option B is preferred. It ensures consistent enforcement in all browsers and
aligns with the plan's Phase 2 `'strict-dynamic'` consideration, which requires
the nonce to be in `script-src` to work.

---

## F-04 — High: Test Suite Does Not Verify Core Security Properties

### What is wrong

`csp-nonce.test.ts` verifies that:

1. The nonce is a valid base64 string.
2. The CSP contains `'nonce-nonce-value'` and not `'unsafe-inline'`.
3. Other directive names are present.

It does **not** verify:

- **Nonce uniqueness across calls.** If `generateCspNonce` had a seed or cache
  bug, every request would get the same nonce — the most dangerous CSP nonce
  failure mode.
- **Nonce length/entropy.** The current test accepts any string longer than 20
  characters that matches the base64 alphabet, including `"YQ=="` (1 byte). A
  16-byte nonce base64-encodes to exactly 24 characters; the test should assert
  this minimum.
- **No `unsafe-inline` anywhere in the `script-src-elem` directive.** The test
  only checks that the exact string `"script-src-elem 'unsafe-inline'"` is
  absent. A CSP like `"script-src-elem 'nonce-x' 'unsafe-inline'"` would pass
  this test.
- **Injection safety.** If `nonce` contains a single quote, space, or
  semicolon, it breaks the CSP header. A test with `nonce: "'; bad-directive"`
  should be included.

### Required additions

```typescript
it("generates unique nonces on successive calls", () => {
  const nonces = new Set(Array.from({ length: 100 }, generateCspNonce));
  expect(nonces.size).toBe(100);
});

it("generates nonces of at least 24 characters (16 bytes base64)", () => {
  const nonce = generateCspNonce();
  expect(nonce.length).toBeGreaterThanOrEqual(24);
});

it("does not contain unsafe-inline anywhere in script-src-elem", () => {
  const csp = buildCspWithNonce({ ...baseOpts, nonce: "abc123" });
  const directive = csp
    .split("; ")
    .find((d) => d.startsWith("script-src-elem"));
  expect(directive).not.toContain("unsafe-inline");
});

it("handles a nonce with special characters without breaking CSP structure", () => {
  // This nonce value is adversarial — ensure output is syntactically valid CSP.
  const csp = buildCspWithNonce({ ...baseOpts, nonce: "abc+def/gh==" });
  expect(csp).toContain("'nonce-abc+def/gh=='");
  // CSP header must not be broken by the nonce value.
  expect(csp.split(";").every((d) => d.trim().length > 0)).toBe(true);
});
```

---

## F-05 — Medium: `btoa` Encodes UUID String, Not Random Bytes

### What is wrong (elaboration on F-01)

Even if F-01 is fixed by switching to `crypto.getRandomValues`, the `btoa`
branch in `base64Encode` still works correctly for binary bytes if the nonce
generation is fixed — but the current implementation passes a UTF-8 string
(the UUID) to `btoa`. When `btoa` receives multi-byte characters (characters
with code points > 255), it throws `InvalidCharacterError`. UUID strings
only contain ASCII characters, so this does not throw today, but it is a
brittle contract.

After fixing F-01, the `btoa` call becomes:

```typescript
btoa(String.fromCharCode(...bytes));
```

This is the correct idiom for encoding binary `Uint8Array` data as base64 in
a browser environment. The `base64Encode(value: string)` helper should be
removed and the encoding logic inlined in `generateCspNonce` to prevent future
misuse of the helper with non-binary strings.

---

## F-06 — Medium: `expectCspHeaders` Omitted from Most Test Cases

### What is wrong

The `expectCspHeaders` helper correctly verifies that the middleware emits a
nonce-bearing CSP on every response. It is called in only 2 of 12 test cases:

- `"redirects unauthenticated protected requests to sign-in"` ✓
- `"allows onboarded professional access to professional routes"` ✓

The remaining 10 cases (maintenance redirect, signup block, onboarding redirect,
indeterminate resolver, pending verification, etc.) do not call `expectCspHeaders`.
This means the nonce injection contract is not verified for most of the routing
paths that middleware exercises.

After applying the fix for F-02 (removing nonce-bearing CSP from redirects),
the contract to verify changes: `200` responses must have CSP headers, `307`
responses must not have nonce-bearing CSP headers (or must have no CSP header).
The test helper should be split accordingly:

```typescript
function expectDocumentCspHeaders(res: Response | NextResponse) {
  // 200 responses: must have nonce-bearing CSP
  const csp = res.headers.get("Content-Security-Policy");
  expect(csp).toBeTruthy();
  expect(csp).toContain("script-src-elem 'nonce-");
  expect(csp).not.toContain("'unsafe-inline'");
  expect(res.headers.get("x-nonce")).toBeTruthy();
}

function expectRedirectNoCsp(res: Response | NextResponse) {
  // 3xx responses: must NOT have nonce-bearing CSP (see F-02)
  const csp = res.headers.get("Content-Security-Policy");
  if (csp) {
    expect(csp).not.toContain("nonce-");
  }
}
```

Apply `expectDocumentCspHeaders` to all `200` cases and
`expectRedirectNoCsp` to all `307` cases.

---

## F-07 — Medium: `toOrigin` Helper Belongs in a Shared Utility

### What is wrong

`middleware.ts` defines a `toOrigin` helper at the top of the file:

```typescript
const toOrigin = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};
```

This helper is used only to normalize env URL values before passing them to
`buildCspWithNonce`. The same normalization will be needed if `buildCspWithNonce`
is ever called from another location (e.g., a test fixture, a different
middleware path, or `next-config-csp.ts`). Duplicating it creates drift risk.

`app/lib/infrastructure/env.ts` already validates URL formats at startup via Zod.
If `env.appUrl` and `env.apiUrl` are already validated as URLs, `toOrigin` is
redundant for those values and suggests the env module is not normalizing them
to origins as part of its validation contract.

### Required fix

Either:

1. Move `toOrigin` to `app/lib/security/middleware/csp-nonce.ts` as an
   internal helper, and accept `string` values in `CspNonceOptions` (removing
   the consumer's responsibility to normalize).
2. Or, have `env.ts` expose pre-normalized origin values (e.g., `env.appOrigin`)
   so `toOrigin` is never needed by callers.

Option 2 is preferred because it aligns with ADR-004's intent: env access goes
through the canonical boundary, and type-safe values are available without
caller-side normalization.

---

## F-08 — Low: Static Fallback Comment Does Not Enforce Precedence

### What is wrong

`next-config-csp.ts` now contains:

```typescript
// FALLBACK: Middleware injects a per-request nonce-based CSP for browser routes.
// This static 'unsafe-inline' directive covers routes not matched by middleware
// (e.g., static assets, non-document requests). See ADR-008 §4 nonce strategy.
`script-src-elem 'unsafe-inline' ${dedup(scriptOrigins).join(" ")}`,
```

This comment accurately describes the intent. However, there is no automated
check to verify that the middleware matcher covers all document routes before
Phase 2 (removing `'unsafe-inline'` from the static header). If a developer
adds a new protected route outside the middleware matcher pattern and then
Phase 2 removes `'unsafe-inline'`, that route's inline Clerk scripts will be
CSP-blocked silently.

### Required fix

Before Phase 2, add a drift check or integration test that asserts the
middleware matcher `config.matcher` covers all routes that deliver HTML
documents. At minimum, document the invariant explicitly in the Phase 2
plan: "verify that no HTML-delivering route is excluded from the middleware
matcher before removing `'unsafe-inline'` from the static header."

---

## F-09 — Low: `nonce` Typed as `string | undefined` Passed to `ClerkProvider`

### What is wrong

`layout.tsx`:

```typescript
const nonce = headersList.get("x-nonce") ?? undefined;
// ...
<ClerkProvider nonce={nonce} dynamic>
```

`headers().get()` returns `string | null`. The `?? undefined` converts `null`
to `undefined`. If `ClerkProvider`'s `nonce` prop is typed as
`string | undefined`, this is fine. But if the prop is `string` (required), this
passes `undefined` silently, and Clerk will not apply the nonce to its bootstrap
scripts — defeating the entire purpose of the implementation without any error.

Additionally, if the `x-nonce` header is absent (e.g., when a page is rendered
without going through the nonce-aware middleware path), `ClerkProvider` gets
`undefined` for `nonce`. In this case, Clerk will inject inline scripts without
a nonce, which will be blocked by the nonce-bearing CSP header — causing a
broken auth flow.

### Required fix

```typescript
const nonce = headersList.get("x-nonce") ?? "";
```

An empty string is a safe fallback: `ClerkProvider` with `nonce=""` behaves
the same as no nonce (Clerk will not attempt to inject a nonce attribute on
inline scripts), and the empty string satisfies a `string` prop type
constraint. This is consistent with how `nonce` is handled in the Next.js
documentation examples.

Also add a comment explaining the fallback:

```typescript
// x-nonce is set by middleware for all document responses.
// Falls back to empty string when the request does not go through middleware
// (e.g., during static generation or local dev without auth bypass).
const nonce = headersList.get("x-nonce") ?? "";
```

---

## F-10 — Low: Critical Security Directives Not Tested

### What is wrong

`csp-nonce.test.ts` `"retains core CSP directives"` only checks for:
`default-src`, `style-src`, `img-src`, `font-src`, `connect-src`.

The following are missing from test coverage:

- `object-src 'none'` — prevents Flash/plugin execution; its absence is a
  critical CSP bypass.
- `base-uri 'self'` — prevents `<base>` tag injection attacks.
- `frame-ancestors 'self'` — prevents clickjacking (redundant with
  `X-Frame-Options: SAMEORIGIN` but defense-in-depth).
- `form-action 'self'` — prevents form hijacking.
- `worker-src 'self' blob:'` — prevents rogue workers.

If a future refactor accidentally removes `object-src 'none'`, the test suite
will not catch it.

### Required fix

```typescript
it("includes all mandatory security directives", () => {
  const csp = buildCspWithNonce({ ...baseOpts });
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("worker-src 'self' blob:");
});
```

---

## Structural Observations (No Code Change Required)

### Directive duplication between `csp-nonce.ts` and `next-config-csp.ts`

Both files maintain identical origin lists for `connectOrigins`, `scriptOrigins`,
`styleOrigins`, `imgOrigins`, and `fontOrigins`. They are currently in sync, but
any future origin addition must be made in both places or divergence occurs.

**Recommendation:** In Phase 2, refactor `next-config-csp.ts` to import origin
arrays from `csp-nonce.ts` (or a shared constants file), then override only the
`script-src-elem` directive. This avoids the duplication while preserving the
bootstrap-only constraint of `next-config-csp.ts`.

Example:

```typescript
// next-config-csp.ts — after Phase 2
import { buildCspDirectives } from "@/app/lib/security/middleware/csp-nonce";

export function buildCspValue(sources: CspSources): string {
  const directives = buildCspDirectives(sources);
  // Replace nonce directive with static 'unsafe-inline' for the fallback header.
  return directives
    .map((d) =>
      d.startsWith("script-src-elem")
        ? `script-src-elem 'unsafe-inline' ...`
        : d,
    )
    .join("; ");
}
```

### Missing `report-uri` / `report-to` directive

The plan mentions configuring `report-uri` or `report-to` directives for
production CSP violation monitoring. Neither `buildCspWithNonce` nor
`buildCspValue` supports these directives today. For Phase 2, add
`reportUri: string | null` to `CspNonceOptions` and emit:

```
report-to default; report-uri /api/csp-report
```

This is essential for detecting violations caused by missed inline scripts
before and after removing `'unsafe-inline'` in Phase 2.

### `crypto.randomUUID` availability check is correct but the error is silent in Edge

The guard `if (!globalThis.crypto?.randomUUID)` throws a descriptive error at
request time in Node and V8, but in Cloudflare Workers this API is available.
The plan's Q3 (Cloudflare compatibility) is relevant here: the implementation
is compatible with Cloudflare Workers as written. No change needed, but the
comment in the code should confirm this explicitly:

```typescript
// crypto.randomUUID is available in: Node 15+, V8 (Vercel/Edge), Cloudflare Workers.
// Throws at request time if unavailable — fails loud, not silent.
```

---

## Pre-Phase-2 Checklist

These items must be resolved before removing `'unsafe-inline'` from the static
CSP fallback in `next-config-csp.ts`:

- [ ] F-01 fixed: `generateCspNonce` uses `crypto.getRandomValues` on raw bytes
- [ ] F-02 fixed: redirects do not emit nonce-bearing CSP headers
- [ ] F-03 fixed: `script-src` either removed or also receives the nonce
- [ ] F-04 fixed: uniqueness, entropy, and injection safety tests added
- [ ] F-06 fixed: all middleware test cases assert correct CSP header behavior
- [ ] F-09 fixed: `nonce` in `layout.tsx` defaults to `""` not `undefined`
- [ ] `report-uri` / `report-to` directive added to `buildCspWithNonce`
- [ ] Staging canary shows zero CSP violations over 24-hour window

---

## Verification Commands

```bash
# Unit tests for csp-nonce module
pnpm -C apps/client exec vitest run __tests__/security/csp-nonce.test.ts --maxWorkers=1

# Middleware route guard tests
pnpm -C apps/client exec vitest run __tests__/middleware/route-guards.test.ts --maxWorkers=1

# Full typecheck
pnpm run client:tsc-noemit

# Security drift (must remain 0)
pnpm run client:report-security-drift:strict
```
