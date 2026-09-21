# apps/client — Remaining ASVS Architecture Gap Closure (Revised v2)

**Revision date:** 2026-04-09  
**Replaces:** ASVS-GAP-CLOSURE-REVISED.md  
**Status baseline:** `pnpm -C apps/client run report-security-drift:strict` is zero as of revision date  
**Targets:** `GAP-004`, `GAP-005`, `GAP-006` (partial), `GAP-007`, `GAP-009` (scoping),
`GAP-013`, `GAP-015`, `GAP-016`, `GAP-017`, `ADD-001` (partial), plus six newly
identified hardening items

**What changed in v2:** Three implementation files were reviewed —
`api-middleware.ts`, `rate-limit.ts`, and `idempotency.service.ts`. Those reviews
produced concrete corrections to Sections 2.1, 2.2, 3, and 10.3, and added a
new Section 10.5. Each changed section is marked `[updated v2]` or
`[new v2]` in its heading.

---

## 0. Pre-Work: Fix the Evidence Baseline Before Adding New Coverage

These items must land before any new drift categories or test assertions are
written. Building new enforcement on top of known gaps produces false confidence.

### 0.1 Repair the Tier-3 test suite evidence drift

`__tests__/actions/tier3-high-value-guard-policy.test.ts` still asserts the
retired `updateClerkOnboardingMetadata(...)` step. Runtime code and the strict
drift report now enforce `finalizeClerkOnboardingTransition(...)`. The test
suite and the drift rules must agree on the same canonical step name.

**Action:** Update the test suite to assert `finalizeClerkOnboardingTransition(`
before writing any new sequencing rules. A test that passes by matching a
retired symbol is not a test — it is a false-green.

### 0.2 Promote `logSafetySpreadReview` to a blocking CI gate

The drift script identifies spread operators into logger calls as
`spreadReviewCandidates` but excludes them from the `hasFindings` condition
that gates `--fail-on-any`. A spread of an actor or auth context shape into a
structured log event — `...authContext`, `...actor`, `{ ...ctx, extra }` — fans
out `userId`, `clerkId`, or `email` into the event payload undetected.

`DRIFT-001` cannot be considered closed while this gap exists.

**Action:** Add `logSafetySpreadReview` to the `hasFindings` condition, or
extend `SEC-LINT-005` to flag object spreads of known actor/auth shape names
(`actor`, `authContext`, `auth`, `ctx`) inside logger call arguments. Choose
whichever approach produces zero false positives on the current clean codebase
and commit that as the new gate.

### 0.3 Make browser storage drift allowlists per-callsite, not per-file

`collectStorageDrift()` currently exempts an entire file from storage checks
when `SECURITY_PERSISTENCE_ALLOWLIST` appears anywhere in the file. One
legitimate annotated write today silently passes every future unannotated write
added to the same file.

`ADD-003` cannot be marked `Closed` while this allowlist scope is too broad.

**Action:** Adopt the same windowed-marker approach used by
`collectServerActionValidationPolicyDrift()`. The allowlist marker must appear
within three lines of the specific `localStorage`/`sessionStorage` callsite it
covers, not at the top of the file. Migrate any existing annotated callsites to
the per-callsite convention as part of this change.

### 0.4 Resolve the shared registry module format

The shared high-risk operation registry (Section 1) must be consumable by both
the `.mjs` drift script (Node, no TypeScript build) and the Vitest test suite
(TypeScript). These are incompatible default module formats if the registry is
authored as `.ts`.

**Chosen approach — decide before implementation starts:**

Option A (recommended): Author the registry as
`app/lib/security/high-risk-registry.ts`. Add a build step to
`apps/client/package.json` that compiles only this file to
`scripts/high-risk-registry.mjs` using `tsc --module esnext`. The drift script
imports from the compiled output. The Vitest suite imports from the `.ts`
source.

Document the chosen format in `scripts/README.md` before implementation.

---

## 1. Shared High-Risk Operation Registry [updated v2]

This is the highest-leverage item in the plan. Everything else in Sections 2
through 5 depends on the registry being correct and complete before tests and
drift rules reference it.

### 1.1 Registry contents

The registry enumerates every high-risk operation with the guardrails required
for each. The `recentAuth` option in `withAuth` is an object
`{ maxAgeSeconds?: number }`, not a boolean. The default `maxAgeSeconds` is
300 seconds. For highest-risk financial operations (escrow release, payout), a
tighter window is appropriate — 180 seconds is suggested. The registry must
specify the value explicitly for each entry so the expected window is
reviewable and the drift check can verify it is present.

**Server actions:**

| File                        | Action                       | Required `secureAction` options |
| --------------------------- | ---------------------------- | ------------------------------- |
| `app/actions/finance.ts`    | `requestWithdrawalAction`    | `recentAuth`, `rateLimit`       |
| `app/actions/onboarding.ts` | `submitOnboarding`           | `recentAuth`, `rateLimit`       |
| `app/actions/onboarding.ts` | `skipOnboarding`             | `recentAuth`, `rateLimit`       |
| `app/actions/onboarding.ts` | `skipProfessionalOnboarding` | `recentAuth`, `rateLimit`       |

**API routes:**

| File                                                       | Export   | `withAuth` options required          | Rate-limit snippets required             |
| ---------------------------------------------------------- | -------- | ------------------------------------ | ---------------------------------------- |
| `app/api/projects/[id]/escrow/[escrowId]/fund/route.ts`    | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`, `escrow-write:`       |
| `app/api/projects/[id]/escrow/[escrowId]/release/route.ts` | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`, `escrow-write:`       |
| `app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts` | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`, `escrow-write:`       |
| `app/api/professional-portal/documents/route.ts`           | `POST`   | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `prof-docs-write:`    |
| `app/api/professional-portal/documents/[id]/route.ts`      | `PATCH`  | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `prof-docs-write:`    |
| `app/api/professional-portal/documents/[id]/route.ts`      | `DELETE` | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `prof-docs-write:`    |
| `app/api/professional-portal/licenses/route.ts`            | `POST`   | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `licenses-write:`     |
| `app/api/professional-portal/licenses/[id]/route.ts`       | `PATCH`  | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `licenses-write:`     |
| `app/api/professional-portal/licenses/[id]/route.ts`       | `DELETE` | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `licenses-write:`     |
| `app/api/professional-portal/certificates/route.ts`        | `POST`   | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `certificates-write:` |
| `app/api/professional-portal/certificates/[id]/route.ts`   | `PATCH`  | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `certificates-write:` |
| `app/api/professional-portal/certificates/[id]/route.ts`   | `DELETE` | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`, `certificates-write:` |
| `app/api/user/export/route.ts`                             | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`                        |
| `app/api/user/deletion/route.ts`                           | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`                        |
| `app/api/user/rectification/route.ts`                      | `PATCH`  | `recentAuth: { maxAgeSeconds: 300 }` | `checkRateLimit(`                        |
| `app/api/finance/payout/route.ts`                          | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`, `payout-write:`       |
| `app/api/finance/payout/[id]/cancel/route.ts`              | `POST`   | `recentAuth: { maxAgeSeconds: 180 }` | `checkRateLimit(`, `payout-write:`       |

Confirm the exact file paths exist before committing the registry. Routes that
do not yet exist and are planned should be added with a `planned: true` marker
so the drift check skips them as intentionally absent rather than flagging them
as unexpectedly deleted.

### 1.2 Registry validation: the `unparsable-secure-action-options` path

The `extractBalancedBraceBlock` parser can silently pass a non-compliant
handler if `secureAction` is called with a variable options object rather than
an inline literal. Add a test that constructs exactly this case and verifies it
surfaces as an `unparsable-secure-action-options` offender, not a clean pass.

This test belongs in `__tests__/scripts/high-risk-registry-parser.test.ts`
and must fail before the parser is hardened and pass afterward.

### 1.3 Rate-limit key naming convention [updated v2]

When the Redis-backed actor-scoped throttling is implemented (Section 3), the
rate-limit key format must be consistent across the registry. Define this
convention as a JSDoc comment in `app/lib/api/rate-limit.ts`:

```
// Authenticated actor-scoped rate-limit key format:
//   {resourceType}-{operation}:{dbUserId}
//   e.g. "certificate-write:a1b2c3d4-uuid"
//
// For unauthenticated or public routes where no actor is resolved,
// use the hashed IP fallback only:
//   {resourceType}-{operation}:ip:{hashedIp}
```

The drift check for actor-scoped throttling must verify that the key string
passed to `checkRateLimit()` contains a reference to `dbUserId`, not just
that `checkRateLimit` was called. A pattern like
`/checkRateLimit\([^)]*\$\{[^}]*(?:dbUserId|actorId)/` is a starting point;
tune against the actual calling patterns in the codebase before committing it.

---

## 2. GAP-004 / GAP-016: Step-Up Auth and Sequencing Expansion

### 2.1 `recentAuth` execution order — confirmed, no handler changes required [updated v2]

Reading `api-middleware.ts` confirms that `recentAuth` is a wrapper-level check.
The execution order within `withAuth` is:

1. Clerk session resolution (`auth()`) → extract `clerkId`
2. **`recentAuth` validation** (if option set) → returns `401` immediately if
   stale, before any DB access or handler code
3. DB user lookup with timeout protection
4. User status check (blocked/suspended/etc.)
5. Admin role lookup (ADMIN actors only)
6. Params resolution
7. CSRF origin validation
8. Handler body execution

Because `recentAuth` fires at step 2 — before the handler body executes at
step 8 — a stale session never reaches the idempotency replay branch inside
the handler. The concern raised in the previous plan version about whether
idempotency replay needed to be gated separately is resolved: the architecture
already guarantees it.

**No inline `recentAuth` checks are needed inside handler bodies.** Adding them
would be redundant with the wrapper and would create two diverging definitions
of freshness policy for the same operation.

**Option shape:** The `recentAuth` option is `{ maxAgeSeconds?: number }`,
not a boolean. Default is 300 seconds. The registry table in Section 1.1
specifies explicit `maxAgeSeconds` values per operation. The drift check must
verify the option is present as an object key, not just that the string
`"recentAuth"` appears somewhere in the file.

**Dev bypass note:** The dev bypass path in `withAuth` does not run the
`recentAuth` check even when the option is set. This is acceptable since the
bypass is restricted to `localhost`/`127.0.0.1`/`::1` in `isDev && !isCI`
environments. Test suites exercising `recentAuth` behavior must confirm that
`BYPASS_AUTH` is not set in the test environment, otherwise freshness tests
will trivially pass for the wrong reason.

### 2.2 `clerkId` actor context — confirmed available, fix is at the route level [updated v2]

`AuthContext.clerkId` is typed as `string` (non-optional). It is always
populated by `withAuth` before the handler is called. The verification routes
drop it by destructuring only `{ dbUserId, userRole }` from the context
argument, constructing the actor as `{ userId: dbUserId, role: actorRole }`
without `clerkId`. The field is available; the routes are choosing not to
forward it.

**Concrete fix:** In every handler in the Section 1.1 registry that constructs
an actor object, destructure `clerkId` from the context and include it:

```typescript
// Before (current pattern in certificates and documents routes):
async (req, { dbUserId, userRole }, params) => {
  const actorRole = normalizeRole(String(userRole));
  // ...
  certificatesService.updateCertificate(
    { userId: dbUserId, role: actorRole },
    id,
    updateData,
  );
};

// After:
async (req, { dbUserId, userRole, clerkId }, params) => {
  const actorRole = normalizeRole(String(userRole));
  // ...
  certificatesService.updateCertificate(
    { userId: dbUserId, clerkId, role: actorRole },
    id,
    updateData,
  );
};
```

**Prerequisite audit:** Before making this change mechanically across all
verification routes, confirm that the domain contracts for `certificatesService`,
`documentsService`, and `licensesService` declare `clerkId` as either required
or optional in their actor type. If the domain service currently accepts
`{ userId, role }` only, the contract must be updated first to accept
`{ userId, clerkId?, role }` or equivalent. Do not add `clerkId` to the actor
at the adapter layer without confirming the domain layer is prepared to receive
it — a field added to the adapter that the domain silently ignores provides no
value and creates a misleading contract.

### 2.3 GAP-006 partial: Clerk metadata freshness after verification status transitions

When a document or certificate submission successfully transitions the
professional's verification status (e.g., `UNVERIFIED` → `PENDING`), the
Clerk session may still carry pre-transition claims until the next token
refresh. ADR-001 requires that the Clerk metadata update be confirmed before
a privileged transition response is finalized.

This is scoped to verification submission paths only. Full GAP-006 closure
(all role-transition operations) is a separate follow-up pass.

**Action:** After `documentsService.createDocument` or
`certificatesService.createCertificate` (and their license equivalents)
return a success result that includes a verification status change, invoke the
Clerk metadata update path before returning the success response. If the update
cannot be confirmed synchronously, return `202 Accepted` and let the client
poll for completion rather than returning a `201` that implies the full
transition is complete. Add a policy test asserting that a verification status
transition calls the Clerk metadata update path, in
`__tests__/policy/professional/verification-status-transition.policy.test.ts`.

### 2.4 Expand `CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES`

The current rules cover documents POST and PATCH, and licenses PATCH only. The
following are missing and must be added:

| File                                                     | Export  | Ordered steps to assert                                                                          |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `app/api/professional-portal/certificates/route.ts`      | `POST`  | `certificatesService.createCertificate(` before `IdempotencyService.complete(`                   |
| `app/api/professional-portal/certificates/[id]/route.ts` | `PATCH` | `certificatesService.updateCertificate(` before `IdempotencyService.complete(`                   |
| `app/api/professional-portal/licenses/route.ts`          | `POST`  | `licensesService.createLicense(` before `IdempotencyService.complete(` (confirm exact call name) |
| `app/api/professional-portal/documents/[id]/route.ts`    | `PATCH` | `documentsService.updateDocument(` before `IdempotencyService.complete(`                         |

DELETE handlers do not use idempotency at present — add them to the rules
if that changes. Verify all service call names against the actual files before
committing. A rule that matches the wrong function name is a silent false-pass.

---

## 3. GAP-015: Actor-Scoped Anti-Automation [updated v2]

### 3.1 The rate-limit backend must be Redis before actor-scoped keys matter

Reading `rate-limit.ts` reveals that the current implementation is a
**process-local in-memory store** explicitly marked "for development only." It
uses a plain JavaScript object and `setInterval` for cleanup. In production:

- The store resets on every cold start and function restart (serverless
  environments), effectively bypassing all rate limits after any restart event.
- Rate limit state does not aggregate across pods in horizontally scaled
  deployments. Each pod maintains an independent window, multiplying the
  effective limit by the pod count.
- `setInterval` is unreliable in serverless/Edge runtimes and will not fire
  between requests in a dormant function instance.

**GAP-015 cannot close while rate limiting is backed by an in-memory store.
The current implementation provides zero protection in production. This is the
primary problem. Switching to actor-scoped keys in the same in-memory store
does not fix it.**

The work in Section 3 is therefore sequenced in two mandatory phases:

### Phase 1 (prerequisite): Migrate to Redis-backed rate limiting\*\*

Implement a Redis-backed sliding window rate limiter using `@build/redis` as
the canonical Redis abstraction (per architecture docs, not a third-party
client directly). The implementation must:

- Use a sliding window algorithm, not a fixed window, to prevent burst
  exploitation at window boundaries.
- Maintain state in Redis with a key TTL matching the window duration so
  expired entries are cleaned by Redis itself, not by `setInterval`.
- Preserve the same `checkRateLimit(identifier, limit, window)` function
  signature so call sites do not need to change in Phase 1.
- Keep the in-memory implementation in a separate file (e.g.,
  `rate-limit.dev.ts`) importable for test environments and local dev,
  selected by the env boundary module. Do not conditionally branch inside
  the same module on `isDev` — keep the two implementations cleanly separated.

Confirm whether `@build/redis` exposes a sliding window primitive or whether
one needs to be built using Lua scripting against the raw Redis client. If
`@build/redis` already wraps Upstash Ratelimit, use that surface. If not, add
the primitive to `@build/redis` rather than reimplementing it inline in
`apps/client`.

### Phase 2: Introduce actor-scoped key scheme\*\*

Once the Redis-backed backend is in place, add the actor-aware identifier
helper to `app/lib/api/rate-limit.ts`:

```typescript
/**
 * Returns an actor-scoped rate-limit identifier for authenticated routes.
 * Use getRateLimitIdentifier (IP-based) only for public/anonymous surfaces.
 */
export function getActorRateLimitIdentifier(
  dbUserId: string,
  routeNamespace: string,
): string {
  return `${routeNamespace}:${dbUserId}`;
}
```

Apply `getActorRateLimitIdentifier` to every route in the Section 1.1 registry.
The existing `getRateLimitIdentifier` (IP-based) remains as the fallback for
public routes only.

GET handlers on resource-ID surfaces in the verification route family must also
use actor-scoped throttling. The current `certificate-read:${identifier}` and
`prof-docs-read:${identifier}` keys use IP-based identifiers and allow
enumeration via distributed proxied requests. Replace them with actor-scoped
keys for all authenticated item-level GET handlers.

### 3.2 Drift check for actor-scoped throttling

Add a `actorScopedThrottling` drift category to `report-security-drift.mjs`.
For every file in the registry, verify that the rate-limit key passed to
`checkRateLimit()` contains a reference to `dbUserId` (or the actor ID variable
in that handler's scope). A finding is raised when the route is in the registry
but its rate-limit key still derives from `getRateLimitIdentifier` (IP-based).

This drift check must be added during Phase 2 — it has no meaning while the
backend is in-memory.

---

## 4. GAP-005: Cookie Governance

### 4.1 Two-mode cookie helper

Centralize app-owned cookie writes behind a helper at
`app/lib/api/cookies.ts`. The helper must have two explicit modes:

```typescript
/**
 * writeFunctionalCookie — for purely UI/state cookies (sidebar, preferences).
 * SameSite=Lax: sent on top-level navigations, blocked on cross-site
 * fetch/XHR. Appropriate where there is no session-adjacent risk.
 */
export function writeFunctionalCookie(
  name: string,
  value: string,
  options?: { maxAge?: number },
): string { ... }

/**
 * writeAuthAdjacentCookie — for any cookie that gates access or carries
 * session-adjacent state. SameSite=Strict: never sent cross-site.
 * Default when classification is uncertain.
 */
export function writeAuthAdjacentCookie(
  name: string,
  value: string,
  options?: { maxAge?: number },
): string { ... }

// Both helpers always set: Path=/, conditional Secure (HTTPS/prod), and Max-Age.
// Neither helper permits SameSite=None without an explicit documented
// cross-origin embedding justification in the calling code.
```

### 4.2 Classify each existing direct cookie write at migration time

Document the classification decision for each direct `Set-Cookie` write before
migrating it. The migration commit message must include the mode chosen and the
reason. Do not migrate without recording the classification.

Known direct writes requiring classification:

- Sidebar state cookie → `writeFunctionalCookie`
- Cookies set in auth callback handlers → `writeAuthAdjacentCookie`
- Cookies preserving onboarding step state → review against ADR-006 Class B
  exclusion (do not persist identity or verification state in cookies regardless
  of `SameSite` mode)

### 4.3 Clerk session cookie governance

Clerk owns session-cookie issuance. App-level enforcement of Clerk cookie
attributes is not possible through code. Close this gap through a repo-local
governance artifact.

Add a section to `apps/client/docs/adr/ADR-001-auth-model.md` titled "Clerk
Session Cookie Verification Checklist." It must document: (1) the expected
`SameSite`, `HttpOnly`, `Secure`, and `Max-Age`/`Expires` values for Clerk
session cookies in the production Clerk dashboard configuration; (2) the last
date these settings were verified; (3) the process for re-verifying after any
Clerk configuration change.

Do not add CI tests that depend on Clerk external state — they will be brittle
and will erode confidence in the suite when they flake.

---

## 5. GAP-007: Systematic IDOR Policy Matrix

### 5.1 Shared policy-test helpers

Create `__tests__/policy/helpers/policy-test-utils.ts`:

```typescript
export async function expectNotFound<T>(
  result: Promise<Result<T, DomainError>>,
) {
  const r = await result;
  expect(r.ok).toBe(false);
  expect((r as { error: string }).error).toBe("not_found");
}

export async function expectForbidden<T>(
  result: Promise<Result<T, DomainError>>,
) { ... }

export async function expectOk<T>(
  result: Promise<Result<T, DomainError>>,
) { ... }
```

### 5.2 Coverage requirements per domain family

Add a policy suite file per domain under `__tests__/policy/`. The following
domain families require coverage — add files for those that do not already exist:

`properties`, `projects`, `portfolio`, `messaging`, `stores`, `idea-books`,
`notifications`, `leads`, `inquiries`, `documents`, `licenses`, `certificates`,
`calendar`, `user-profile`.

For every authenticated domain method that accepts a resource ID, the suite
must include:

1. **Owner access** — `expectOk`
2. **Non-owner same-role access** — `expectNotFound` (not `expectForbidden`,
   unless intentional disclosure is documented — see 5.3)
3. **Cross-role non-participant access** — `expectNotFound`
4. **Admin override** — `expectOk` (admin must be able to access any resource)
5. **Absence of admin override for non-admin elevated roles** —
   `expectNotFound` or `expectForbidden` as appropriate

Points 4 and 5 are not optional. An unintended admin bypass is a security
problem. A missing intended admin bypass is an operations problem. Both must
be tested.

### 5.3 Intentional-disclosure exception manifest

Create `__tests__/policy/INTENTIONAL_DISCLOSURE_EXCEPTIONS.md`. For any
resource-ID method that intentionally returns `forbidden` instead of
`not_found` for non-owner access, document: the domain, the operation, the
business justification, and the reviewer who signed off. The `forbidden`
outcome in these documented cases must still be tested explicitly.

---

## 6. GAP-013: Make ADR-006 Operational at Boundary Docs

### 6.1 Annotation convention

Use the following inline comment format at DTO boundaries and domain contracts
when Class A or Class B fields are present:

```typescript
// ADR-006 classification: Class B — email, phone. Minimum-necessary surface.
// Reviewed: YYYY-MM-DD by @reviewer
```

Files with no Class A or B fields require no annotation. The absence of an
annotation on a non-sensitive file is not a drift finding.

### 6.2 Priority annotation targets

Annotate in this order:

1. `app/api/user/export/**`, `app/api/user/deletion/**`,
   `app/api/user/rectification/**` — Class A and B surface
2. `app/api/professional-portal/documents/**`,
   `app/api/professional-portal/licenses/**`,
   `app/api/professional-portal/certificates/**` — Class B
3. `app/actions/onboarding.ts` — review persisted fields against ADR-006
   Class B exclusion
4. `app/actions/finance.ts` — Class B payout/banking fields
5. Domain contracts files for the above slices

### 6.3 Forward-looking drift detection

The drift check must catch new sensitive files that lack annotations, not only
check that registered files haven't lost existing ones. Add a
`sensitiveAnnotationCoverage` drift category that:

1. Scans files matching high-sensitivity path patterns:
   `app/api/professional-portal/**`, `app/api/user/export/**`,
   `app/api/user/deletion/**`, `app/api/user/rectification/**`,
   `app/actions/finance.ts`, `app/actions/onboarding.ts`
2. Checks each matched file for `ADR-006 classification:`
3. Files that match the pattern and lack the annotation, and are not in an
   explicit exception allowlist, are a drift finding

The exception allowlist for files in these paths that genuinely carry no
Class A or B fields (e.g., query-only read handlers) must be maintained in
`scripts/adr006-annotation-exceptions.json` and reviewed when updated.

---

## 7. GAP-017: DELETE Method Semantics

### 7.1 Runtime change — versioned item DELETE routes

Remove body-level version fallback from all versioned item DELETE handlers.
Require `If-Match` header-driven semantics exclusively. Return `428 Precondition
Required` when `If-Match` is absent.

Resolved 2026-04-13: the temporary properties collection delete shim
(`DELETE /api/properties/[id]/documents?documentId=...`) has been retired;
document deletion is now item-route only (`/documents/[documentId]`).

True collection DELETEs (e.g., notifications batch delete) may remain
body-driven but must carry a comment:
`// Collection DELETE: body semantics are intentional, not an item-delete fallback.`

### 7.2 Extend static enforcement beyond `SEC-LINT-006`

Add a `deleteMethodSemanticsDrift` category to `report-security-drift.mjs`
that flags `DELETE` route handlers which:

- Call `req.json()` or read `req.body` without being in the exceptions allowlist
- Reference a `version` field from a body parse without an `If-Match` header
  read in the same handler

Files in `scripts/gap017-delete-exceptions.json` are excluded from the finding.

---

## 8. ADD-001: CSRF Verification for the Verification Route Family

The professional verification routes are being touched in this pass. It is
low-friction to add CSRF coverage now rather than in a separate pass.

Reading `api-middleware.ts` confirms that `validateTrustedMutationOriginForRequest`
is called at the `withAuth` wrapper level, after the DB user lookup and before
the handler body. It fires automatically for all routes wrapped by `withAuth`.
The CSRF check also runs correctly in the dev bypass path.

**Action:** Verify that the shared CORS/CSRF helper is consistently applied
to every route in the Section 1.1 registry. For the professional verification
family specifically:

1. Confirm no route in the verification family passes `csrf: { exempt: ... }`
   in its `withAuth` options without a documented justification. An exemption
   applied during development and not removed is the most common drift pattern.
2. Add `SEC-TEST-003` coverage for the verification route family: cross-site
   mutation requests must be rejected with `403` and must not reach the
   idempotency or domain layer.
3. Update `DRIFT-006` status to reflect that the helper fires at the wrapper
   level for all verification routes, with remaining work being full-registry
   adoption review.

---

## 9. New Hardening Items

These items were identified from reviewing the actual route files and service
implementations. They were not in the previous plan.

### 9.1 `additionalContext` log payload is an uncontrolled PII surface

Both the certificates and documents routes log structured events with an
`additionalContext: Record<string, unknown>` field that is caller-controlled:

```typescript
logger.info("Professional certificates adapter outcome", {
  ...fields,
  additionalContext: additional, // ← opaque bag, not scanned by collectLogDrift()
});
```

The `additional` parameter includes values like `{ category: certData.category }`.
For documents, `category` can be `ID_OR_PASSPORT` or `KRA_TAX_COMPLIANCE` —
a Class B classification marker, not safe to log. The current `collectLogDrift()`
scanner catches explicit key names like `userId:` but does not inspect the
contents of an `additionalContext` bag, so this passes undetected.

**Actions:**

1. Remove the `additionalContext` escape hatch from the structured log shape in
   these routes. Replace it with explicit safe keys: `certificateId`,
   `updatedFieldsCount`, `idempotency`. No opaque payload bags.
2. Verify that `category` (document/certificate category) is never logged as a
   field value — only as a count or boolean presence if needed.
3. Add `SEC-LINT-008`: flag any logger call that passes a key named
   `additionalContext`, `extra`, `metadata`, or `context` typed as
   `Record<string, unknown>` without an explicit safety marker
   `// SECURITY_LOG_CONTEXT_REVIEWED`.
4. Add `additionalContextInLogs` to the drift report categories.

### 9.2 Domain error message leaks through `apiError()` in documents GET

In `app/api/professional-portal/documents/route.ts`, the GET handler:

```typescript
return apiError(result.data.message ?? "Forbidden", mappedStatus);
```

passes a domain `message` field directly as the client-facing error. This is
semantically identical to the `apiError(error.message, ...)` pattern blocked
by `SEC-LINT-004`, but the current lint rule matches `error.message` and
`error.stack` — it does not match `result.data.message` or `data.message`.

**Actions:**

1. Fix the immediate bug: replace `result.data.message ?? "Forbidden"` with
   the pre-approved static string `"Forbidden"` and log the domain message at
   `warn` level with the correlation ID.
2. Extend `SEC-LINT-004` to flag these additional patterns as
   `unsafe-api-error` findings:
   - `apiError(result.data.message`
   - `apiError(data.message`
   - `apiError(result?.data?.message`
   - `apiError((data as { message`
3. Add a test asserting the documents GET handler returns static `"Forbidden"`,
   not domain message text, on a non-ok domain result.

### 9.3 Idempotency key generation: SHA-256 confirmed, input projection is defense-in-depth [updated v2]

Reading `idempotency.service.ts` confirms that `IdempotencyService.generateKey`
uses SHA-256:

```typescript
static generateKey(userId: string, operation: string, payload: unknown): string {
  const hash = crypto.createHash("sha256");
  hash.update(`${userId}:${operation}:${JSON.stringify(payload)}`);
  return hash.digest("hex");
}
```

The output is an opaque hex digest — Class B fields in the payload input are
never recoverable from the stored key. The previous plan's concern about
"if serializes rather than hashes" is resolved.

However, two observations remain worth addressing:

**Observation 1 — Input projection is still a defense-in-depth improvement.**
The hash input string includes `JSON.stringify(payload)` for the full
`...updateData` spread. While the output is opaque, the full payload (potentially
including Class B field values) is transiently processed in memory during key
derivation. Projecting to Class C/D fields before passing to `generateKey`
eliminates this transient processing and makes the intent explicit:

```typescript
// Instead of:
IdempotencyService.generateKey(dbUserId, "PATCH", {
  domain: "certificate",
  certificateId: id,
  ...updateData, // full payload including Class B fields
});

// Use:
IdempotencyService.generateKey(dbUserId, "PATCH", {
  domain: "certificate",
  certificateId: id,
  fieldsUpdated: Object.keys(updateData).length, // Class C summary only
});
```

This change is not urgent but should be included when touching these route
handlers to make the data-handling intent reviewable.

**Observation 2 — Replay serialization already enforces ADR-006.**
The `serializeReplayPayloadForScope` function is called by `complete()` and
walks the response object recursively, calling `assertReplayKeyAllowed` for
each field key. For the `certificate` scope, which is registered as
`CLASS_C_AND_D_ONLY`, any field in the DTO response whose name matches a
Class B fragment will cause `assertReplayKeyAllowed` to throw. This is
correct fail-closed behavior, but it creates a new risk addressed in
Section 9.4.

### 9.4 `IdempotencyService.complete()` throws on ADR-006 violations — unhandled in route handlers [new v2]

`IdempotencyService.complete()` calls `serializeReplayPayloadForScope()`, which
throws if any field in the response DTO is classified above the scope's allowed
data classes. Route handlers call `complete()` without a try-catch:

```typescript
// Current pattern in certificates and documents routes:
await IdempotencyService.complete(idempotencyKey, data.data);
logOutcome("succeeded", HttpStatus.OK, { certificateId: id });
return apiSuccess(data.data, HttpStatus.OK);
```

If `data.data` contains a field name matching a Class B or A fragment (e.g.,
a domain service that adds a `licenseNumber`, `email`, or `nationalId` field
to the response DTO), `complete()` throws. The throw propagates out of the
handler body and is caught by `withAuth`'s top-level catch, which returns
`apiError("Authentication failed", 401)` — a misleading error code after a
successful domain operation. The domain mutation succeeded, but the idempotency
key is left in `PENDING` state. The client receives 401 and may retry. On retry,
`checkOrCreate` finds the PENDING key and returns a 409 conflict, blocking the
client permanently until the TTL expires.

This is a correctness and retry-safety failure, not only a security concern.

**Actions:**

1. Wrap `IdempotencyService.complete()` calls in a try-catch at every call
   site in the verification route family. On failure, log a structured error
   event with `outcome: "idempotency_complete_failed"`, mark the key failed
   with `IdempotencyService.fail(idempotencyKey)`, and still return the success
   response — the domain operation succeeded and the client must not be penalized
   for a persistence-layer failure.

```typescript
try {
  await IdempotencyService.complete(idempotencyKey, data.data);
} catch (err) {
  // complete() threw — likely an ADR-006 policy violation in the DTO shape.
  // Mark failed so retries do not receive a stale PENDING response.
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
  logger.error(
    "Idempotency completion failed",
    err instanceof Error ? err : new Error(String(err)),
    {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome: "idempotency_complete_failed",
      httpStatus: HttpStatus.OK,
      durationMs: Date.now() - requestStartedAt,
    },
  );
  // Do not return an error to the client — the domain operation succeeded.
}
logOutcome("succeeded", HttpStatus.OK, { certificateId: id });
return apiSuccess(data.data, HttpStatus.OK);
```

1. Add a test for each verification scope that exercises `complete()` with the
   expected domain DTO shape and asserts no throw. This is a regression guard
   against domain service changes that silently add Class B fields to a DTO
   whose scope policy does not permit them.

2. Consider adding a CI drift check that flags `IdempotencyService.complete(`
   calls not wrapped in a try-catch in high-risk route files. This can be a
   new `idempotencyCompletionSafety` drift category.

3. As a longer-term improvement, `IdempotencyService.complete()` could be
   refactored to return a `Result<void, IdempotencyError>` rather than throwing,
   making call-site error handling explicit and type-safe. This is a broader
   service API change that should be tracked separately rather than done
   inline in this pass.

### 9.5 Compliance audit action enum mismatch on certificate DELETE

In `app/api/professional-portal/certificates/[id]/route.ts`, the DELETE handler:

```typescript
ComplianceService.logAdminAction(
  dbUserId,
  AuditAction.PROFILE_UPDATED, // ← deletion logged as an update
  "ProfessionalDocument",
  id,
  { category: data.data.category, action: "DELETE_CERTIFICATE" },
);
```

`AuditAction.PROFILE_UPDATED` is semantically incorrect for a soft-deletion
event. The metadata carries `action: "DELETE_CERTIFICATE"` but the audit action
enum is what compliance query tooling groups by — the metadata is not indexed.

**Actions:**

1. If `AuditAction.DELETE_PROFESSIONAL_DOCUMENT` or an equivalent deletion
   action exists in the Prisma enum, use it instead.
2. If no deletion action exists, add `PROFESSIONAL_DOCUMENT_DELETED` to the
   `AuditAction` enum in `packages/db/prisma/schema.prisma` and use it.
3. Apply the same review to documents DELETE and any license DELETE with the
   same pattern.
4. This does not block the rest of this plan but must not be deferred
   indefinitely — log it in `docs/CHANGELOG.md` under compliance corrections.

---

## 10. Items Explicitly Out of Scope for This Plan

These items from the ASVS audit are not addressed here. They are listed to
prevent silent omission.

| Item                                                    | Status       | Next action                                                                                                          |
| ------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `GAP-009` (XSS rendering safety)                        | `Strengthen` | Separate pass: review all `SECURITY_XSS_ALLOWLIST` marker sites to confirm sanitizer chain is correct end-to-end     |
| `GAP-006` session invalidation (non-verification flows) | `Strengthen` | Broader Clerk metadata refresh pass across all role-transition operations; verification paths covered in Section 2.3 |
| `GAP-018` security header coverage                      | `Strengthen` | Separate pass targeting `next.config.ts` CSP completeness and header policy ADR                                      |
| `GAP-019` dependency-vulnerability SLAs                 | `Strengthen` | Separate ops pass: add triage SLA, scheduled scan, SBOM output                                                       |
| `ADD-004` webhook replay (non-Clerk callbacks)          | `Strengthen` | Separate pass: generalize replay suppression beyond Clerk-specific implementation                                    |
| `DRIFT-006` CORS policy full-registry adoption          | `Strengthen` | Ongoing: verify each new route in the registry uses the shared CORS helper                                           |

---

## 11. Test Plan

### 11.1 Preconditions before new tests are written

- [ ] Section 0.1 — `tier3-high-value-guard-policy.test.ts` updated to reference `finalizeClerkOnboardingTransition`
- [ ] Section 0.2 — `logSafetySpreadReview` added to `hasFindings` gate
- [ ] Section 0.3 — storage drift allowlist migrated to per-callsite markers
- [ ] Section 0.4 — shared registry format documented and agreed

### 11.2 New drift categories (all must reach zero before merging)

| Category                      | What it detects                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `actorScopedThrottling`       | Registry routes using IP-based rather than actor-scoped rate-limit keys (Phase 2 only — requires Redis backend first) |
| `sensitiveAnnotationCoverage` | Files in sensitive path patterns missing `ADR-006 classification:` annotation                                         |
| `deleteMethodSemanticsDrift`  | DELETE handlers parsing body versions without exception allowlist entry                                               |
| `additionalContextInLogs`     | Logger calls with opaque `additionalContext`, `extra`, `metadata`, or `context` payload bags                          |
| `idempotencyCompletionSafety` | `IdempotencyService.complete(` calls in high-risk route files not wrapped in try-catch                                |

### 11.3 Required new test suites

**Pre-existing suite repair:**

- `__tests__/actions/tier3-high-value-guard-policy.test.ts` — replace
  `updateClerkOnboardingMetadata` assertion with `finalizeClerkOnboardingTransition`;
  update to consume shared registry

**Redis rate-limit backend (Phase 1):**

- `__tests__/lib/rate-limit-redis.test.ts`
  - Sliding window correctly counts across multiple calls within window
  - Window reset returns full limit after expiry
  - Actor-scoped key is distinct from IP-scoped key for same operation

**Verification route write-auth regressions:**

- `__tests__/api/professional-portal/certificates/certificates-write-auth.test.ts`
  - Stale session (`auth_time` > `maxAgeSeconds` ago) returns `401` before
    domain handler is called
  - Valid session proceeds to idempotency and domain call
  - `BYPASS_AUTH` must be unset in this test environment
  - Actor-scoped rate-limit key is used, not IP-based key (Phase 2)
- `__tests__/api/professional-portal/documents/documents-write-auth.test.ts` — same
- `__tests__/api/professional-portal/licenses/licenses-write-auth.test.ts` — same

**CSRF coverage for verification family:**

- `__tests__/api/professional-portal/certificates/certificates-csrf.test.ts`
  - Cross-site POST/PATCH/DELETE returns `403` without reaching idempotency
    or domain layer
  - Same-origin request proceeds normally
- Equivalent for documents and licenses

**IDOR policy matrix:**

- `__tests__/policy/{domain}.policy.test.ts` for each domain family in Section 5.2
- Each file must include: owner, non-owner, cross-role, admin override, and
  absence-of-admin-override for non-admin elevated roles
- `__tests__/policy/INTENTIONAL_DISCLOSURE_EXCEPTIONS.md` created alongside
  the first policy file

**Verification status transition policy:**

- `__tests__/policy/professional/verification-status-transition.policy.test.ts`
  - Asserts Clerk metadata update path is called when verification status changes
  - Asserts success response is not finalized before metadata update is confirmed

**Idempotency `complete()` safety:**

- `__tests__/lib/idempotency-complete-safety.test.ts`
  - `complete()` does not throw for expected DTO shapes in each verification scope
    (`certificate`, `professional_document`, `professional_license`)
  - `complete()` throws as expected for a DTO containing a Class A field name
  - Route handler try-catch correctly marks key failed and returns success response
    when `complete()` throws

**Cookie helper:**

- `__tests__/lib/cookies.test.ts`
  - `writeFunctionalCookie` produces `SameSite=Lax`, `Path=/`, conditional `Secure`
  - `writeAuthAdjacentCookie` produces `SameSite=Strict`, `Path=/`, conditional `Secure`
  - Neither mode produces `SameSite=None` without explicit override

**DELETE method semantics:**

- `__tests__/api/properties/delete-item-semantics.test.ts`
  - Versioned item DELETE without `If-Match` returns `428`
  - Body `version` field is ignored when `If-Match` is absent
  - Properties document collection shim is the only exception

**Documents GET error message:**

- `__tests__/api/professional-portal/documents/documents-get-error-message.test.ts`
  - GET handler returns static `"Forbidden"` string on non-ok domain result,
    not domain `message` text

**Compliance audit action correctness:**

- `__tests__/api/professional-portal/certificates/certificates-audit-action.test.ts`
  - DELETE handler logs a deletion-specific `AuditAction`, not `PROFILE_UPDATED`

### 11.4 Retained suites that must stay green throughout

- `pnpm -C apps/client run report-security-drift:strict`
- `__tests__/lib/api-middleware.test.ts`
- `__tests__/lib/storage-config.test.ts`
- Existing escrow route suites
- Existing onboarding action suites

---

## 12. Audit Status Transitions

Flip status only after runtime code, focused tests, strict drift output, and
docs all align. Partial evidence does not warrant a status flip.

| Item        | Current      | Target       | Preconditions                                                                                                                             |
| ----------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GAP-004`   | `Open`       | `Closed`     | All registry routes have `recentAuth: { maxAgeSeconds }` with correct values; verification routes tested; dev-bypass exclusion documented |
| `GAP-005`   | `Open`       | `Closed`     | Cookie helper shipped; all direct writes migrated and classified; Clerk checklist added to ADR-001                                        |
| `GAP-006`   | `Strengthen` | `Strengthen` | Verification status transition freshness added; broader role-transition pass is a separate follow-up                                      |
| `GAP-007`   | `Open`       | `Closed`     | All domain families have policy suites; exception manifest created; admin override paths covered                                          |
| `GAP-013`   | `Open`       | `Closed`     | Annotation convention documented; priority surfaces annotated; forward-looking drift check at zero                                        |
| `GAP-015`   | `Open`       | `Closed`     | Redis-backed rate-limit backend shipped (Phase 1) AND actor-scoped keys applied across registry (Phase 2); drift check at zero            |
| `GAP-016`   | `Open`       | `Strengthen` | All verification adapter sequencing rules added; onboarding evidence repaired; Clerk freshness gap tracked separately                     |
| `GAP-017`   | `Open`       | `Closed`     | Body-version DELETE fallbacks removed; exception allowlist created; DELETE semantics drift check at zero                                  |
| `ADD-001`   | `Strengthen` | `Strengthen` | Verification route CSRF test coverage added; no CSRF exemptions on registry routes without documented justification                       |
| `ADD-003`   | `Closed`     | Re-evaluate  | Requires per-callsite allowlist fix (Section 0.3) before `Closed` stands                                                                  |
| `DRIFT-001` | `Drift`      | `Drift`      | Requires spread-review gate fix (Section 0.2) before status can improve                                                                   |

---

## 13. Assumptions and Defaults

- Scope is `apps/client` plus audit-named instruction and ADR surfaces. No
  `apps/admin`, review-service, or infrastructure changes are in scope.
- `GAP-014` is intentionally excluded — not open in the current audit table.
- `GAP-006` non-verification flows are explicitly deferred. Verification status
  transition freshness (Section 2.3) is the only in-scope portion.
- `GAP-015` is explicitly sequenced: Phase 1 (Redis backend) must land before
  Phase 2 (actor-scoped keys). The actor-scoped drift check must not be added
  before Phase 1 is complete, as it would be testing against an in-memory
  store that provides no production guarantees.
- For `GAP-005`, Clerk session-cookie governance closes through a repo-local
  checklist artifact and `withAuth` configuration review, not brittle CI that
  depends on external Clerk state.
- Chosen compatibility mode for `GAP-017` is hybrid: tighten versioned item
  DELETE semantics now, retain only the properties document collection shim
  with a documented removal target.
- Registry file paths in Section 1.1 must be verified against the actual repo
  before implementation. Confirm or correct paths before committing drift rules
  that reference them.
- `IdempotencyService.complete()` error handling (Section 9.4) is a correctness
  fix that applies to any call site in the verification route family. Treat the
  longer-term refactor to `Result<void, E>` as a tracked follow-up item, not
  in-scope for this pass.
