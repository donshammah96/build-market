# Staging E2E — Staff Autopsy v2 and Hardening Plan

**Date:** 2026-09-16
**Supersedes:** `STAGING_E2E_STAFF_AUTOPSY.md` (v1) — corrections to v1 are listed in §2.
**Revision:** v2.1 — incorporates `app/api/internal/test-control/route.ts` and `app/api/health/route.ts` (previously unreviewed), and the three answers in §11.
**Scope:** `.github/workflows/staging-e2e.yml`, `scripts/preflight-staging-db-check.mjs`, `scripts/emergency-staging-cleanup.mjs`, `apps/client/middleware.ts` + `app/lib/security/middleware/*`, `app/lib/security/internal-secret.ts`, `app/lib/capabilities/boundary.ts`, `app/sign-in/[[...sign-in]]/page.tsx`, `components/auth/ClerkSignInWidget.tsx`, `app/lib/domains/testing/test-control/*`, `app/api/internal/test-control/route.ts`, `app/api/health/route.ts`, `cypress.config.ts`, `cypress/support/*`, `cypress/e2e/staging/01–08`.

---

## 1. Executive summary

The suite fails for **three independent reasons**, only one of which v1 identified correctly.

| #     | Layer               | Status                                                                                           | One-line cause                                                                                                                                                                                                                                        |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Auth/navigation     | **Confirmed by inspection (H-1 + Edge env inlining breakdown), pending Gate 0 Edge observation** | Edge `auth().userId` is `null` while Node `auth().userId` is set for the same cookie jar. `getStringEnv` dynamic lookup defeats static inlining for the Edge bundle.                                                                                  |
| **B** | Loop amplification  | **Proven from code (C-1, C-2)**                                                                  | `/sign-in` server component redirects on `userId` **unconditionally**, including when a `__clerk_ticket` is present, and nothing anywhere counts bounces. A single failed Edge auth therefore becomes an unbounded loop instead of a one-hop failure. |
| **C** | Harness correctness | **Proven from code (C-3 … C-12)**                                                                | The harness has ownership, isolation, ordering, cleanup-safety and secret-plumbing defects that will keep producing red builds _after_ A and B are fixed.                                                                                             |

**The most important structural point:** the system currently has **no bounded failure mode for an auth mismatch**. Every layer — middleware, sign-in page, Cypress `visit`, Cypress retries, the workflow — amplifies rather than bounds it. One `null` userId at the Edge produces 20 redirects × 3 attempts × 8 specs ≈ 12 wasted CI minutes and a stack trace that points at `staging-test-control.ts:165` (a `cy.location` assertion), i.e. at the **observer**, not the fault. Fixing that amplification (Phase 0/1) is worth more than fixing any single root cause, because it makes the next auth regression a 4-second, self-describing failure.

Do **Phase 0 before anything else**: it converts the loop into a diagnostic that names which of the §4 candidates is true, without further guesswork.

---

## 2. Corrections to autopsy v1

v1 is broadly right about the _shape_ of the loop, but several load-bearing claims are wrong or unverified, and acting on them wastes time.

| v1 claim                                                                                                             | Verdict                                     | Correction                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Finding 4: there is no `03-review-eligibility.cy.ts`; `03-messaging.cy.ts` collides with `06-messaging.cy.ts`."     | **Stale/incorrect**                         | `03-review-eligibility.cy.ts` exists in the reviewed tree and matches the workflow's `review-eligibility` target. No `03-messaging.cy.ts` is present. Re-verify the directory before acting; if v1 was describing a pre-rename tree, delete the finding rather than leaving a false lead in the doc.                                                           |
| "Clerk requires `__session` **and** `__client_uat`; the race is `window.location.href` firing before cookies flush." | **Plausible, unproven; listed as H-2 (§4)** | It is stated in v1 as mechanism. It is a hypothesis. The cheap discriminator is asserting `__client_uat*` presence in Cypress (C-2 patch) — if it is _present_ and Edge still says signed-out, H-2 is dead and the answer is H-1/H-3/H-4′.                                                                                                                     |
| "Root cause 1: `secretKey` removed from `clerkMiddlewareOptions`."                                                   | **Plausible, unproven; H-3**                | On Vercel, plain (non-`NEXT_PUBLIC_`) env vars _are_ available to Edge Middleware, so an unbound `CLERK_SECRET_KEY` is not the default state — it is a configuration outcome that must be observed, not assumed. Confirm via the Phase 0 diagnostic before re-adding `secretKey` (re-adding it blind is what caused `MIDDLEWARE_INVOCATION_FAILED` last time). |
| "Spec 07 fails because workers miss Cypress snapshot assertions."                                                    | **Unsupported**                             | `07` seeds through `addNotificationRetryJob` on the _deployed app's_ queue client and polls for an `outboundDeliveries` row written by the **Render worker**. If the worker isn't consuming the same queue backend the staging app enqueues to, the poll can never pass. See S-5.                                                                              |
| Alignment table: "ADR-002/ADR-003 — Aligned."                                                                        | **Not demonstrated**                        | `issueBrowserSessionHandoff` hardcodes pool emails and bypasses the lease system entirely (C-6); the projection returns raw pool emails across the task boundary that `resetIdentityBaseline` carefully redacts (C-11). Those are boundary violations inside the test-control domain itself.                                                                   |

v1 is correct and retained on: the loop's hop-by-hop shape, the webhook/BullMQ 503 anti-pattern (carried into S-5), and BullMQ v5 not supporting a Postgres backend natively.

---

## 3. Confirmed defects (provable from the reviewed code)

These require no further observation. Each is stated as _mechanism → evidence → fix_.

### C-1 — `/sign-in` pre-empts single-use ticket consumption _(Critical)_

**Mechanism.** `app/sign-in/[[...sign-in]]/page.tsx`:

```ts
const { userId } = await auth();
if (userId) {
  redirect(safeRedirectUrl ?? "/auth-callback");
}
```

This runs **before** `ClerkSignInWidget` mounts. If a session cookie already exists, the server redirects away and the `__clerk_ticket` in the URL is **never consumed** — silently, with no error. The browser keeps whatever session it already had.

**Evidence / blast radius.**

1. **It is the loop's engine.** The middleware-generated bounce URL is `/sign-in?redirect_url=%2Fonboarding` — note it carries **no ticket** (see the Cypress error string). Node `auth()` sees the session → `redirect("/onboarding")` → Edge says signed-out → back to `/sign-in`. The page has no way to notice it is being fed its own output.
2. **It silently corrupts spec 06.** `06-messaging.cy.ts` calls `loginStagingUser("CLIENT")`, then later `loginStagingUser("PROFESSIONAL")` with no cookie clear in between. The second ticket visit hits `page.tsx` with a live CLIENT session → redirect → ticket discarded → the "professional reads the thread" assertion executes **as the client**. The test either passes for the wrong reason or fails opaquely. Same pattern in `02`.

**Fix.** A ticket is an explicit instruction to change identity and must outrank an ambient session.

```ts
// app/sign-in/[[...sign-in]]/page.tsx
const ticket =
  firstParam(resolvedParams?.__clerk_ticket) ??
  firstParam(resolvedParams?.ticket);

const { userId } = await auth();

// A single-use ticket outranks an existing session: never short-circuit the
// client-side ticket exchange, or the ticket is silently discarded and the
// browser keeps the WRONG identity. See STAGING_E2E_STAFF_AUTOPSY_V2 C-1.
if (userId && !ticket) {
  redirect(safeRedirectUrl ?? "/auth-callback");
}
```

and in `ClerkSignInWidget.tsx`, sign out the stale session before exchanging the ticket:

```ts
async function processTicket() {
  try {
    if (isSignedIn) {
      await clerk.signOut({ redirectUrl: undefined }); // drop ambient identity first
    }
    const attempt = await clerk.client.signIn.create({ strategy: "ticket", ticket: ticket! });
    …
```

Note the widget's existing guard `if (… || isSignedIn || …) return;` must be relaxed accordingly — today a signed-in browser _also_ skips ticket consumption client-side, so C-1 has a second instance in the widget.

---

### C-2 — No bounce breaker anywhere in the auth path _(Critical)_

**Mechanism.** `redirect-policy.ts` has exactly one loop guard:

```ts
if (isPrimaryOrigin && req.nextUrl.pathname === CLIENT_ROUTES.signIn) {
  return NextResponse.next();
}
```

This only fires when `/sign-in` _itself_ is misrouted into `redirectToSignIn` — which the current matchers never do. For the actual observed loop (`/onboarding` ⇄ `/sign-in`, two different paths, two different runtimes) there is **no counter, no cookie, no header, no cap**. Cypress's `redirectionLimit: 20` is the only backstop in the entire system, and it is client-side and produces no server-side diagnosis.

Secondary defect on the same code path: that guard returns a bare `NextResponse.next()`, skipping `applyDocumentCspHeaders`, so the request loses its `x-nonce`. If that branch ever _does_ fire, the rendered page has no nonce and nonce-gated scripts (including Clerk's) will not execute — a stuck sign-in page with a clean 200.

**Fix.** Bounded, self-describing failure. Add to `redirect-policy.ts`:

```ts
export const AUTH_BOUNCE_COOKIE = "bm_auth_bounce";
const MAX_AUTH_BOUNCES = 2;

function readBounce(req: NextRequest): number {
  const raw = Number(req.cookies.get(AUTH_BOUNCE_COOKIE)?.value ?? "0");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** Clear the counter whenever middleware successfully ALLOWS an authenticated request. */
export function clearAuthBounce(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_BOUNCE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

function authLoopDiagnostic(req: NextRequest, count: number): NextResponse {
  const cookieNames = req.cookies.getAll().map((c) => c.name);
  const body = {
    error: "AUTH_REDIRECT_LOOP_BROKEN",
    message:
      "Edge middleware and the Node runtime disagree about this session. " +
      "The redirect loop was stopped deliberately.",
    bounces: count,
    pathname: req.nextUrl.pathname,
    // Diagnosis surface — names only, never values.
    hasSessionCookie: cookieNames.some((n) => n.startsWith("__session")),
    hasClientUatCookie: cookieNames.some((n) => n.startsWith("__client_uat")),
    hasHandshakeCookie: cookieNames.some((n) => n.includes("clerk_handshake")),
    clerkPublishableKeyFingerprint: fingerprintPublishableKey(
      env.clerk.publishableKey,
    ),
    clerkIsSatellite: Boolean(env.clerk?.isSatellite),
    clerkDomain: env.clerk?.domain ?? null,
    clerkFrontendApi: env.clerk?.frontendApi ?? null,
    docs: "docs/STAGING_E2E_STAFF_AUTOPSY_V2.md#4-the-edgenode-auth-asymmetry",
  };
  const res = NextResponse.json(body, { status: 503 });
  return clearAuthBounce(res);
}

export function redirectToSignIn(
  req: NextRequest,
  pathname?: string,
): NextResponse {
  const bounces = readBounce(req);
  if (bounces >= MAX_AUTH_BOUNCES) {
    return authLoopDiagnostic(req, bounces);
  }
  // … existing body …
  const res = NextResponse.redirect(signInUrl);
  res.cookies.set(AUTH_BOUNCE_COOKIE, String(bounces + 1), {
    path: "/",
    maxAge: 30,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });
  return res;
}
```

`fingerprintPublishableKey` must return something non-secret and comparable, e.g. `pk_test_…` prefix + the decoded FAPI host (publishable keys are base64 of `<fapi-host>$`), never the raw key.

Then in `middleware.ts`, wrap every **allow** of an authenticated request (`mw_allow_onboarding`, `mw_allow_protected`, `mw_allow_professional_pending_verification`) in `clearAuthBounce(...)`, so a healthy login resets the counter.

**Gate the JSON diagnostic to non-production** (`env.otel.ddEnv === "staging" || env.isVercelPreview || env.isDev`); in production, return the existing redirect but cap it and log at `error`.

**Effect:** the exact failure now takes one page load, returns a machine-readable cause, and — critically — the JSON body tells you _which_ of §4's candidates is true on the very first CI run.

---

### C-3 — Reviews created through production endpoints are never run-owned _(High — false failure + data leak)_

**Mechanism.** `03-review-eligibility.cy.ts` asserts:

```ts
cy.getStagingProjection().its("fixtures.reviews").should("have.length", 1);
```

`getRunProjection` resolves reviews as `prisma.review.findMany({ where: { stagingTestRunId: runId } })`. The review is created by `POST /api/reviews` — the **production** handler, which has no knowledge of `stagingTestRunId` and will never set it. So:

- the assertion can only pass by accident;
- `cleanupRun`'s `tx.review.deleteMany({ where: { stagingTestRunId: runId } })` deletes **nothing**, and the review survives every cleanup path, accumulating in staging forever;
- the same class of bug applies to anything else a spec creates through a production endpoint (leads accepted in `02` create `contactDisclosedAt` mutations on run-owned rows — fine; but any _new top-level row_ is orphaned).

Message threads happen to be safe only because the projection reads `messages` **nested under** the run-owned `MessageThread`.

**Fix.** Own by derivation, not by tag, for production-created rows.

```ts
// repository.ts — getRunProjection
const ownedProjectIds = (
  await prisma.project.findMany({
    where: { stagingTestRunId: runId },
    select: { id: true },
  })
).map((p) => p.id);

const reviews = await prisma.review.findMany({
  where: {
    OR: [
      { stagingTestRunId: runId },
      ownedProjectIds.length
        ? { projectId: { in: ownedProjectIds } }
        : { id: { in: [] } },
    ],
  },
  select: { id: true, rating: true, status: true, projectId: true },
});
```

and mirror it in `cleanupRun` **before** projects are deleted (order matters — see C-4):

```ts
const ownedProjects = await tx.project.findMany({
  where: { stagingTestRunId: runId },
  select: { id: true },
});
await tx.review.deleteMany({
  where: {
    OR: [
      { stagingTestRunId: runId },
      { projectId: { in: ownedProjects.map((p) => p.id) } },
    ],
  },
});
```

Add the same derived check to the step-9 "zero owned records remain" assertion, otherwise the guard keeps reporting clean while leaking.

---

### C-4 — `assertStagingCleanupOrder` validates a constant against itself _(Medium — safety theatre)_

**Mechanism.** `cleanupRun` calls `assertStagingCleanupOrder([...STAGING_CLEANUP_DEPENDENCY_ORDER])` — i.e. it asserts that the canonical order equals the canonical order. The **executed** order is a hand-written sequence of `deleteMany` calls immediately below, which nothing compares against the constant. The delete block is also mis-commented (two steps numbered `3`, the comment "Delete owned outbound deliveries" sits above `messageThread.deleteMany`), which is exactly the kind of drift the assertion was supposed to catch.

**Fix.** Drive the deletes from the constant so the assertion becomes load-bearing:

```ts
const DELETERS: Record<
  StagingOwnedEntity,
  (tx: Tx, runId: string) => Promise<unknown>
> = {
  MESSAGE_THREAD: (tx, id) =>
    tx.messageThread.deleteMany({ where: { stagingTestRunId: id } }),
  MARKETPLACE_LEAD: (tx, id) =>
    tx.marketplaceLead.deleteMany({ where: { stagingTestRunId: id } }),
  // …one entry per STAGING_CLEANUP_DEPENDENCY_ORDER member…
};

for (const entity of STAGING_CLEANUP_DEPENDENCY_ORDER) {
  const run = DELETERS[entity];
  if (!run)
    throw new Error(`[StagingCleanup] No deleter registered for "${entity}"`);
  await run(tx, runId);
}
```

A missing key now fails the build/test, not production data. Keep `assertStagingCleanupOrder` for the constant's internal consistency.

---

### C-5 — Cleanup can delete pool identities; nothing asserts it didn't _(High — self-inflicted outage)_

**Mechanism.** `cleanupRun` ends with `tx.user.deleteMany({ where: { stagingTestRunId: runId } })`. The comment in `seedScenario` says pool identities are "deliberately never claimed by a run" — but that is an invariant maintained by convention only. One stray `stagingTestRunId` write on `e2e_pro_1` (a future seeder, a migration backfill, a manual SQL session) silently deletes the pool user, and every subsequent run fails with `STAGING_TEST_USER_MISSING` until someone re-provisions Clerk **and** the DB by hand.

**Fix.** Make the invariant enforced, not documented:

```ts
const POOL_EMAILS = resolveConfiguredSlots().map((s) => s.email.toLowerCase());

await tx.user.deleteMany({
  where: { stagingTestRunId: runId, email: { notIn: POOL_EMAILS } },
});

// Post-condition: the pool survived.
const survivingPool = await tx.user.count({
  where: { email: { in: POOL_EMAILS } },
});
if (survivingPool !== POOL_EMAILS.length) {
  throw new Error(
    `[StagingCleanupFailure] Pool identity count is ${survivingPool}, expected ${POOL_EMAILS.length}. Refusing to commit.`,
  );
}
```

Because this runs inside the transaction, the throw rolls the whole cleanup back rather than half-deleting the pool.

---

### C-6 — `issueBrowserSessionHandoff` bypasses the lease system entirely _(High — cross-spec interference)_

**Mechanism.** `service.issueBrowserSessionHandoff` hardcodes:

```ts
const email =
  params.role === "PROFESSIONAL"
    ? "e2e_pro_1@staging.buildmarket.app"
    : "e2e_client_1@staging.buildmarket.app";
```

No lease is taken, no slot is checked, and the configured `identitySlots` are ignored. Consequences, all real today:

- Specs `02`, `03`, `06` (which use `loginStagingUser`, not `resetStagingIdentity`) always drive **slot 1**, while `01`/`08` lease a slot that may _also_ be slot 1 → a concurrent or overlapping run's `restoreClerkIdentityBaseline` **revokes the live session** of the other test mid-flight. The victim's next navigation is signed-out at the Edge → `/sign-in` → _this is indistinguishable from the §4 loop_.
- Those specs never reset the identity, so they inherit whatever onboarding/verification state the previous spec left behind → **order-dependent tests**. Running `--spec 06` alone and running it after `01` exercise different states.
- `parseStagingIdentitySlots` / `findAvailableSlotForRole` — the entire isolation design — is dead code for 3 of 8 specs.

**Fix.** One entry point. `issueBrowserSessionHandoff` should lease like `resetIdentityBaseline` does (without the destructive reset):

```ts
const lease = await identityRepository.leaseIdentity({ runId, scenario: run.scenario, role });
if (!lease) return err({ error: "IDENTITY_LEASE_EXHAUSTED", … , status: 409 });
const slot = resolveConfiguredSlots().find((s) => s.slot === lease.slot)!;
// mint the ticket for lease.clerkId, not for a hardcoded email
```

This requires relaxing `isAllowedScenarioForIdentityLease` (currently `onboarding` + `verification` only) to cover every scenario that authenticates a browser, or introducing a second, non-resetting lease kind (`BORROWED`) that the allow-list permits for all scenarios. Prefer the second: it keeps "who may be destructively reset" narrow while making "who may hold slot N" universal.

---

### C-7 — Emergency sweep will delete a _running_ test's data, and reports success when it deletes nothing _(High)_

Three separate defects in `emergency-staging-cleanup.mjs`:

**7a — the selection predicate matches live runs.**

```sql
WHERE "state" IN ('ACTIVE','CLEANING')
  AND "expiresAt" < NOW() + INTERVAL '5 minutes'
```

Runs are created with `expiresAt = now + 300s` (`lifetimeSeconds ?? 300`). So `expiresAt < NOW() + 5 minutes` is **true the instant the run is created**. This sweep deletes the fixtures of every currently-executing run — including one on a developer's laptop, or a second workflow if `concurrency` is ever relaxed. It only appears safe because the step runs after Cypress in the same job.
→ Fix: `WHERE "state" IN ('ACTIVE','CLEANING') AND "expiresAt" < NOW() - INTERVAL '1 minute'`, and additionally scope by `"workflowRunId" = $1` when `GITHUB_RUN_ID` is present, so a CI sweep can only touch its own job's runs.

**7b — table-name drift fails silently.** The raw SQL mixes `"MessageThread"`, `"MarketplaceLead"`, `"Review"`, `"Lead"`, `"Project"`, `"ProfessionalProfile"` (Prisma model names) with `"users"`, `"staging_test_runs"`, `"staging_test_identity_leases"`, `"staging_test_outbound_deliveries"` (`@@map`ped names). The presence of `"users"` proves `@@map` is in use in this schema; any other mapped model makes the corresponding `DELETE` throw `relation … does not exist`. That throw is caught by the **outer** `try` around the whole loop, logged as one line, and `main()` exits **0**. CI shows a green cleanup step while nothing was swept.
→ Fix: assert every table exists before sweeping, and fail loudly:

```js
const TABLES = ["MessageThread", "MarketplaceLead", /* … */ "users"];
const check = await client.query(
  `SELECT t AS name, to_regclass(format('%I', t)) AS oid FROM unnest($1::text[]) AS t`,
  [TABLES],
);
const missing = check.rows.filter((r) => !r.oid).map((r) => r.name);
if (missing.length) {
  throw new Error(
    `[emergency-cleanup] Unknown tables (Prisma @@map drift?): ${missing.join(", ")}`,
  );
}
```

Better still: generate the list from `prisma.dmmf` or drop the raw SQL and reuse `TestControlRepository.cleanupRun` through a small script-side Prisma client, so there is exactly one cleanup implementation.

**7c — aborted transaction returned to the pool.** `BEGIN` … many `DELETE`s … `COMMIT` sits inside the shared `try`; a failure on run _k_ skips `COMMIT`, skips `ROLLBACK`, breaks the loop for runs _k+1…n_, and `client.release()` hands a connection with an open/aborted transaction back to the pool.
→ Fix: per-run `try { BEGIN … COMMIT } catch { await client.query("ROLLBACK"); errors.push(…) }` and continue; print a summary count of successes/failures at the end.

**7d — exit code.** `process.exit(0)` on fatal error is defended as "so always() does not mask underlying failure". That is the right instinct, wrong mechanism: it also makes a _total_ cleanup failure invisible. Keep exit 0, but emit a GitHub annotation so it is visible without being fatal:

```js
if (errors.length) {
  console.log(
    `::warning title=Staging cleanup incomplete::${errors.length} run(s) failed to sweep`,
  );
}
```

---

### C-8 — Interactive transactions will time out on cold Vercel↔Supabase paths _(Medium — intermittent red)_

**Mechanism.** `restoreIdentityBaseline` executes ~10 statements and `cleanupRun` ~14 statements (plus three `count`s) inside `prisma.$transaction(async (tx) => …)`. Prisma's default interactive-transaction budget is **5 s** (`timeout`), with a 2 s `maxWait` for a connection. A cold serverless invocation + Supabase session-pooler handshake from `eu`/`us` to the DB region regularly eats 1–3 s before the first statement runs. When it blows, Prisma throws `P2028` → `RESET_IDENTITY_FAILED` (500) → the spec fails in `beforeEach` → Cypress retries → three identical failures.

This is a strong candidate for the _intermittent_ portion of the red builds, distinct from the deterministic loop.

**Fix.**

```ts
return prisma.$transaction(
  async (tx) => {
    /* … */
  },
  {
    timeout: 20_000,
    maxWait: 8_000,
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  },
);
```

Also confirm staging `DATABASE_URL` uses the **session** pooler (port 5432) as the runbook says — PgBouncer _transaction_-mode pooling and Prisma interactive transactions do not mix, and the failure mode is exactly this.

---

### C-9 — Grant/run lifetime is shorter than a retried spec _(Medium)_

`MAX_GRANT_LIFETIME_SECONDS = 300`, `signStagingGrant(…, 300)`, run `expiresAt = now + 300s`, identity lease `+300s`. The observed spec duration is **1 m 32 s per attempt × up to 3 attempts**. `beforeEach` mints a fresh run per attempt, which saves it today — but any spec whose _single attempt_ exceeds 5 minutes (the workflow allows 20) will get `RUN_NOT_ACTIVE` (400) from `getProjection`/`cleanup` and fail in `afterEach`, producing a second, misleading failure.

**Fix.** Either (a) make `lifetimeSeconds` configurable per scenario with a CI default of 900 and raise `MAX_GRANT_LIFETIME_SECONDS` in step, or (b) add an `extend-run` action to the grant action list and have `pollStagingProjection` heartbeat it. (a) is simpler and sufficient; do not exceed 15 minutes, and keep the lease at 300 s with explicit renewal so a crashed run still frees its slot quickly.

---

### C-10 — Cypress task state is process-global and fails open _(Medium)_

In `setupNodeEvents`, `activeRunId` / `activeGrantToken` are module-scope `let`s shared by **every spec in the process**. Two consequences:

- If `createRun` throws for spec _n_, the previous spec's still-valid `runId`/`grantToken` remain set, so `seedScenario`/`getProjection` for spec _n_ silently **write into and read from spec _n−1_'s run**. Assertions then compare against the wrong fixture set.
- `cypress run --parallel` or `--spec` globs executed concurrently break this outright.

**Fix.** Null both at the _start_ of `createRun` (before the fetch) and key them by `Cypress.spec.name` passed in from the command:

```ts
let active: { spec: string; runId: string; grantToken: string } | null = null;

function requireActive(spec: string) {
  if (!active || active.spec !== spec) {
    throw new Error(
      `No active staging run for spec "${spec}" (got ${active?.spec ?? "none"})`,
    );
  }
  return active;
}
```

and have `initStagingRun` pass `Cypress.spec.name` through.

---

### C-11 — Redaction boundary is inconsistent; secrets reach CI artifacts _(Medium — hygiene)_

- `stagingTestControl:resetIdentityBaseline` carefully projects only opaque fields across the task boundary ("Redacted projection"), but `stagingTestControl:getProjection` returns the raw projection — which includes `users[].email` for every run-owned user. The redaction is therefore decorative.
- `signInUrl` contains a **live single-use Clerk ticket** and is passed to `cy.visit()`, so it is rendered in the Cypress command log and captured in `screenshotOnRunFailure` screenshots, which the workflow uploads as `staging-e2e-failure-media-*` with **30-day retention** — despite the step being named "Upload **redacted** Cypress failure media". Nothing redacts them.

**Fix.** (1) Project `getRunProjection` results in the task layer to counts + opaque ids, with emails hashed (`recipientHash` already sets this precedent). (2) Visit tickets with logging suppressed and strip the ticket from the URL immediately:

```ts
cy.visit(res.signInUrl, { log: false });
cy.location("search").then(() =>
  cy.window().then((w) => w.history.replaceState({}, "", "/onboarding")),
);
```

(3) Set `Cypress.config("redactions")`-style masking or, simplest, mint tickets with `expiresInSeconds: 60` so an artifact leak is inert by the time it is downloadable.

---

### C-12 — Workflow does not plumb the Basic-auth fallback, and does not wait for the deployment _(Medium)_

- `cypress.config.ts` and both scripts implement an `Authorization: Basic` fallback keyed on `STAGING_AUTH_USER` / `STAGING_AUTH_PASSWORD`. **Neither variable is exported in `staging-e2e.yml`.** The fallback is dead code in CI; if `STAGING_AUTH_SECRET` is ever rotated out of sync, every request 401s with no fallback despite one being implemented.
- The workflow triggers on `push: branches: [staging]`. Vercel builds that same push **asynchronously**. The preflight therefore probes whatever deployment is currently live — frequently the _previous_ one. This alone reproduces "I fixed the env var and CI still fails", which is precisely the failure documented in `STAGING_DB_LOCALHOST_AUTOPSY.md`.

**Fix.** Export the two vars, and gate on deployment identity:

```yaml
- name: Wait for staging deployment of this commit
  run: node scripts/wait-for-staging-deployment.mjs
  env:
    EXPECTED_SHA: ${{ github.sha }}
    STAGING_E2E_BASE_URL: ${{ env.STAGING_E2E_BASE_URL }}
```

where the script polls `GET /api/health` (already `isSettingsExemptRoute` and matcher-exempt) until it reports a build SHA equal to `EXPECTED_SHA`, with a 10-minute cap. Expose the SHA from `VERCEL_GIT_COMMIT_SHA` in the health payload if it is not already there. **Everything downstream is meaningless without this gate.**

Also add an explicit secret-presence check as the first step so a missing secret fails in 2 s with a name, rather than 4 minutes later inside `assertControlCredentials`.

---

### C-13 — The documented kill switch does not work; the environment gate is an OR _(High — security + operability)_

**Mechanism.** `app/api/internal/test-control/route.ts`:

```ts
const isStaging =
  env.otel.ddEnv === "staging" ||
  Boolean(env.stagingTestControl?.enabled) ||
  Boolean(env.stagingAuth?.isEnabled);
```

Three consequences, in ascending severity:

1. **The emergency kill switch is inoperative.** `staging-e2e-troubleshooting.md` §6.1 instructs the operator to set `ENABLE_STAGING_TEST_CONTROL=false` and states "All calls to `/api/internal/test-control` will immediately fail closed with HTTP 404." That is false: with `DD_ENV=staging` the first disjunct is still true, so the route stays live. The only levers that actually close it are clearing `TEST_CONTROL_SECRET` (→ `missing_configured_test_control_secret`) or `INTERNAL_SERVICE_SECRET` — the runbook lists those as secondary. **The primary documented incident control does nothing.**
2. **A perimeter flag enables a destructive API.** `env.stagingAuth?.isEnabled` means "HTTP Basic Auth is protecting this deployment" — it has no semantic relationship to test-control. Any deployment that turns on staging Basic Auth (a preview branch, a demo, production during an incident) silently exposes an API whose action set includes `cleanup-run` (bulk delete by run id) and `reset-identity-baseline` (rewrites Clerk `publicMetadata` and revokes all sessions for a user). The only remaining defence is two shared secrets.
3. **Nothing asserts not-production.** There is no production exclusion on this route — even though the exact predicate already exists three files away in `identity-repository.ts`:

   ```ts
   const isActualProduction =
     env.isProd &&
     !env.isVercelPreview &&
     env.otel.ddEnv !== "staging" &&
     !env.stagingTestControl?.enabled;
   ```

**Fix.** AND of signals, explicit opt-in required, production excluded by the codebase's own predicate:

```ts
const isActualProduction =
  env.isProd && !env.isVercelPreview && env.otel.ddEnv !== "staging";

const testControlEnabled =
  !isActualProduction &&
  Boolean(env.stagingTestControl?.enabled) && // ← the kill switch, now load-bearing
  (env.otel.ddEnv === "staging" || env.isVercelPreview); // ← and a non-prod environment

if (!testControlEnabled && !env.isTest) {
  return notFoundResponse("not_staging_environment");
}
```

Lock it with a unit test: `ddEnv="staging"` + `stagingTestControl.enabled=false` ⇒ **404**. That test is the one that makes the runbook true.

_(Credit where due: the rest of this route is well built — fail-closed 404s that never confirm existence, secret checks before dynamic imports so domain code is never loaded by an unauthenticated caller, a 64 KB body cap, `verifyStagingGrant` bound to `payload.runId`, `grant.actions.includes(payload.action)` enforced, and an extra scenario gate on `reset-identity-baseline`. §11 Q1 is answered: the grant-action check is present and correct. The defect is the gate in front of it, not the gate itself.)_

Minor, same file: `MAX_BODY_BYTES` is enforced _after_ `await request.text()` has already buffered the whole body. Check `content-length` first and reject before reading.

---

### C-14 — `/api/health` blocks the deployment gate, leaks internals publicly, and gives false assurance on the §4 question _(High)_

Five distinct issues in `app/api/health/route.ts`:

**14a — No build identity.** The response carries `version`, `environment`, `uptime` — but no commit SHA or deployment id. §11 Q2 is answered: **it does not exist and must be added**, because the Phase 1 readiness gate (C-12) has nothing else to key on. Vercel's immutability problem — the one that produced `STAGING_DB_LOCALHOST_AUTOPSY.md` — is undiagnosable without it.

```ts
buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
bootedAt: new Date(BOOT_TIME).toISOString(),
```

**14b — `/api/health` is behind the staging perimeter.** `isStagingProtectionExempt` exempts `/api/healthz` only, and the middleware matcher likewise excludes only `api/healthz`. So on staging, an unauthenticated `GET /api/health` returns **401 from `handleStagingProtection`**, not a health payload. The readiness-gate script must therefore send `x-staging-secret` (it already has the value) — **do not** widen the exemption, because of 14c. Note this in the script or Phase 1 fails on its first run for a reason that looks like a deployment failure.

**14c — Unauthenticated information disclosure.** `/api/health(.*)` is in `PUBLIC_API_ROUTES` and `isSettingsExemptRoute`, so in production it is world-readable. `checkDependency` puts raw `error.message` into `dependencies[].message`. A Prisma connectivity failure yields the database host and port verbatim — literally the string the preflight greps for (`Can't reach database server at …:5432`). The payload also publishes circuit-breaker state, cache stats, heap/RSS and `env.appVersion`.

→ Split the response by caller: public gets `{ status, version, buildSha, dependencies: [{name, status, latencyMs, critical}] }`; `message`, `circuitBreakers`, `caches` and `system` require a valid `x-internal-secret`.

**14d — `checkClerkAuth` cannot see the runtime that is actually broken.** It asserts `env.clerk.publishableKey` / `secretKey` are present **in the Node runtime**, which is precisely the runtime that already works. Health will report `auth-clerk: healthy` throughout a total Edge auth failure. Given §4, that is worse than no check. Extend it (internal-secret gated) with `clerkPublishableKeyFingerprint`, `clerkInstanceType` (`pk_test` vs `pk_live`), `clerkFrontendApi`, `clerkIsSatellite` — the same fields the Edge diagnostic prints, so the two can be **compared across runtimes**. That comparison is the cheapest discriminator for H-1 (see §4).

**14e — the Redis check does not check the queue.** `checkRedis` exercises `checkRateLimit`, which has an in-memory fallback and is classified non-critical. It never touches BullMQ's `ioredis` TCP connection. With the Redis→Postgres migration on hold, staging can report `healthy` while the queue is dead — the exact state that makes spec `04` return 503 and spec `07` poll to timeout. Add a genuine queue probe (S-5) rather than inferring Redis from the rate limiter.

**14f — cost.** Deep mode runs six checks including four Prisma round trips, unauthenticated, at 60 req/min per identifier. Make deep mode internal-secret gated (which 14c already requires) and leave `?shallow=true` as the public probe.

---

### C-15 — The most common test-control denial is the least diagnosable _(Medium)_

All three grant-failure branches return bare `notFoundResponse()` with **no** `x-test-control-denial` header, so `formatControlError` in `cypress.config.ts` prints `status 404:` with nothing after it. An expired grant (300 s — see C-9) is the single most likely runtime failure of this API and produces the least informative error in the system. Step 2 additionally collapses "internal secret not configured" (a 503 from `ensureValidInternalSecret`) and "internal secret mismatch" (403) into one reason. And the route emits **no server-side log at all** — every denial is invisible in Vercel logs.

**Fix.** Distinct, non-sensitive reasons on every branch (`grant_missing`, `grant_invalid_or_expired`, `grant_run_mismatch`, `grant_action_not_permitted`, `grant_scenario_not_eligible`, `internal_secret_not_configured`, `internal_secret_mismatch`), plus one structured log line per denial:

```ts
function deny(reason: string, meta: Record<string, unknown> = {}) {
  console.warn("test_control_denied", {
    reason,
    path: "/api/internal/test-control",
    ...meta,
  });
  return notFoundResponse(reason);
}
```

None of these reasons confirm resource existence or leak secret material, so the fail-closed-404 posture is preserved.

---

## 4. The Edge/Node auth asymmetry — candidate set and discriminators

This is the one open root cause. Do **not** guess; the Phase 0 diagnostic (C-2) plus the probes below discriminate every candidate in a single CI run.

**The invariant being violated:** for one cookie jar, `auth().userId` must be identical in Edge Middleware and in the Node server component. Today Node says "signed in" and Edge says "signed out". Anything that breaks _both_ runtimes equally is therefore **not** the cause — the mechanism has to be something that differs **between runtimes**. That constraint is what re-ranks the candidates below.

**Now known (§11 Q4): `staging.buildmarket.app` is a standalone Clerk instance.** Two consequences:

- Standalone ⇒ `NEXT_PUBLIC_CLERK_IS_SATELLITE` **must** be false/unset on Preview(staging). If it is set, that is a _confirmed_ misconfiguration, not a hypothesis — and `middleware.ts` documents that exact state as producing "an infinite sign-in redirect loop". Check it first; it is a 30-second `vercel env ls`.
- Standalone ⇒ staging owns its own publishable key, secret key **and** FAPI host: three independently Vercel-scopable variables that must all name the same instance. This repo has already shipped a duplicate generic-Preview `DATABASE_URL` that shadowed the branch-scoped one (see `STAGING_DB_LOCALHOST_AUTOPSY.md`). The same scoping mistake on any Clerk variable produces §4.

The runbook's own example key decodes to the FAPI host: `pk_live_Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk` → base64 → `clerk.staging.buildmarket.app$`. So `NEXT_PUBLIC_CLERK_FRONTEND_API` **must** equal `https://clerk.staging.buildmarket.app`, and that host must have live DNS and a valid certificate. The runbook's "`pk_live_…` **or** `pk_test_…`" phrasing means the instance _type_ has never been pinned — and the two types behave differently (H-6).

| ID       | Candidate                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Runtime-asymmetric?                                                     | Decisive discriminator                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-1**  | **`env.clerk.publishableKey` resolves differently — or to `undefined` — inside the Edge bundle.** `clerkMiddleware({ publishableKey: env.clerk.publishableKey })` passes the value **explicitly**; Node's `auth()` reads the environment itself. If `env.ts`'s resolution chain for that field depends on a non-`NEXT_PUBLIC_` variable, or on a fallback that is not inlined into the Edge bundle, Edge receives `undefined`/a foreign instance while Node is fine. | **Yes — the only candidate whose mechanism is inherently per-runtime.** | Compare `clerkPublishableKeyFingerprint` from the **Edge** C-2 diagnostic against the same field added to `/api/health` (**Node**, C-14d). Different or null on the Edge side ⇒ H-1 confirmed, and everything else is noise. |
| **H-4′** | **Satellite flags leaked into a standalone deployment.** Now a binary config assertion rather than a theory.                                                                                                                                                                                                                                                                                                                                                         | Yes (changes `clerkMiddlewareOptions` only)                             | `clerkIsSatellite` / `clerkDomain` in the Gate 0 diagnostic; grep Vercel logs for `[middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE=true but …`. Either is a confirmed hit.                                                       |
| **H-3**  | **`CLERK_SECRET_KEY` not resolvable in the Edge runtime.** `clerkMiddlewareOptions` deliberately omits `secretKey`, leaving Clerk to read `process.env`.                                                                                                                                                                                                                                                                                                             | Yes, if the variable's Vercel scope or the Edge bundle excludes it      | Add `secretKeyPresent: Boolean(process.env.CLERK_SECRET_KEY)` (boolean only) to the Edge diagnostic. Note `/api/health`'s `checkClerkAuth` **cannot** answer this — it runs in Node (C-14d).                                 |
| **H-6**  | **Clerk instance type / FAPI reachability.** A `pk_test_` development instance requires the dev-browser (`__clerk_db_jwt`) handshake and sets cookies differently from a `pk_live_` instance on a custom FAPI domain; a `pk_live_` instance needs working DNS + certificate for `clerk.staging.buildmarket.app`.                                                                                                                                                     | Partly — a broken handshake fails the Edge path first                   | Decode the configured key and assert it matches `NEXT_PUBLIC_CLERK_FRONTEND_API`; `curl -sI https://clerk.staging.buildmarket.app/v1/environment`. Add both to preflight permanently.                                        |
| **H-2**  | **`__client_uat` absent / on the wrong domain** (v1's theory). `@clerk/backend` classifies a session token without `client_uat` as signed-out outside a handshake.                                                                                                                                                                                                                                                                                                   | Partly                                                                  | `hasClientUatCookie` in the Gate 0 diagnostic. `true` ⇒ **H-2 dead**; stop pursuing the `setActive`/`window.location` race.                                                                                                  |
| **H-5**  | **CSP blocks the FAPI round trip** (`clerkFrontendApiOrigin` null ⇒ `connect-src` omits Clerk).                                                                                                                                                                                                                                                                                                                                                                      | No                                                                      | Produces a rendered `ticketError`, not a loop — so it is the least likely cause of _this_ symptom, but a latent second failure. Check `csp-reports` and the browser console in the failure screenshots.                      |

**Ranking (revised after the standalone answer):** H-4′ first because it is a 30-second binary check and a hit ends the investigation; then H-1, which is the only mechanism that is _structurally_ per-runtime; then H-3, H-6, H-2, H-5.

### Two cheap probes to add now

**P-1 — Edge/Node parity endpoint** (`/api/health/auth-parity`, internal-secret protected, staging only). Returns `{ edge: <userId|null>, node: <userId|null>, cookieNames: […] }` by having middleware stamp `x-bm-edge-user` onto the request headers and the Node handler compare it to its own `auth()`. One `curl` with a session cookie then settles the question permanently, and it can be asserted in preflight.

**P-2 — Middleware decision headers in staging.** In `applyDocumentCspHeaders`, when `ddEnv === "staging"`, attach `x-bm-mw-decision: <decision>` and `x-bm-auth-reason: <clerk reason>`. Cypress can then print the header on failure instead of guessing. `logMiddlewareDecision` already computes the decision — this just surfaces it where the test can see it.

---

## 5. Systemic weaknesses (fix after the loop, before the next incident)

**S-1 — Middleware makes an HTTP call to itself on protected requests.** `resolveOnboardingStatus` does `fetch(new URL("/api/internal/user-status", baseUrl))` with a 2 s `AbortSignal.timeout`, from the Edge, on **every** protected/onboarding navigation where session metadata lacks `isOnboarded`. On a cold serverless target that 2 s is routinely exceeded → `internal_api_error` → `strict` mode resolves `isOnboarded: false` → an onboarded user is bounced to `/onboarding`. That is a fail-_wrong_ default (fail-closed would be "deny", fail-open would be "allow"; silently asserting "not onboarded" is neither). Additionally `resolveSystemSettings(baseUrl)` runs on nearly every non-exempt request, doubling the self-call. Direction: put `isOnboarded`/`status` in Clerk session claims as the single source (it is already partly there via `parseMiddlewareSessionMetadata`), and treat the internal API as a cache-miss path with a short-TTL cache — or drop it and let the page handle the rare indeterminate case.

**S-2 — Three disagreeing sources of truth for the identity pool.** `DEFAULT_STAGING_SLOTS` in `identity-repository.ts` (4 slots) and an **independent copy** in `clerk-identity-adapter.ts` (4 slots) vs the runbook's table (6 slots: pro-1..3, client-1..3) vs the troubleshooting doc's "All 3 pool slots". Duplicated constants in two files is the actual defect; the docs are downstream of it. Export one `STAGING_IDENTITY_SLOTS` from `@build/db/staging-test-runs`, import it in both, and have preflight assert that every configured slot exists in **both** Clerk and Postgres before Cypress starts (this also kills the class of `STAGING_TEST_USER_MISSING` mid-run failures).

**S-3 — `markLeaseFailed` is not called on the `NON_POOL_CLERK_USER` branch** in `clerk-identity-adapter.ts`, so that error path leaves the lease `LEASED` for its full 300 s and burns a slot. Every terminal error branch should transition the lease.

**S-4 — Tests assert on hardcoded pool identities.** `02-routing-and-masked-disclosure.cy.ts` asserts the response body does not contain `e2e_client_1@staging.buildmarket.app`. If the lease ever hands out `client-2`, the assertion passes **vacuously** — the masked-disclosure guarantee is then untested while the suite is green. Assert against the identity actually in play (`identity.email` / the seeded client id returned by `seedScenario`), never a literal.

**S-5 — Queue path (specs 04, 07).** §11 Q3 is answered: `apps/workers` on Render consumes the **same** backend Preview(staging) enqueues to, and the Redis→Postgres migration is on hold — so BullMQ v5 on Redis is the live architecture and spec `07`'s app→worker pairing is sound by construction. That removes the mismatch theory and narrows the remaining risk to two things: (1) `REDIS_URL` must be present _and reachable_ from Vercel Preview(staging) **and** from Render, and (2) nothing currently verifies it — `/api/health`'s `checkRedis` probes the rate limiter, which falls back to memory and is marked non-critical (C-14e). Staging can therefore be "healthy" with a dead queue, which is exactly the state that makes `04` return 503 and `07` poll to timeout.
Retain v1's fix for `04`: persist the callback, return `202` unconditionally, reconcile asynchronously — a webhook receiver must not fail because a _downstream_ queue is unreachable. Add `/api/internal/queue-health` reporting `{ backend, connected, queueName, waiting, consumerSeenAt }` (a real `ioredis` PING plus a BullMQ `getJobCounts`), assert it in preflight, and have `07` skip with a named reason when no consumer has been seen in 60 s — a skipped test with a reason beats a 15 s poll timeout with none.

**S-6 — `capabilityBoundaryForPath` is evaluated twice.** Once in the outer `middleware` and again at the top of `clerkHandler`, which the outer function always reaches first. The inner call is dead code. Also, `boundary.ts` returns `NextResponse.json({error:"Not found"})` for **page** routes, so `/stores` serves JSON to a browser; spec `05` asserts only the status so it passes. Return the real 404 page for document requests (`Accept: text/html`) and JSON for API paths.

**S-7 — `Cypress.on("uncaught:exception")` returns `true` for everything else**, so a Clerk client-side error surfaces as a generic test failure at whatever command happened to be running. Given that the entire auth path runs in the browser, log the error (`cy.task("log", …)`) before returning `true`.

**S-8 — Suite-wide spec pattern.** `specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}"` means `test:staging-release-e2e` may pull in non-staging specs. Use a dedicated `cypress.staging.config.ts` scoped to `cypress/e2e/staging/**` with `redirectionLimit: 5`, `retries: { runMode: 1 }` (retries hide flakiness _and_ triple the cost of the loop), and `video: true` for the staging job only.

**S-9 — `timingSafeEqualStrings` returns early on length mismatch**, leaking secret length. Acceptable for a staging perimeter, but note it in the security register; the fix is to compare fixed-length digests (`SHA-256` of both inputs) rather than raw strings.

**S-10 — Service-level environment guard (revised).** Now that `route.ts` is reviewed: the grant/action/scenario checks **are** present and correct at the route layer (see C-13's parenthetical), so this is no longer a P0 gap — but every one of those checks lives in exactly one place, and `cleanupRun`/`resetIdentityBaseline`/`seedScenario` on the service will execute unconditionally for any future caller (a cron, a script, a second route, a test helper). Add `assertStagingTestControlEnabled()` — using the corrected C-13 predicate — as the first line of every mutating service method, so the domain enforces its own invariant rather than inheriting it from one HTTP handler.

---

## 6. Priority order

Ranked by (probability it is causing today's red) × (blast radius) ÷ (cost).

| Rank | Item                                                                      | Why here                                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **C-2** bounce breaker + P-1/P-2 probes                                   | Turns an unbounded, undiagnosable loop into a one-hop JSON answer. Also _names the §4 root cause_ on the next run. Nothing else is worth doing first.                                                     |
| 2    | **C-14a** build SHA in `/api/health` + **C-12** deployment-readiness gate | Until CI tests the commit it thinks it is testing, every other result is unreliable — including the fix verification for everything below. C-14a is a prerequisite: the gate has nothing to key on today. |
| 3    | **§4 root cause** (H-4′ → H-1 → H-3)                                      | The actual auth bug. Sequenced after 1–2 because 1 identifies it and 2 makes the fix verifiable.                                                                                                          |
| 4    | **C-1** ticket precedence                                                 | Fixes the loop's engine _and_ the silent wrong-identity corruption in specs 02/06.                                                                                                                        |
| 5    | **C-6** lease-backed login                                                | Removes cross-spec session revocation, i.e. the remaining source of "random" signed-out states.                                                                                                           |
| 6    | **C-7** emergency sweep                                                   | Currently capable of deleting a live run's data and reporting success. Data-safety, not red-build.                                                                                                        |
| 7    | **C-5**, **C-3**, **C-4** ownership & cleanup correctness                 | False greens and permanent staging leakage.                                                                                                                                                               |
| 8    | **C-8**, **C-9**, **C-10** timeouts & harness state                       | The intermittent tail.                                                                                                                                                                                    |
| 9    | **C-13** environment gate / kill switch                                   | Not causing red builds, but the documented emergency control for a destructive API does nothing. Fix before the next incident needs it, not during.                                                       |
| 10   | **C-14c/d/e**, **C-15** health payload & denial reasons                   | Public info disclosure, false assurance on the §4 question, and the least-diagnosable common failure.                                                                                                     |
| 11   | **S-1 … S-10**                                                            | Structural; schedule, don't cram.                                                                                                                                                                         |

---

## 7. Phased implementation checklist

Each phase ends with a **gate** — do not start the next phase until the gate passes. Phases 0–2 are one working session each.

### Phase 0 — Make the failure speak (no behaviour change for healthy traffic)

- [ ] Add `AUTH_BOUNCE_COOKIE`, `readBounce`, `clearAuthBounce`, `authLoopDiagnostic` to `redirect-policy.ts` (C-2).
- [ ] Add `fingerprintPublishableKey()` to `app/lib/security/clerk-fingerprint.ts` — returns `pk_test|pk_live` + decoded FAPI host, **never** the key.
- [ ] Wire the bounce counter into `redirectToSignIn`; gate `authLoopDiagnostic` to `ddEnv === "staging" || isVercelPreview || isDev`.
- [ ] Call `clearAuthBounce()` on `mw_allow_onboarding`, `mw_allow_protected`, `mw_allow_professional_pending_verification` in `middleware.ts`.
- [ ] Fix the existing loop-breaker branch in `redirectToSignIn` to return `applyDocumentCspHeaders(...)` rather than a nonce-less `NextResponse.next()` (C-2 secondary).
- [ ] Add `x-bm-mw-decision` + `x-bm-auth-reason` response headers in staging only (P-2).
- [ ] Add `GET /api/health/auth-parity` behind `x-internal-secret`, staging only (P-1).
- [ ] Cypress: on failure, print `x-bm-mw-decision` / the 503 diagnostic body via `cy.task("log", …)`.
- [ ] Add `redirectionLimit: 5` to the staging Cypress config (S-8) so the loop costs 5 hops, not 20.

**Gate 0:** trigger `workflow_dispatch` with `scenario: onboarding`. Expected: the run fails in **< 30 s** with a `AUTH_REDIRECT_LOOP_BROKEN` body in the log, and that body's `clerkIsSatellite` / `clerkDomain` / `hasClientUatCookie` / `clerkPublishableKeyFingerprint` / `secretKeyPresent` fields identify one of H-1…H-6. Record which (start with `clerkIsSatellite` — see H-4′).

### Phase 1 — Deployment identity + the auth root cause

- [ ] Add `buildSha` / `deploymentId` / `bootedAt` to the `/api/health` payload — **confirmed absent** (C-14a). Everything below depends on it.
- [ ] `scripts/wait-for-staging-deployment.mjs`: poll `/api/health` for `buildSha === EXPECTED_SHA`, 10-minute cap, clear failure text (C-12). **Send `x-staging-secret` / Basic auth** — `/api/health` is behind `handleStagingProtection`, only `/api/healthz` is exempt (C-14b).
- [ ] Add `clerkPublishableKeyFingerprint` / `clerkInstanceType` / `clerkFrontendApi` / `clerkIsSatellite` to `/api/health` behind `x-internal-secret` (C-14d) — this is the Node half of the H-1 comparison.
- [ ] Insert the wait step in `staging-e2e.yml` **before** preflight; add a first step that asserts every required secret is non-empty and names any that is not.
- [ ] Export `STAGING_AUTH_USER` / `STAGING_AUTH_PASSWORD` in the workflow `env:` block (C-12).
- [ ] **Do this before anything else in the phase:** `vercel env ls` for Preview(staging) — staging is a **standalone** Clerk instance, so `NEXT_PUBLIC_CLERK_IS_SATELLITE` set to `true` is a confirmed bug (H-4′), not a hypothesis. Also check for duplicate generic-Preview entries shadowing branch-scoped ones on every Clerk variable (the `DATABASE_URL` failure mode).
- [ ] Apply the fix for the candidate confirmed at Gate 0:
  - [ ] **H-4′:** unset `NEXT_PUBLIC_CLERK_IS_SATELLITE` / `NEXT_PUBLIC_CLERK_DOMAIN` for Preview(staging). Then change the middleware fallback from fail-open to **fail-fast outside production** — a satellite that cannot handshake should refuse to boot in staging rather than silently loop.
  - [ ] **H-1:** trace `env.clerk.publishableKey`'s resolution chain in `env.ts` and confirm every input is a `NEXT_PUBLIC_` variable available to the Edge bundle; pin one key for Preview(staging); assert in `scripts/verify-vercel-env.ts` that the decoded key host equals `NEXT_PUBLIC_CLERK_FRONTEND_API`'s host; redeploy (immutability).
  - [ ] **H-3:** scope `CLERK_SECRET_KEY` to Preview(staging); keep it out of `clerkMiddlewareOptions` and verify via `secretKeyPresent` rather than by re-adding the option.
  - [ ] **H-6:** pin the instance type; verify `https://clerk.staging.buildmarket.app/v1/environment` resolves with a valid certificate; add both assertions to preflight.
  - [ ] **H-2:** correct the instance's FAPI/domain config so `__client_uat` lands on the app's eTLD+1.
  - [ ] **H-5:** set `NEXT_PUBLIC_CLERK_FRONTEND_API`; add a boot-time assertion that `clerkFrontendApiOrigin` is non-null whenever `isProd || ddEnv === "staging"`.
- [ ] Add the confirmed variable to `scripts/verify-vercel-env.ts` so the CI env guard catches the regression next time.

**Gate 1:** `/api/health` reports `buildSha === github.sha`; the Edge diagnostic's `clerkPublishableKeyFingerprint` equals the one `/api/health` reports from Node; `/api/health/auth-parity` returns equal `edge` and `node` user ids for a live session; `curl -I` on `/onboarding` with a valid session cookie returns **200**, not 307.

### Phase 2 — Ticket precedence and identity isolation

- [ ] `page.tsx`: skip the `userId` short-circuit when `__clerk_ticket`/`ticket` is present (C-1).
- [ ] `ClerkSignInWidget.tsx`: remove `isSignedIn` from the ticket-skip guard; `clerk.signOut()` before `signIn.create({ strategy: "ticket" })`.
- [ ] Cypress `loginStagingUser` / `resetStagingIdentity`: `cy.clearCookies()` immediately before each ticket visit; assert **both** `__session*` and `__client_uat*`; fail with an explicit message naming the missing cookie.
- [ ] `cypress.config.ts`: force `signInUrl` onto `baseUrl`'s origin (`forceSameOrigin`) so a divergent `env.appUrl` (e.g. a `*.vercel.app` URL) can never send Cypress cross-origin mid-test.
- [ ] Introduce a non-destructive `BORROWED` lease kind; route `issueBrowserSessionHandoff` through `leaseIdentity` and mint the ticket for `lease.clerkId` (C-6).
- [ ] Widen `isAllowedScenarioForIdentityLease` for `BORROWED` only; keep destructive reset restricted to `onboarding` + `verification`.
- [ ] `clerk-identity-adapter.ts`: call `markLeaseFailed` on the `NON_POOL_CLERK_USER` branch (S-3).
- [ ] Replace hardcoded pool emails in specs with values returned by `seedScenario` / the lease (S-4).

**Gate 2:** `01`, `02`, `03`, `06`, `08` pass **with `retries.runMode: 0`**, and each passes **in isolation** (`--spec` one at a time) as well as in suite order. Isolation passing is the real signal — it proves order-dependence is gone.

### Phase 3 — Ownership, cleanup and data safety

- [ ] Derive review ownership from run-owned projects in both `getRunProjection` and `cleanupRun` (C-3).
- [ ] Drive `cleanupRun` deletes from `STAGING_CLEANUP_DEPENDENCY_ORDER` via a `DELETERS` map; fail the build on a missing key (C-4). Fix the duplicated `// 3.` comments.
- [ ] Exclude pool emails from `user.deleteMany`; add the in-transaction pool-survival post-condition (C-5).
- [ ] Extend the "zero owned records remain" check to the derived (review) ownership.
- [ ] `emergency-staging-cleanup.mjs`: `expiresAt < NOW() - INTERVAL '1 minute'`; scope by `workflowRunId` when `GITHUB_RUN_ID` is set (C-7a).
- [ ] `emergency-staging-cleanup.mjs`: `to_regclass` table-existence assertion before sweeping; loud failure on drift (C-7b).
- [ ] `emergency-staging-cleanup.mjs`: per-run `try/ROLLBACK/continue` + end-of-run summary + `::warning::` annotation; keep exit 0 (C-7c/d).
- [ ] Raise Prisma interactive-transaction `timeout`/`maxWait` on `restoreIdentityBaseline` and `cleanupRun`; confirm session-pooler port 5432 in staging (C-8).

**Gate 3:** run the full suite, then assert by SQL that (a) every `staging_test_runs` row is `CLEANED`, (b) no `staging_test_identity_leases` row is non-`RELEASED`, (c) `SELECT count(*) FROM "Review" r JOIN "Project" p ON p.id = r."projectId" WHERE p."stagingTestRunId" IS NOT NULL` = 0, (d) all pool users still exist. Then deliberately break one table name in the sweep script and confirm it now fails loudly.

### Phase 4 — Harness robustness and queue path

- [ ] Spec-scoped Cypress task state with `requireActive()` (C-10).
- [ ] Configurable run/grant lifetime (default 900 s in CI) or an `extend-run` grant action (C-9).
- [ ] `cypress.staging.config.ts` scoped to `cypress/e2e/staging/**`; `retries.runMode: 1`; `video: true` for the staging job (S-8).
- [ ] Log-then-rethrow in `uncaught:exception` (S-7).
- [ ] M-Pesa webhook: persist → return `202` unconditionally; move enqueue failure to a logged warning + outbox reconciliation. Update `04` to assert `202` for both the first and the replay call (S-5).
- [ ] `/api/internal/queue-health` doing a real `ioredis` PING + BullMQ `getJobCounts`, reporting `{ backend, connected, queueName, waiting, consumerSeenAt }`; assert in preflight; `07` skips with a named reason when no consumer has been seen (S-5).
- [ ] Replace `/api/health`'s `checkRedis` rate-limiter inference with the real queue probe, and reclassify it critical for staging (C-14e).
- [ ] Distinct `x-test-control-denial` reasons on every denial branch + one structured log line per denial (C-15); check `content-length` before buffering the body.
- [ ] Redact `getProjection` in the task layer (counts + opaque ids, hashed emails) (C-11).
- [ ] `expiresInSeconds: 60` on test tickets; `cy.visit(url, { log: false })`; rename the artifact step honestly or make it actually redact (C-11).

**Gate 4:** `04` and `07` pass with `REDIS_URL` deliberately unset — `04` returns 202 twice, `07` skips with a named reason. No test ticket appears in any uploaded screenshot (grep the artifact).

### Phase 5 — Structural hardening

- [ ] Single exported `STAGING_IDENTITY_SLOTS`; delete both `DEFAULT_STAGING_SLOTS` copies; reconcile the runbook table (S-2).
- [ ] Preflight asserts every configured slot exists in Clerk **and** Postgres, with the right role (S-2).
- [ ] Replace the OR'd environment gate in `test-control/route.ts` with the AND'd, production-excluding predicate; unit-test that `ddEnv="staging"` + `enabled=false` returns 404 (C-13).
- [ ] `assertStagingTestControlEnabled()` at the head of every mutating service method, using the same predicate (S-10). The route's grant/action/scenario checks are already correct — do not duplicate them, just stop depending on a single caller.
- [ ] Split `/api/health`: public gets status/version/buildSha/per-dependency status+latency; `message`, `circuitBreakers`, `caches`, `system` and deep mode require `x-internal-secret` (C-14c/f).
- [ ] Remove the dead `capabilityBoundaryForPath` call inside `clerkHandler`; return an HTML 404 for document requests (S-6).
- [ ] Move `isOnboarded`/`status` fully into Clerk session claims; demote the middleware self-fetch to a cached miss path or delete it; change `strict` mode's fallback from "assume not onboarded" to an explicit, logged decision (S-1).
- [ ] `timingSafeEqualStrings` over SHA-256 digests to remove the length oracle (S-9).
- [ ] Rewrite `staging-e2e-troubleshooting.md` §5 against the new diagnostics; delete Issue 1's remediation (superseded), correct the pool-size numbers, and **re-verify §6.1's kill-switch claim** once C-13 lands — it is currently false.

**Gate 5:** three consecutive green scheduled runs with zero retries consumed; `verify-vercel-env.ts` fails the build when any one of the Phase-1 variables is removed from Preview(staging); and the runbook's kill switch is exercised for real — set `ENABLE_STAGING_TEST_CONTROL=false`, redeploy, confirm 404 with `x-test-control-denial: not_staging_environment`, restore.

---

## 8. Test plan

### 8.1 Unit / integration (run in normal CI, not staging)

| Target                  | Assertion                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirectToSignIn`      | Third consecutive call with the bounce cookie returns 503 `AUTH_REDIRECT_LOOP_BROKEN`, not a redirect. A successful allow clears the cookie.                                                                      |
| `redirectToSignIn`      | Satellite origin ⇒ absolute `redirect_url`; primary origin ⇒ path + search. (Existing invariant — lock it with a test, it has regressed before.)                                                                  |
| `SignInPage`            | `userId` present **and** `__clerk_ticket` present ⇒ renders the widget, does **not** redirect.                                                                                                                    |
| `cleanupRun`            | Every member of `STAGING_CLEANUP_DEPENDENCY_ORDER` has a registered deleter (fails at build if not).                                                                                                              |
| `cleanupRun`            | A user row with a pool email and a `stagingTestRunId` is **not** deleted and the transaction aborts.                                                                                                              |
| `getRunProjection`      | A review attached to a run-owned project but with `stagingTestRunId = null` appears in `fixtures.reviews`.                                                                                                        |
| `leaseIdentity`         | Two concurrent leases for the same role get different slots; exhaustion returns `null` (not a throw).                                                                                                             |
| `verifyStagingGrant`    | Rejects an action not present in `actions[]`; rejects `exp > iat + MAX`; rejects a token signed with a different secret.                                                                                          |
| `test-control/route.ts` | `ddEnv="staging"` + `stagingTestControl.enabled=false` ⇒ **404** `not_staging_environment`. (This is the test that makes the runbook's kill switch true — C-13.)                                                  |
| `test-control/route.ts` | `stagingAuth.isEnabled=true` alone, with `enabled=false`, ⇒ 404. Production env ⇒ 404 regardless of every other flag.                                                                                             |
| `test-control/route.ts` | Valid grant for run A + `runId` B ⇒ 404 `grant_run_mismatch`; grant without the requested action ⇒ 404 `grant_action_not_permitted`; expired grant ⇒ 404 `grant_invalid_or_expired`. Each sets the denial header. |
| `/api/health`           | Public response contains no `message`, `circuitBreakers`, `caches` or `system`; internal-secret response does. `buildSha` present.                                                                                |
| `emergency sweep`       | Predicate does not select a run created 10 s ago.                                                                                                                                                                 |

### 8.2 Staging preflight (fail-fast gates, before Cypress)

1. Deployment SHA equals `github.sha` (probe `/api/health` **with** staging-perimeter headers — C-14b).
2. All required secrets non-empty (names printed for any missing).
3. `/api/internal/test-control` create-run → cleanup-run round trip (existing).
4. `/api/health/auth-parity` agrees for an unauthenticated request (`null`/`null`).
5. Every configured identity slot exists in Clerk and Postgres with the correct role.
6. Unauthenticated `GET /onboarding` returns **exactly one** 307 to `/sign-in` (follow redirects with a cap of 3; more than one hop ⇒ fail with "auth loop present, see §4").
7. Decoded publishable-key host equals `NEXT_PUBLIC_CLERK_FRONTEND_API`'s host, that host serves a valid certificate, and `clerkIsSatellite` is **false** (staging is standalone) — H-1/H-4′/H-6 regression guards.
8. `/api/internal/queue-health` reports a connected Redis backend and a consumer seen within 60 s (warn-only until Phase 4).

### 8.3 Staging E2E acceptance

- Full suite green with `retries.runMode: 1`, three consecutive runs.
- Each spec green **standalone** (`--spec`) — proves order-independence.
- Post-run SQL invariants from Gate 3.
- Chaos checks: unset `REDIS_URL` ⇒ `04` still green, `07` skips; revoke `STAGING_AUTH_SECRET` ⇒ Basic-auth fallback carries the suite (proves C-12's plumbing); point `DATABASE_URL` at loopback ⇒ preflight fails in < 5 s with the named cause.

---

## 9. Appendix A — environment variable truth table

Fill this in and keep it next to `verify-vercel-env.ts`. "Runtime" matters: Edge Middleware and Node handlers resolve variables independently, and _that split is the subject of §4_.

| Variable                                     | GH Actions (`staging-e2e`) | Vercel Preview(staging)                           | Needed in Edge?                  | Needed in Node? | Verified by                                                  |
| -------------------------------------------- | -------------------------- | ------------------------------------------------- | -------------------------------- | --------------- | ------------------------------------------------------------ |
| `STAGING_E2E_BASE_URL`                       | ✅                         | —                                                 | —                                | —               | preflight                                                    |
| `STAGING_E2E_ALLOWED_HOSTS`                  | ✅                         | —                                                 | —                                | —               | `assertControlCredentials`                                   |
| `INTERNAL_SERVICE_SECRET`                    | ✅                         | ✅                                                | ✅ (`ensureValidInternalSecret`) | ✅              | preflight                                                    |
| `TEST_CONTROL_SECRET`                        | ✅                         | ✅                                                | —                                | ✅              | preflight                                                    |
| `STAGING_AUTH_SECRET`                        | ✅                         | ✅                                                | ✅ (`handleStagingProtection`)   | —               | preflight                                                    |
| `STAGING_AUTH_USER` / `_PASSWORD`            | **❌ missing (C-12)**      | ✅                                                | ✅                               | —               | chaos check 8.3                                              |
| `DATABASE_URL`                               | ✅ (runner sweep)          | ✅ session pooler :5432                           | —                                | ✅              | preflight + C-8                                              |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`          | —                          | ✅ **pinned**                                     | ✅                               | ✅              | H-1 fingerprint                                              |
| `CLERK_SECRET_KEY`                           | —                          | ✅                                                | ✅ (implicit)                    | ✅              | H-3 `secretKeyPresent`                                       |
| `NEXT_PUBLIC_CLERK_FRONTEND_API`             | —                          | ✅                                                | ✅ (CSP)                         | ✅              | H-5 boot assertion                                           |
| `NEXT_PUBLIC_CLERK_IS_SATELLITE` / `_DOMAIN` | —                          | ❌ **must be unset — standalone instance (H-4′)** | ✅                               | ✅              | Gate 0 diagnostic + preflight                                |
| `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL`      | —                          | not applicable (standalone)                       | ✅                               | ✅              | `resolvePrimaryOrigin` throw                                 |
| `ENABLE_STAGING_TEST_CONTROL`                | —                          | ✅ `true`                                         | —                                | ✅              | preflight 404 branch — **inert as a kill switch until C-13** |
| `DD_ENV`                                     | —                          | ✅ `staging`                                      | ✅                               | ✅              | diagnostic gating                                            |
| `REDIS_URL`                                  | —                          | ✅                                                | —                                | ✅              | queue-health (same backend as the Render worker — §11 Q3)    |
| `VERCEL_GIT_COMMIT_SHA`                      | —                          | (platform-provided)                               | —                                | ✅              | surfaced by `/api/health` as `buildSha` (C-14a)              |

---

## 10. Appendix B — the loop, hop by hop (corrected)

```text
 cy.visit(/sign-in?__clerk_ticket=T&redirect_url=/onboarding)
   │
   ├─ [Edge] isPublicRoute(/sign-in) → allow (+CSP nonce)
   ├─ [Node] SignInPage: auth().userId …
   │     ├─ null  → renders widget → ticket exchanged → setActive → /onboarding   ✅ happy path
   │     └─ set   → redirect(/onboarding)  ⟵ C-1: TICKET SILENTLY DISCARDED
   ▼
 GET /onboarding      (cookies: __session=…, __client_uat=?)
   │
   ├─ [Edge] handleStagingProtection → cookie bm_staging_auth ok
   ├─ [Edge] isOnboardingRoute → await auth() → userId === null   ⟵ §4 ROOT CAUSE
   └─ redirectToSignIn(/onboarding)  →  307 /sign-in?redirect_url=%2Fonboarding
                                                    ▲
                       note: NO ticket on this URL ─┘  (so C-1's "userId set"
                                                        branch is now guaranteed)
   ▼
 GET /sign-in?redirect_url=%2Fonboarding
   └─ [Node] auth().userId is SET → redirect(/onboarding) ─────────────┐
                                                                       │
   ◄───────────────────── 20× until Cypress gives up ──────────────────┘
```

The two runtimes never compare notes, and no counter exists on either side — which is why C-2 is ranked above the root cause itself.

---

## 11. Answers received, and what they changed

| Question                                                                                                                                                                                                                        | Answer                                                                                                                                                       | Effect on this document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Q1** — does `test-control/route.ts` gate the environment, verify the grant against `runId`, and check the requested action against `grant.actions`?                                                                           | Reviewed. Grant verification, `runId` binding, `actions[]` membership and the extra `reset-identity-baseline` scenario gate are **all present and correct**. | The feared P0 does not exist. Two new defects found _in front of_ those checks instead: **C-13** (the environment gate is an OR, so the documented kill switch is inert and a perimeter flag can enable a destructive API) and **C-15** (grant denials carry no reason and are never logged).                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Q2** — does `/api/health` expose a build SHA?                                                                                                                                                                                 | **No.**                                                                                                                                                      | **C-14a.** The Phase 1 readiness gate is blocked until it is added; it is now the first item in that phase. Reviewing the file also surfaced C-14b (health is behind the staging perimeter, so the gate script must authenticate), C-14c (raw dependency error messages — including the database host — are world-readable), C-14d (the Clerk check runs in Node and therefore cannot see the runtime that is broken) and C-14e (the Redis check probes the rate limiter, not the queue).                                                                                                                                                                                                                                                              |
| **Q3** — is `apps/workers` on the same queue backend as Preview(staging)?                                                                                                                                                       | **Yes**; the Redis→Postgres migration is on hold.                                                                                                            | Spec `07`'s app→worker pairing is sound by construction, so the mismatch theory is dropped. **S-5** narrows to: `REDIS_URL` must be reachable from both Vercel and Render, and nothing currently verifies it (C-14e). The `04` → 202 fix and the `queue-health` probe stand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Q4** — is `staging.buildmarket.app` a satellite or standalone?                                                                                                                                                                | **Standalone Clerk instance.**                                                                                                                               | §4 re-ranked. H-4 becomes **H-4′**, a binary config assertion: standalone ⇒ `NEXT_PUBLIC_CLERK_IS_SATELLITE` must be unset, so finding it set ends the investigation immediately. H-1 is promoted to the leading _mechanistic_ candidate because it is the only one that is structurally per-runtime. New **H-6** (instance type / FAPI DNS + certificate) added, since standalone means staging owns its own FAPI host.                                                                                                                                                                                                                                                                                                                               |
| **Q5** — does `env.ts` derive `env.clerk.publishableKey` exclusively from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` without dynamic object property access, guaranteeing it is statically inlined during Edge middleware compilation? | **No.** Reviewed `apps/client/app/lib/infrastructure/env.ts` (lines 1190–1236).                                                                              | **H-1 confirmed by inspection, pending Edge observation at Gate 0.** `getStringEnv` delegates to `@build/env-validation`'s `getStringEnvFromObj(process.env, name)`, which uses dynamic bracket access `obj[name]`. Next.js Webpack/Turbopack `DefinePlugin` _only_ inlines static member expressions (`process.env.NEXT_PUBLIC_*`). This defect is broader than the Clerk key: **every env variable reachable from `middleware.ts` (`INTERNAL_SERVICE_SECRET`, `STAGING_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `DD_ENV`) lacks build-time inlining**, leaving Edge to fall back to an incomplete Vercel runtime shim. Additionally, lines 1200–1236 synthesize a dynamic key from `NEXT_PUBLIC_CLERK_FRONTEND_API` via Base64 and mutate `process.env`. |

### Still open

1. Whether Preview(staging) carries duplicate generic-Preview Clerk variables shadowing branch-scoped ones — the same failure mode as the `DATABASE_URL` incident. `vercel env ls` answers it in 30 seconds and it is the first item of Phase 1.
2. `packages/redis` / `@build/queue-server` were not reviewed; the `queue-health` probe in Phase 4 needs their connection API.
