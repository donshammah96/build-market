# Onboarding Convergence Plan — Staff Audit & Revised Implementation

**Auditor:** Staff Engineer review of original plan  
**Date:** 2026-04-14  
**Status:** Supersedes original plan. Original plan was directionally correct but missing critical immediate regressions and several design gaps that would cause the same divergence to re-emerge.

---

## Audit Findings Before Planning

The original plan correctly identified the core drift. The audit below adds findings the original plan did not capture. Any item marked **blocking** must be resolved before the phase it blocks can close.

### Finding 1 — Section 5.A Violation on All Three Active Routes (Critical)

All three API route handlers call `await IdempotencyService.complete(idempotencyKey, responseData)` without an isolated try-catch. This is the exact pattern called out in `API-TO-FRONTEND-ARCHITECTURE.md Section 5.A` as a production defect: a successful domain mutation plus Clerk finalization returns a `500` if `complete()` throws, and the idempotency key stays in `PENDING`, blocking all retries.

Affected files:

- `app/api/onboarding/route.ts` — bare `complete()` after Clerk finalization
- `app/api/onboarding/skip/route.ts` — bare `complete()` after Clerk finalization
- `app/api/onboarding/skip-professional/route.ts` — bare `complete()` after Clerk finalization

The server action `submitOnboarding` in `app/actions/onboarding.ts` already has the correct try-catch pattern (the High Fix 1 checkpoint applied it). The routes do not. **This must be fixed in Phase 0, not inside the orchestration refactor, because it is a live regression.**

### Finding 2 — Domain Message Passthrough in Skip Routes (High)

Both skip routes contain:

```ts
return apiError(result.data.message || "Skip onboarding failed", status);
```

`result.data.message` is a domain-owned string. This is the `apiError(domain.message || fallback)` pattern that `SEC-LINT-004` and `apps-client-api-adapters.instructions.md` Rule 12 prohibit regardless of variable name. It will trigger `adapterMessagePassthrough` drift. **Must be fixed in Phase 0.**

### Finding 3 — IP-Based Rate-Limit Keys on Authenticated Routes (Medium)

All three routes use `getRateLimitIdentifier(req)` (IP-derived). After `auth()` succeeds and `clerkId` is available, the correct key is actor-scoped: `getActorRateLimitIdentifier(clerkId, namespace)`. The `high-risk-registry.ts` entries for the action already require actor-scoped snippets; the route surface has no equivalent check. **Fix in Phase 0 for the routes, update registry in Phase 5.**

### Finding 4 — `additionalContext` Log Bags in Routes (Medium)

The `logOutcome` helper in all three routes passes a freeform `additionalContext` object into the logger. The `additionalContextInLogs` strict-drift category flags this pattern — it was already removed from the verification adapter family. The routes should use explicit named fields aligned to the ADR-005 contract (`domainError`, `source`, `reason`). **Fix in Phase 0 alongside the other route hardening.**

### Finding 5 — `useOnboarding.ts` Comment Drift Actively Misleads (Medium)

Line 200 of `useOnboarding.ts` contains the comment:

```ts
// Store creation is now handled within submit POST route
```

This is incorrect. The active route (`POST /api/onboarding`) calls `userProfileOnboardingService.completeOnboarding()`, which does **not** create stores or properties on the submit path. Store/property creation only exists inside the `completeProfessionalOnboarding` branch (a different domain method) and inside the dormant server action side-effect loops. The comment is the canonical signal of the divergence; it must be removed and replaced with an accurate statement once Phase 2 is complete.

### Finding 6 — Guard Policy Pointed at Dormant Surface (Medium)

`HIGH_VALUE_SERVER_ACTION_GUARD_RULES` in `high-risk-registry.ts` has entries for `submitOnboarding`, `skipOnboarding`, and `skipProfessionalOnboarding`. These entries enforce `recentAuth` and `rateLimit` on the server action. The interactive browser flow goes through the API routes (confirmed: `useOnboarding.ts` uses `onboardingClient`, an HTTP client). The routes have no registry entries and no corresponding drift check. The guard policy is therefore enforced on the surface that browsers do **not** use. **Fix in Phase 5 by adding `HIGH_VALUE_ROUTE_GUARD_RULES` entries for all three active routes.**

### Finding 7 — Duplicate Comment Headers in Route Files (Minor)

All three route files have their top-level JSDoc comment block duplicated verbatim. This is a copy-paste artifact with no functional impact but it is a code quality signal. **Fix in Phase 0 with the other route hardening.**

### Finding 8 — `result.data.message` Passthrough Inside the Server Action (Medium)

The server action `submitOnboarding` has multiple `throwActionFailure(createActionFailure(..., result.data.message ?? "...", ...))` calls. `result.data.message` is a domain-level string. While less visible than the route passthrough (actions do not expose HTTP response bodies directly), it still leaks domain text into the action result that the hook passes to `toast.error()`. Use a static map over `result.data.error` enum values instead. **Fix in Phase 3 when the action is refactored.**

### Finding 9 — Orchestration Contract Must Own Warning Results

The original plan does not address the warning-array pattern in the server action (stores/properties creation failures are non-fatal). When stores/properties move into the orchestration module's submit handler, the `WarningResult` shape must be part of the canonical output contract so both the route and the action surface it consistently to callers.

### Finding 10 — No-JS Session Persistence Needs Scope Constraint

The original plan proposes `onboarding-nojs-session.ts` without specifying what class of data may be stored there. Per ADR-006, Class A (credentials) and Class B (identity documents) fields must never go into short-lived session storage. The no-JS session may only hold Class C/D data: step index, selected role, non-sensitive profile structure fields. Document this boundary explicitly in the file.

---

## Revised Plan

### Overview

The production target remains: **one canonical behavior contract, two adapters**. The API route is the interactive browser surface. The server action is the no-JS fallback and admin remediation surface. Both call one shared orchestration module. The orchestration module owns the sequencing invariant: domain mutation → Clerk finalization → idempotency completion (fail-safe).

Store and property creation moves into the orchestration module's submit handler. It is non-fatal: the orchestration returns a `WarningResult[]` when optional resource creation fails, and both adapters surface it to callers.

---

## Phase 0 — Fix Live Regressions (No Blocking Dependencies)

**Priority: Highest. Do not begin Phase 1 until Phase 0 is verified.**

These are live regressions that exist independently of the refactor. Fixing them in Phase 0 prevents the regression from persisting through the migration window and ensures the strict drift baseline stays green.

### 0.1 — Idempotency Completion Fail-Safe on All Three Routes

In each of the three route handlers, wrap the bare `IdempotencyService.complete()` call in an isolated inner try-catch per Section 5.A:

```ts
try {
  await IdempotencyService.complete(idempotencyKey, responseData);
} catch (completionError) {
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
  logger.warn("Onboarding adapter outcome", {
    correlationId,
    operationName: OPERATION_NAME,
    httpMethod: req.method,
    routePattern: ROUTE_PATTERN,
    actorRole,
    outcome: "idempotency_complete_failed",
    httpStatus: HttpStatus.OK,
    durationMs: Date.now() - startedAt,
  });
  // Do not rethrow — domain mutation and Clerk finalization already succeeded.
}
```

Applies to: `route.ts` (POST /api/onboarding), `skip/route.ts`, `skip-professional/route.ts`.

### 0.2 — Replace Domain Message Passthrough in Skip Routes

Replace:

```ts
return apiError(result.data.message || "Skip onboarding failed", status);
```

With a static string map over `result.data.error`:

```ts
const MESSAGE_MAP: Record<string, string> = {
  conflict: "Onboarding already completed.",
  forbidden: "Forbidden.",
  not_found: "User not found.",
  invalid_state: "Invalid onboarding state.",
};
const safeMessage =
  MESSAGE_MAP[result.data.error ?? ""] ?? "Skip onboarding failed.";
return apiError(safeMessage, status);
```

Applies to: `skip/route.ts`, `skip-professional/route.ts`.

### 0.3 — Actor-Scoped Rate-Limit Keys in Routes

After `auth()` resolves and `clerkId` is confirmed, replace:

```ts
const identifier = getRateLimitIdentifier(req);
const rateLimitResult = await checkRateLimit(`onboarding-skip:${identifier}`, ...);
```

With:

```ts
const rateLimitResult = await checkRateLimit(
  getActorRateLimitIdentifier(clerkId, "onboarding-skip"),
  RateLimits.AUTH.limit,
  RateLimits.AUTH.window,
);
```

Use namespace conventions consistent with the verification adapter family:

- `/api/onboarding` → `"onboarding-submit"`
- `/api/onboarding/skip` → `"onboarding-skip-client"`
- `/api/onboarding/skip-professional` → `"onboarding-skip-professional"`

### 0.4 — Replace `additionalContext` Log Bags With Explicit Fields

Remove the `logOutcome` helper pattern that passes `additionalContext` as a freeform object. Replace with inline log calls using explicit ADR-005 fields. Example:

```ts
// Before
logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
  reason: "executor_failure",
});

// After
logger.error(
  "Onboarding adapter outcome",
  error instanceof Error ? error : new Error("..."),
  {
    correlationId,
    operationName: OPERATION_NAME,
    httpMethod: req.method,
    routePattern: ROUTE_PATTERN,
    actorRole,
    outcome: "internal_error",
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    durationMs: Date.now() - startedAt,
  },
);
```

Retain only the `domainError` optional field for domain error branches.

### 0.5 — Remove Duplicate Comment Headers

Each of the three route files has its top-of-file JSDoc comment block repeated verbatim. Remove the duplicate (the second occurrence).

### Phase 0 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/api/onboarding/ --maxWorkers=1
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict
pnpm -C apps/client exec tsc --noEmit --pretty false
```

**Exit criteria:** All three route suites green. Strict drift zero across `adapterMessagePassthrough`, `additionalContextInLogs`, `actorScopedThrottling`, `idempotencyCompletionSafety`. TypeScript clean.

**CHANGELOG categories:** `Fixed`, `Security`

---

## Phase 1 — Shared Orchestration Contract

**Depends on:** Phase 0 complete and verified.

Create the canonical shared orchestration module. This is the source-of-truth contract that both adapters will call. Nothing else must change in Phase 1 — no existing callers are migrated yet.

### 1.1 — Create `app/lib/domains/shared/onboarding-orchestration/`

**New files:**

```
app/lib/domains/shared/onboarding-orchestration/
  contracts.ts
  service.ts
  index.ts
```

#### `contracts.ts`

Define the full input/output contract. Key design decisions:

```ts
// Actor shape for Clerk-only onboarding (DB user may not exist yet)
export type OnboardingClerkActor = {
  clerkId: string;
  correlationId: string;
};

// Intent union — one type per transition, no stringly typed role dispatch
export type OnboardingIntent =
  | {
      kind: "submit";
      role: "CLIENT" | "PROFESSIONAL";
      data: ValidatedOnboardingData;
    }
  | { kind: "skip_client" }
  | { kind: "skip_professional" };

// Idempotency context passed in from the adapter layer
export type OnboardingIdempotencyContext = {
  key: string;
  scope: "onboarding";
  actorId: string;
  method: string;
};

// Warning result — non-fatal optional resource creation failures
export type OnboardingWarning = {
  resourceType: "store" | "property";
  resourceName: string;
  reason: string;
};

// Canonical output shape
export type OnboardingOrchestrationResult = {
  userId: string;
  role: "CLIENT" | "PROFESSIONAL";
  isProfileComplete: boolean;
  status: "ACTIVE" | "PENDING_VERIFICATION";
  redirectTo: string;
  warnings?: OnboardingWarning[];
};

// Domain errors the orchestration can return
export type OnboardingOrchestrationError =
  | "conflict" // already onboarded
  | "forbidden" // wrong role for intent
  | "not_found" // user not found (skip paths only)
  | "invalid_input" // validation failure
  | "invalid_state" // out-of-order transition
  | "clerk_sync_failed"; // Clerk finalization could not be confirmed
```

#### `service.ts`

Owns three responsibilities in this order — **the sequencing invariant is part of the service contract**:

1. **Domain mutation** — call the appropriate `userProfileOnboardingService` method
2. **Store/property creation** (submit intent, PROFESSIONAL role only) — iterate over `data.stores` and `data.properties`, call domain services, collect `OnboardingWarning[]` for failures (non-fatal)
3. **Clerk finalization** — call `finalizeClerkOnboardingTransition`; on failure, mark idempotency key failed and throw `OnboardingOrchestrationError("clerk_sync_failed")`
4. **Idempotency completion** — call `IdempotencyService.complete()` in an isolated try-catch per Section 5.A

The service accepts a pre-created idempotency key and idempotency context from the adapter. The adapter is responsible for the `checkOrCreate`/`pending`/`completed` guard before calling the service. This separation keeps the adapter owning HTTP/action semantics and the service owning business sequencing.

```ts
export async function executeOnboardingOrchestration(
  actor: OnboardingClerkActor,
  clerkUser: ClerkUserProfile,
  intent: OnboardingIntent,
  idempotency: OnboardingIdempotencyContext,
): Promise<Result<OnboardingOrchestrationResult, OnboardingOrchestrationError>>;
```

The `Result<T, E>` return allows adapters to map outcomes to HTTP status codes or action error codes without the service knowing about either.

#### `index.ts`

```ts
export { executeOnboardingOrchestration } from "./service";
export type {
  OnboardingClerkActor,
  OnboardingIntent,
  OnboardingIdempotencyContext,
  OnboardingOrchestrationResult,
  OnboardingOrchestrationError,
  OnboardingWarning,
} from "./contracts";
```

### 1.2 — ADR-006 Annotation

Add `// ADR-006 classification:` annotation to `contracts.ts`. The `OnboardingIntent` submit payload processes Class B fields (name, business registration, license numbers). The orchestration result is Class C/D only (userId, role, status, redirectTo). Annotate both.

### 1.3 — Unit Tests for Orchestration Contract

Create `__tests__/lib/domains/onboarding-orchestration.contract.test.ts`:

- Submit CLIENT intent → correct domain call, no store/property creation, correct Clerk metadata
- Submit PROFESSIONAL intent with stores → correct domain call, store creation attempted, warnings collected on failure
- Submit PROFESSIONAL intent with properties → property creation attempted, warnings collected on failure
- Skip client intent → correct domain call, correct Clerk metadata
- Skip professional intent → correct domain call, correct Clerk metadata
- Domain failure → idempotency key marked failed, orchestration returns structured error
- Clerk finalization failure → idempotency key marked failed, `clerk_sync_failed` returned
- `IdempotencyService.complete()` throws → success result still returned (Section 5.A)

### Phase 1 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/lib/domains/onboarding-orchestration.contract.test.ts --maxWorkers=1
pnpm -C apps/client exec tsc --noEmit --pretty false
```

**CHANGELOG categories:** `Added`

---

## Phase 2 — API Route Convergence

**Depends on:** Phase 1 complete and verified.

Refactor the three active API route handlers to call `executeOnboardingOrchestration` exclusively. After this phase, the route handlers contain no business logic and no domain service calls other than the shared orchestration entry point.

### 2.1 — Refactor `app/api/onboarding/route.ts`

Replace the inline domain call + stores/properties loops with:

```ts
const result = await executeOnboardingOrchestration(
  { clerkId, correlationId },
  clerkUserData,
  { kind: "submit", role: resolvedActorRole, data: validatedData },
  {
    key: idempotencyKey,
    scope: "onboarding",
    actorId: clerkId,
    method: "POST",
  },
);
```

Map `OnboardingOrchestrationError` to HTTP status codes in the route. The route is now responsible only for auth, rate-limiting, body size, Zod validation, idempotency `checkOrCreate`/`pending`/`completed` guard, and response mapping.

The `warnings` array in `OnboardingOrchestrationResult` is passed through in the response body so the client hook can surface non-fatal store/property failures to the user via toast.

### 2.2 — Refactor `app/api/onboarding/skip/route.ts`

```ts
const result = await executeOnboardingOrchestration(
  { clerkId, correlationId },
  clerkUserData,
  { kind: "skip_client" },
  {
    key: idempotencyKey,
    scope: "onboarding",
    actorId: clerkId,
    method: "POST",
  },
);
```

### 2.3 — Refactor `app/api/onboarding/skip-professional/route.ts`

```ts
const result = await executeOnboardingOrchestration(
  { clerkId, correlationId },
  clerkUserData,
  { kind: "skip_professional" },
  {
    key: idempotencyKey,
    scope: "onboarding",
    actorId: clerkId,
    method: "POST",
  },
);
```

### 2.4 — Remove Store/Property Side-Effects From Domain `completeOnboarding`

The domain method `userProfileOnboardingService.completeOnboarding` currently calls store and property creation only inside the server action path. After Phase 2, these calls live exclusively in the orchestration service's submit handler. Audit `completeOnboarding` and remove any store/property creation that was moved. The method should do exactly: upsert user, upsert profile, handle documents, create consent records, sync completion status.

### 2.5 — Update `useOnboarding.ts` Comment

Remove the inaccurate comment at line 200:

```ts
// Store creation is now handled within submit POST route  ← delete
```

Replace with:

```ts
// Store and property creation is handled by the shared orchestration module.
// Non-fatal failures are surfaced as warnings in the response.
```

### 2.6 — Add `HIGH_VALUE_ROUTE_GUARD_RULES` Entries for Active Routes

Add three entries to `high-risk-registry.ts`:

```ts
{
  file: "app/api/onboarding/route.ts",
  exportName: "POST",
  requiredAuthOptions: [],
  emptyAuthOptionsRationale:
    "AUTH-RATIONALE: Uses direct Clerk auth() because DB user may not exist yet. Actor-scoped rate limiting via clerkId.",
  requiredRecentAuthSnippets: [],
  requiredRateLimitSnippets: [
    "checkRateLimit(",
    "onboarding-submit",
    "getActorRateLimitIdentifier(",
  ],
},
{
  file: "app/api/onboarding/skip/route.ts",
  exportName: "POST",
  requiredAuthOptions: [],
  emptyAuthOptionsRationale:
    "AUTH-RATIONALE: Uses direct Clerk auth(). Actor-scoped rate limiting via clerkId.",
  requiredRateLimitSnippets: [
    "checkRateLimit(",
    "onboarding-skip-client",
    "getActorRateLimitIdentifier(",
  ],
},
{
  file: "app/api/onboarding/skip-professional/route.ts",
  exportName: "POST",
  requiredAuthOptions: [],
  emptyAuthOptionsRationale:
    "AUTH-RATIONALE: Uses direct Clerk auth(). Actor-scoped rate limiting via clerkId.",
  requiredRateLimitSnippets: [
    "checkRateLimit(",
    "onboarding-skip-professional",
    "getActorRateLimitIdentifier(",
  ],
},
```

Rebuild the generated `high-risk-registry.mjs`.

### 2.7 — Update Route Tests

The existing route tests mock `userProfileOnboardingService` directly. After Phase 2 they must mock `executeOnboardingOrchestration` from the shared module. Verify:

- Success path including `warnings` in response
- Each `OnboardingOrchestrationError` → correct HTTP status
- `clerk_sync_failed` → `503` with retry-safe message
- `additionalContext` log bag is gone (ADR-005 fields only)

### Phase 2 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/api/onboarding/ --maxWorkers=1
pnpm -C apps/client run build:high-risk-registry
pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict
pnpm -C apps/client exec tsc --noEmit --pretty false
```

**CHANGELOG categories:** `Changed`, `Security`

---

## Phase 3 — Server Action No-JS Purpose

**Depends on:** Phase 2 complete and verified. Parallelizable with Phase 4 once Phase 2 is done.

The server action `onboarding.ts` currently has stores/properties side-effect loops that are now dead code (Phase 2 moved them to orchestration). Phase 3 gives the server action a real, durable purpose: no-JS fallback form handling and a thin adapter surface for admin-triggered remediation calls.

### 3.1 — Refactor `app/actions/onboarding.ts`

Remove the stores/properties loops entirely. Replace the inline domain calls with `executeOnboardingOrchestration`. The action becomes a thin adapter:

```ts
export async function submitOnboarding(data: unknown): Promise<ActionResult<OnboardingOrchestrationResult>> {
  return secureAction({
    operationName: "submit_onboarding_server_action",
    requireActor: false,
    input: data,
    schema: OnboardingSchema,
    recentAuth: { maxAgeSeconds: ONBOARDING_RECENT_AUTH_MAX_AGE_SECONDS },
    rateLimit: { key: ..., limit: ..., windowMs: ... },
    handler: async ({ input }) => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();
      const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", { domain: "onboarding", role: normalizedRole });
      // checkOrCreate / pending / completed guard
      const result = await executeOnboardingOrchestration(
        { clerkId, correlationId: randomUUID() },
        clerkUser,
        { kind: "submit", role: normalizedRole, data: input },
        { key: idempotencyKey, scope: "onboarding", actorId: clerkId, method: "POST" },
      );
      if (!result.ok) {
        throwActionFailure(createActionFailure(mapOrchestrationErrorToActionCode(result.error), ...));
      }
      return result.data;
    },
  });
}
```

Replace all `result.data.message ??` passthrough with a static `mapOrchestrationErrorToActionCode` helper. This addresses Finding 8.

Apply the same pattern to `skipOnboarding` and `skipProfessionalOnboarding`.

### 3.2 — No-JS Fallback Route Family

Add server-rendered form pages. These are only reached when JavaScript is unavailable or disabled. The JS-enabled flow continues through `useOnboarding` → `onboardingClient` (HTTP) unchanged.

**New files:**

```
app/onboarding/no-js/page.tsx                          ← role selection form
app/onboarding/no-js/client/page.tsx                   ← client profile form
app/onboarding/no-js/professional/page.tsx             ← professional profile form
app/onboarding/no-js/review/page.tsx                   ← review + submit
app/onboarding/no-js/_components/NoJsClientForm.tsx
app/onboarding/no-js/_components/NoJsProfessionalForm.tsx
app/onboarding/no-js/_components/NoJsReview.tsx
```

Each page renders a native `<form>` with `action={serverAction}`. Submitting calls the corresponding server action. On success, redirect to the appropriate dashboard using `redirect()`.

### 3.3 — No-JS Step Session

```typescript
app / lib / infrastructure / onboarding - nojs - session.ts;
```

Short-lived signed cookie session (1-hour TTL) for multi-step state across no-JS form submissions. **ADR-006 scope constraint must be documented in the file header:**

```ts
/**
 * No-JS onboarding step session.
 *
 * ADR-006: This session may only store Class C and Class D data.
 * Prohibited: national ID, passport numbers, license numbers, email, phone
 *   (Class A and Class B — see ADR-006).
 * Permitted: step index, selected role, non-sensitive profile structure fields
 *   (companyName, county, city, profession enum, years of experience).
 *
 * Clerk-side session (via `auth()`) provides identity. This session provides
 * only onboarding step continuity.
 */
```

Use a signed, HttpOnly, SameSite=Strict cookie. Do not use `sessionStorage` or `localStorage` (no browser JS available for this path by definition).

### 3.4 — Add Fallback Routing Hint to JS Onboarding Page

In `app/onboarding/page.tsx` (the JS flow), add a `<noscript>` tag pointing to `/onboarding/no-js`:

```tsx
<noscript>
  <meta httpEquiv="refresh" content="0; url=/onboarding/no-js" />
  <p>
    JavaScript is required for this page.{" "}
    <a href="/onboarding/no-js">Continue without JavaScript.</a>
  </p>
</noscript>
```

### 3.5 — Remove Dead Side-Effect Code From Action

After the action is refactored to call `executeOnboardingOrchestration`, the following are dead:

- `toCreateStoreInput` helper function
- `toCreatePropertyInput` helper function
- All direct imports of `storesService`, `propertiesService`, `CreateStoreInput`, `CreatePropertyInput`

Remove them. If they are needed elsewhere they already exist in the orchestration module.

### Phase 3 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/actions/onboarding-tier3-guards.test.ts __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict
pnpm -C apps/client exec tsc --noEmit --pretty false
```

**CHANGELOG categories:** `Changed`, `Added`

---

## Phase 4 — Internal/Admin Remediation Workflows

**Depends on:** Phase 2 complete. Parallelizable with Phase 3.

Production deployments accumulate a class of stuck onboarding records: DB `isOnboarded=true` but Clerk metadata stale, or idempotency keys stuck in `PENDING`. These require an operator-triggered remediation path. Phase 4 delivers it.

### 4.1 — Remediation Domain Service

```
app/lib/domains/user-profile/remediation.ts
```

Three methods:

- `reconcileOnboardingState(actor, userId)` — reads DB state and Clerk metadata, identifies divergence, returns a structured `ReconciliationReport` without mutating anything
- `syncClerkMetadata(actor, userId)` — forces a Clerk metadata update from authoritative DB state; uses `finalizeClerkOnboardingTransition`
- `reconcileIdempotencyKey(actor, key)` — marks a stuck `PENDING` key as `FAILED` so retries are unblocked; requires confirmation that the domain mutation did not succeed (checked against DB state)

All three accept a full `AdminActor` (non-null `adminRole`) and return `Result<T, RemediationError>`.

### 4.2 — Internal API Endpoints

```ts
app / api / internal / onboarding - remediation / reconcile / route.ts;
app / api / internal / onboarding - remediation / clerk - sync / route.ts;
app / api / internal / onboarding -
  remediation / idempotency -
  reconcile / route.ts;
```

All three use the existing internal secret gate pattern (`internal-secret.ts`). They do not use `withAuth` — they are service-to-service endpoints authenticated by `INTERNAL_API_SECRET`. Add `withAuth` guard for any endpoint where a human operator calls directly from the browser (use `withAdminRole(["SUPER_ADMIN"])`).

Each endpoint emits structured ADR-005 logs with `operationName` in the `<verb>_<resource>` convention:

- `reconcile_onboarding_state`
- `sync_clerk_metadata`
- `reconcile_idempotency_key`

### 4.3 — Admin Action Workflow

```ts
apps / admin / src / actions / admin / onboarding - remediation.ts;
```

Three server actions mirroring the three internal endpoints, calling `callClientApi` with the existing pattern from `shared.ts`. Gate via `safeAction("onboardingRemediation", ...)`.

Extend `ADMIN_ACTION_POLICY_MAP` in `authorization-policy.ts`:

```ts
onboardingReconcile:    { allowedRoles: ["admin"], risk: "high" },
onboardingClerkSync:    { allowedRoles: ["admin"], risk: "high" },
onboardingIdempotencyReconcile: { allowedRoles: ["admin"], risk: "high" },
```

Extend `index.ts` exports.

Add tests:

```ts
apps / admin / src / actions / admin / tests / onboarding - remediation.test.ts;
```

### 4.4 — Internal Endpoint Tests

```ts
apps/client/**tests**/api/internal/onboarding-remediation.route.test.ts
```

Cover:

- Missing secret → 401
- Wrong secret → 401
- `reconcileOnboardingState` success and error mapping
- `syncClerkMetadata` success (Clerk sync confirmed) and failure (Clerk sync failed → 503)
- `reconcileIdempotencyKey` success (key marked failed) and pre-condition failure (mutation confirmed succeeded → 409)

### Phase 4 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/api/internal/onboarding-remediation.route.test.ts --maxWorkers=1
pnpm run admin:check-types
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict
```

**CHANGELOG categories:** `Added`, `Security`

---

## Phase 5 — Guard/Policy Drift Fixes and Registry Rebalancing

**Depends on:** Phases 2, 3, and 4 complete.

### 5.1 — Rebalance `HIGH_VALUE_SERVER_ACTION_GUARD_RULES`

The action entries added in Phase 0 of the original work pointed the guard policy at the dormant surface. After Phase 3 the action is a legitimate no-JS fallback adapter, so the entries remain correct. **Verify** that the `requiredRateLimitSnippets` still match the refactored action body (the key functions changed form). Update snippets if needed.

### 5.2 — Confirm Route Guard Coverage

The three new `HIGH_VALUE_ROUTE_GUARD_RULES` entries from Phase 2.6 should now be verified by the drift report. Run strict drift and confirm `highValueRouteGuards` finds zero findings for the three onboarding routes.

### 5.3 — Rebuild Registry

```bash
pnpm -C apps/client run build:high-risk-registry
```

Verify the generated `high-risk-registry.mjs` contains all new route entries.

### 5.4 — Policy Test Coverage for Routes

Add `__tests__/api/onboarding/onboarding-route-guard-and-sequencing.test.ts`:

- Submit route: domain called before Clerk finalization before idempotency complete (sequencing test)
- Skip routes: same sequencing
- Submit route: `IdempotencyService.complete()` throws → route still returns 200 (Section 5.A regression)
- Actor-scoped rate-limit keys assert `getActorRateLimitIdentifier(clerkId, ...)` is called (not IP key)
- `apiError()` first argument for all error branches is a static string, not `result.error.message` (SEC-LINT-004 regression)

### 5.5 — Intent Mismatch Comment Cleanup

Verify `useOnboarding.ts` comment from Phase 2.5 is accurate. Remove any remaining `// Store creation is now handled...` remnants.

### Phase 5 Verification

```bash
pnpm -C apps/client exec vitest run __tests__/api/onboarding/ --maxWorkers=1
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict
pnpm -C apps/client exec tsc --noEmit --pretty false
```

**CHANGELOG categories:** `Security`, `Docs`

---

## Phase 6 — Production Validation

**Depends on:** All previous phases complete.

### 6.1 — Full Suite Run

```bash
# All onboarding-adjacent suites
pnpm -C apps/client exec vitest run \
  __tests__/api/onboarding/ \
  __tests__/actions/onboarding-tier3-guards.test.ts \
  __tests__/actions/tier3-high-value-guard-policy.test.ts \
  __tests__/lib/domains/onboarding-orchestration.contract.test.ts \
  __tests__/api/internal/onboarding-remediation.route.test.ts \
  --maxWorkers=1

# Strict drift
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict

# Type check
pnpm -C apps/client exec tsc --noEmit --pretty false

# Admin type check
pnpm run admin:check-types
```

**Exit criteria:** All suites green. Strict drift zero. Both typechecks clean.

### 6.2 — Drift Category Coverage Checklist

Confirm the following drift categories report zero findings after Phase 6:

| Category                           | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| `adapterMessagePassthrough`        | Phase 0.2 fixed skip routes; Phase 3.1 fixed action |
| `additionalContextInLogs`          | Phase 0.4 replaced log bags                         |
| `actorScopedThrottling`            | Phase 0.3 added actor keys to routes                |
| `idempotencyCompletionSafety`      | Phase 0.1 added try-catch to routes                 |
| `highValueServerActionGuards`      | Action registry entries remain valid                |
| `highValueRouteGuards`             | Phase 2.6 added route registry entries              |
| `criticalTransitionStepSequencing` | Orchestration module owns sequence; routes call it  |
| `sensitiveAnnotationCoverage`      | Phase 1.2 added ADR-006 annotation                  |

### 6.3 — CHANGELOG Entry

One entry per phase, minimum. The Phase 0 entry must be a `Security` entry citing the specific ASVS controls addressed (`V11.1.4` for idempotency replay safety, `V7.4.1` for safe client error messages).

### 6.4 — Operator Execution Runbook (Exact Commands)

Use this runbook to capture the final Phase 6 evidence bundle with deterministic artifact paths.

```powershell
Set-Location C:\Users\User\build-market

New-Item -ItemType Directory -Force -Path "apps/client/tmp/phase6-evidence" | Out-Null

# 1) Baseline validation gates
pnpm -C apps/client exec vitest run __tests__/api/onboarding/ __tests__/actions/onboarding-tier3-guards.test.ts __tests__/actions/tier3-high-value-guard-policy.test.ts __tests__/lib/domains/onboarding-orchestration.contract.test.ts __tests__/api/internal/onboarding-remediation.route.test.ts --maxWorkers=1 | Tee-Object "apps/client/tmp/phase6-evidence/onboarding-validation-vitest.txt"
pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict | Tee-Object "apps/client/tmp/phase6-evidence/onboarding-validation-drift.txt"
pnpm -C apps/client exec tsc --noEmit --pretty false | Tee-Object "apps/client/tmp/phase6-evidence/onboarding-validation-client-tsc.txt"
pnpm run admin:check-types | Tee-Object "apps/client/tmp/phase6-evidence/onboarding-validation-admin-tsc.txt"

# 2) Mutation telemetry health reports (provide actual NDJSON exports per window)
pnpm -C apps/client exec node scripts/summarize-project-mutation-health.mjs --input "tmp/phase6-evidence/staging-canary.ndjson" --json | Tee-Object "apps/client/tmp/phase6-evidence/staging-canary-health.json"
pnpm -C apps/client exec node scripts/summarize-project-mutation-health.mjs --input "tmp/phase6-evidence/staging-broad.ndjson" --json | Tee-Object "apps/client/tmp/phase6-evidence/staging-broad-health.json"
pnpm -C apps/client exec node scripts/summarize-project-mutation-health.mjs --input "tmp/phase6-evidence/production-canary.ndjson" --json | Tee-Object "apps/client/tmp/phase6-evidence/production-canary-health.json"
pnpm -C apps/client exec node scripts/summarize-project-mutation-health.mjs --input "tmp/phase6-evidence/production-broad.ndjson" --json | Tee-Object "apps/client/tmp/phase6-evidence/production-broad-health.json"

# 3) Human-readable summaries for each telemetry window
node apps/client/scripts/summarize-project-mutation-health.mjs --input "apps/client/tmp/phase6-evidence/staging-canary.ndjson" | Tee-Object "apps/client/tmp/phase6-evidence/staging-canary-summary.txt"
node apps/client/scripts/summarize-project-mutation-health.mjs --input "apps/client/tmp/phase6-evidence/staging-broad.ndjson" | Tee-Object "apps/client/tmp/phase6-evidence/staging-broad-summary.txt"
node apps/client/scripts/summarize-project-mutation-health.mjs --input "apps/client/tmp/phase6-evidence/production-canary.ndjson" | Tee-Object "apps/client/tmp/phase6-evidence/production-canary-summary.txt"
node apps/client/scripts/summarize-project-mutation-health.mjs --input "apps/client/tmp/phase6-evidence/production-broad.ndjson" | Tee-Object "apps/client/tmp/phase6-evidence/production-broad-summary.txt"
```

Deterministic wrapper alternative for strict drift evidence capture:

```powershell
.\scripts\invoke-clean.ps1 -WorkingDirectory . -OutputPath "tmp-phase6-drift.txt" -CommandLine "pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict"
```

Required evidence bundle before marking Phase 6 complete:

1. `onboarding-validation-vitest.txt`, `onboarding-validation-drift.txt`, and both typecheck outputs are present in `apps/client/tmp/phase6-evidence`.
2. Staging and production telemetry windows each have both `*-health.json` and `*-summary.txt` outputs.
3. Strict drift categories remain zero and no validation gate command exits non-zero.
4. Phase 6 completion checkpoint is recorded in both `apps/client/docs/CHANGELOG.md` and `apps/client/docs/PROGRESS-SUMMARY.md` with links to captured artifacts.

---

## Complete File Impact Register

### Existing Files Modified

| File                                                   | Phases | Change Summary                                                            |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| `app/api/onboarding/route.ts`                          | 0, 2   | Idempotency fail-safe, log bags, call orchestration                       |
| `app/api/onboarding/skip/route.ts`                     | 0, 2   | Idempotency fail-safe, message passthrough, actor key, call orchestration |
| `app/api/onboarding/skip-professional/route.ts`        | 0, 2   | Same as skip                                                              |
| `app/actions/onboarding.ts`                            | 3      | Remove side-effects, call orchestration, static error map                 |
| `app/lib/domains/user-profile/onboarding.ts`           | 2      | Remove store/property creation from `completeOnboarding`                  |
| `app/lib/security/high-risk-registry.ts`               | 2, 5   | Add route entries, verify action entries                                  |
| `app/lib/security/high-risk-registry.mjs` (generated)  | 2, 5   | Rebuilt from source                                                       |
| `app/onboarding/page.tsx`                              | 3      | Add `<noscript>` fallback routing hint                                    |
| `app/onboarding/_hooks/useOnboarding.ts`               | 2      | Replace inaccurate comment                                                |
| `apps/admin/src/actions/admin/authorization-policy.ts` | 4      | Add remediation action policy entries                                     |
| `apps/admin/src/actions/admin/index.ts`                | 4      | Export remediation actions                                                |

### New Files Added

| File                                                                     | Phase | Purpose                                                                        |
| ------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------ |
| `app/lib/domains/shared/onboarding-orchestration/contracts.ts`           | 1     | Canonical intent/result types                                                  |
| `app/lib/domains/shared/onboarding-orchestration/service.ts`             | 1     | Sequencing owner                                                               |
| `app/lib/domains/shared/onboarding-orchestration/index.ts`               | 1     | Public surface                                                                 |
| `app/lib/auth/recent-auth.ts`                                            | 1     | Shared recent-auth helper (de-duplicate from api-middleware and secure-action) |
| `app/onboarding/no-js/page.tsx`                                          | 3     | No-JS role selection                                                           |
| `app/onboarding/no-js/client/page.tsx`                                   | 3     | No-JS client form                                                              |
| `app/onboarding/no-js/professional/page.tsx`                             | 3     | No-JS professional form                                                        |
| `app/onboarding/no-js/review/page.tsx`                                   | 3     | No-JS review + submit                                                          |
| `app/onboarding/no-js/_components/NoJsClientForm.tsx`                    | 3     | Server-rendered client form                                                    |
| `app/onboarding/no-js/_components/NoJsProfessionalForm.tsx`              | 3     | Server-rendered professional form                                              |
| `app/onboarding/no-js/_components/NoJsReview.tsx`                        | 3     | Server-rendered review                                                         |
| `app/lib/infrastructure/onboarding-nojs-session.ts`                      | 3     | Signed cookie step session (ADR-006 scoped)                                    |
| `app/lib/domains/user-profile/remediation.ts`                            | 4     | Reconcile/sync domain service                                                  |
| `app/api/internal/onboarding-remediation/reconcile/route.ts`             | 4     | Internal reconcile endpoint                                                    |
| `app/api/internal/onboarding-remediation/clerk-sync/route.ts`            | 4     | Internal Clerk sync endpoint                                                   |
| `app/api/internal/onboarding-remediation/idempotency-reconcile/route.ts` | 4     | Internal idempotency reconcile endpoint                                        |
| `apps/admin/src/actions/admin/onboarding-remediation.ts`                 | 4     | Admin remediation actions                                                      |
| `apps/admin/src/actions/admin/tests/onboarding-remediation.test.ts`      | 4     | Admin action tests                                                             |
| `__tests__/lib/domains/onboarding-orchestration.contract.test.ts`        | 1     | Orchestration contract tests                                                   |
| `__tests__/api/onboarding/onboarding-route-guard-and-sequencing.test.ts` | 5     | Route guard/sequence tests                                                     |
| `__tests__/actions/onboarding-nojs-form-actions.test.ts`                 | 3     | No-JS action tests                                                             |
| `__tests__/api/internal/onboarding-remediation.route.test.ts`            | 4     | Internal endpoint tests                                                        |

---

## Key Design Decisions and Rationale

### Decision: Orchestration owns sequencing, adapter owns admission

The adapter (route or action) is responsible for the `checkOrCreate`/`pending`/`completed` idempotency guard and for surfacing `clerk_sync_failed` as a retryable error. The orchestration service is responsible for the mutation → Clerk finalization → idempotency completion sequence. This boundary prevents the adapter from ever partially owning the sequence, which is the root cause of the original divergence.

### Decision: `OnboardingOrchestrationError` is an enum union, not a free string

Both the route (mapping to HTTP status) and the action (mapping to `ActionErrorCode`) need to branch on the error type. A union of known strings enables exhaustiveness checking at both call sites and prevents new error types from being silently swallowed.

### Decision: Warnings are in the result, not logged only

The `warnings` array in `OnboardingOrchestrationResult` allows the HTTP caller to return them in the response body so `useOnboarding.ts` can toast them. The action caller can include them in the `ActionResult.data`. Logging only would mean the user never sees the "store creation failed" message. Both the log event and the response payload carry warnings.

### Decision: No-JS forms call the server actions, not the routes directly

Server actions are the correct adapter for `<form action={serverAction}>` in Next.js App Router. The routes are the correct adapter for `fetch()`-based JS clients. This gives each adapter a single, clear owner and keeps the no-JS path fully server-rendered without any JS dependency.

### Decision: Remediation endpoints use internal secret gate, not user auth

Remediation is an operator workflow, not a user workflow. The internal secret gate (`INTERNAL_API_SECRET`) is the correct control for service-to-service and operator-tooling calls. The admin UI calls these endpoints through the admin action layer, which already enforces `safeAction` + `SUPER_ADMIN` role gating.

---

## Non-Goals

The following are explicitly out of scope for this plan:

- Changing the Zod schema definitions in `@build/types` — validation schemas are consumed, not owned, by the onboarding surface
- Adding real-time onboarding progress tracking — a future feature concern
- Migrating the upload staging endpoint — it already follows the correct thin-adapter pattern and does not have the divergence issues this plan addresses
- Changing Clerk-side webhook handlers — the Clerk webhook is a separate surface governed by `ADR-008` and the existing webhook integrity controls
