# Staff-Level Autopsy: Staging E2E Cross-Service Validation Failures

**Date:** 2026-09-16  
**Audience:** Staff Engineers, Infrastructure, Platform Engineering  
**Scope:** GitHub Actions Workflow (`staging-e2e.yml`), Cypress Test Suite (`apps/client/cypress`), Staging Test-Control Boundary (`/api/internal/test-control`), Edge Middleware (`middleware.ts`), Clerk Authentication Handshake, BullMQ / Redis Subsystem.

---

## Executive Summary

The Staging E2E Cross-Service Validation suite (`staging-e2e.yml`) in GitHub Actions exhibits recurring failures across two distinct layers:

1. **The Authentication & Navigation Boundary (88% Failure Rate across Specs 01, 02, 03, 06, 08)**: Browser sessions enter an infinite 20-hop ping-pong loop between Next.js Edge Middleware on `/onboarding` and the Node.js SSR Server Component on `/sign-in`. The suite aborts with:

   ```text
   CypressError: The application redirected to `https://staging.buildmarket.app/sign-in?redirect_url=%2Fonboarding` more than 20 times.
   ```

2. **The Asynchronous Queue & Webhook Settlement Boundary (Specs 04 & 07)**:
   - Spec 04 (`04-mpesa-replay-and-idempotency.cy.ts`) fails because `/api/webhooks/mpesa/stk-callback` attempts to enqueue a BullMQ job via `addMpesaStkCallbackJob`. Under BullMQ v5, queue connection requires Redis (`REDIS_URL`). In staging serverless execution, absent or unreachable Redis endpoints either threw an unhandled 500 or returned a 503 error, violating the test's `expect([200, 202])` assertion.
   - Spec 07 (`07-queue-recovery.cy.ts`) relies on asynchronous worker retries (1,000ms delay) that either fail to process due to worker disconnects or miss Cypress snapshot assertions.
3. **Workflow Routing Drift**: `staging-e2e.yml` contains broken matrix targets (e.g. `review-eligibility` targets a non-existent `03-review-eligibility.cy.ts`, colliding with duplicate spec numbering `03-messaging.cy.ts` vs `06-messaging.cy.ts`).

---

## Complete Workflow Architectural Breakdown

The end-to-end staging validation system spans three decoupled tiers: the CI runner orchestrator, the deployed staging Vercel service, and backing data stores.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          1. CI Runner (GitHub Actions)                      │
│                                                                             │
│  [staging-e2e.yml]                                                          │
│     │                                                                       │
│     ├─► 1. Preflight Probe (preflight-staging-db-check.mjs)                 │
│     │     POST /api/internal/test-control (create-run -> cleanup-run)       │
│     │                                                                       │
│     ├─► 2. Cypress Suite (cypress/e2e/staging/*.cy.ts)                      │
│     │     cy.initStagingRun() ──► POST /api/internal/test-control           │
│     │     cy.resetStagingIdentity() ──► issues single-use Clerk ticket      │
│     │     cy.visit(/sign-in?__clerk_ticket=...) ──► settles browser session │
│     │     cy.visit(/onboarding) ──► asserts protected boundary              │
│     │                                                                       │
│     └─► 3. Emergency Cleanup Sweep (emergency-staging-cleanup.mjs)          │
│           Direct pg connection sweeps expired leases & stranded records     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS / Egress
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 2. Deployed Staging Application (Vercel)                    │
│                                                                             │
│  [Edge Middleware] (middleware.ts)                                          │
│     ├─ Perimeter check: handleStagingProtection (HTTP Basic Auth / Secret)  │
│     ├─ Fast-Path: /api/internal/* bypasses Clerk session check               │
│     └─ clerkMiddleware(): verifies JWT session cookie (__session)           │
│           │                                                                 │
│           ▼                                                                 │
│  [Serverless Node.js Handlers]                                              │
│     ├─ /app/sign-in/page.tsx: auth() checks userId, renders SignInWidget     │
│     ├─ /api/internal/test-control: testControlService manages leases        │
│     └─ /api/webhooks/mpesa/stk-callback: records event, enqueues BullMQ job │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ TCP / VPC
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  3. Persistence & Shared Infrastructure                     │
│                                                                             │
│  ├─ PostgreSQL (Supabase/Neon): staging_test_runs, identity_leases, users   │
│  ├─ Clerk Identity Platform: FAPI (clerk.staging.buildmarket.app)           │
│  └─ Redis (Upstash TCP): BullMQ queues (ioredis persistent TCP)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Sequence of a Staging Test Run

1. **Test Initialization (`cy.initStagingRun`)**:
   - Cypress invokes `stagingTestControl:createRun` via `cy.task()`.
   - Node process on runner dispatches `POST /api/internal/test-control` with `action: "create-run"`, protected by `x-internal-secret` and `x-test-control-secret`.
   - Route validates HMAC signature and issues a signed `grantToken` and `runId`.
2. **Identity Leasing & Baseline Reset (`cy.resetStagingIdentity`)**:
   - Cypress requests an identity for role `PROFESSIONAL` or `CLIENT`.
   - `testControlService.resetIdentityBaseline()` acquires an exclusive lease on a pool slot (e.g. `e2e_pro_1`) using an atomic PostgreSQL transaction.
   - `clerkIdentityAdapter.restoreClerkIdentityBaseline()` calls Clerk Backend API to set `publicMetadata: { isOnboarded: false, isProfileComplete: false }` and revoke existing sessions.
   - Database child entities (`ProfessionalProfile`, `VerificationCase`, `License`, etc.) are purged.
   - A single-use Clerk ticket is minted via `clerk.signInTokens.createSignInToken`.
   - Returns `signInUrl`:
     `https://staging.buildmarket.app/sign-in?__clerk_ticket=<token>&redirect_url=%2Fonboarding`.
3. **Browser Session Settlement**:
   - Cypress visits `signInUrl`.
   - Server-side `SignInPage` (`apps/client/app/sign-in/[[...sign-in]]/page.tsx`) renders `ClerkSignInWidget`.
   - `ClerkSignInWidget` detects `__clerk_ticket` in query parameters, calls `clerk.client.signIn.create({ strategy: "ticket", ticket })`, calls `clerk.setActive({ session })`, and navigates to the redirect target.
4. **Boundary Assertion**:
   - Cypress navigates to `/onboarding`.
   - Middleware and page routes verify the identity state (`ONBOARDING`, `NOT_STARTED`).
5. **Tear-Down & Cleanup**:
   - `afterEach` triggers `cy.cleanupStagingRun()`.
   - All fixtures tagged with `stagingTestRunId` are deleted, and identity lease transitions to `RELEASED`.

---

## Detailed Findings & Root Causes

### Finding 1: The 20-Hop Infinite Redirect Loop (Specs 01, 02, 03, 06, 08)

#### Symptom

```text
CypressError: The application redirected to `https://staging.buildmarket.app/sign-in?redirect_url=%2Fonboarding` more than 20 times.
```

#### Detailed Failure Mechanism

The loop is created by an asymmetric authentication split between the **Next.js Edge Middleware** and the **Node.js SSR Server Component**:

1. **Browser sets active session**: In `ClerkSignInWidget.tsx`, `clerk.setActive({ session: attempt.createdSessionId })` sets the `__session` cookie in the browser. Immediately, `window.location.href = "/onboarding"` fires.
2. **Edge Middleware rejects session on `/onboarding`**:
   The browser makes a `GET /onboarding` request carrying cookie `__session=<jwt>`.
   `apps/client/middleware.ts` runs on the Vercel Edge Runtime.
   Line 333: `if (isOnboardingRoute(nextReq))` executes `const authObject = await auth()`.
   `auth().userId` evaluates to `null`!
   Because `userId` is missing, line 346 fires:

   ```ts
   return redirectToSignIn(nextReq, pathname + nextReq.nextUrl.search);
   ```

   Middleware returns an HTTP 307 redirecting to:
   `https://staging.buildmarket.app/sign-in?redirect_url=%2Fonboarding`.

3. **Node.js Server Component accepts session on `/sign-in`**:
   The browser follows the redirect to `GET /sign-in?redirect_url=%2Fonboarding`.
   `/sign-in` is an informational public route (`isPublicRoute`), so Edge Middleware lets it pass to the server component.
   `SignInPage` (`apps/client/app/sign-in/[[...sign-in]]/page.tsx`) executes on Node.js Serverless runtime:

   ```ts
   const { userId } = await auth();
   if (userId) {
     redirect(safeRedirectUrl ?? "/auth-callback");
   }
   ```

   In the Node.js runtime, `auth()` **does** detect `userId` (it reads `CLERK_SECRET_KEY` from process environment and can verify the session token).
   Because `userId` exists, `SignInPage` immediately triggers Next.js navigation:
   `redirect("/onboarding")`.

4. **Closed Loop**: The browser is redirected back to `/onboarding`. Edge Middleware again evaluates `auth().userId` to `null` and redirects to `/sign-in`. This cycles indefinitely until Cypress hits `redirectionLimit: 20`.

#### Root Causes of the Edge Authentication Asymmetry

1. **Edge vs Node.js Secret Key Binding**:
   In commit `ff09c514`, `secretKey` was removed from `clerkMiddlewareOptions` in `middleware.ts` because passing `env.clerk.secretKey` caused `MIDDLEWARE_INVOCATION_FAILED` (HTTP 500 `@clerk/nextjs: Missing secretKey`) when `CLERK_SECRET_KEY` was not bound to the Edge runtime on Vercel.
   Without a bound secret key in Edge, Clerk v7 cannot perform local cryptographic verification of session tokens; it relies on network calls or falls back to signed-out states if Edge network access to Clerk FAPI fails or if key configuration mismatches.
2. **Client UAT Timing & Handshake Status**:
   Clerk requires two cookies for session validity: `__session` and `__client_uat`.
   Under `@clerk/backend` line 7094:

   ```js
   if (!hasActiveClient && hasSessionToken) {
     return handleMaybeHandshakeStatus(
       authenticateContext,
       AuthErrorReason.SessionTokenWithoutClientUAT,
       "",
     );
   }
   ```

   When `window.location.href = target` executes immediately after `clerk.setActive()`, the browser may dispatch the `GET` request before `__client_uat` cookie writes flush across iframes, causing Clerk's backend to classify the session as `SessionTokenWithoutClientUAT` (which returns a signed-out state in non-handshake production routes).

---

### Finding 2: BullMQ / Redis Webhook Settlement Failure (Spec 04)

#### Symptom (Finding 2)

```json
AssertionError: expected [ 200, 202 ] to include 500
```

(and after commit `314f558f`, returning `503 Service Unavailable`).

#### Detailed Failure Mechanism (Finding 2)

1. In `04-mpesa-replay-and-idempotency.cy.ts`, Cypress posts a simulated STK callback payload to `/api/webhooks/mpesa/stk-callback`.
2. The webhook handler (`apps/client/app/api/webhooks/mpesa/stk-callback/route.ts`) persists the callback event in PostgreSQL (`prisma.mpesaCallbackEvent.create`), ensuring full durability.
3. It then immediately invokes:

   ```ts
   await addMpesaStkCallbackJob({ ... });
   ```

4. In `@build/queue-server` (`packages/queue-server/src/backend.ts`), `getQueueConnectionOptions()` delegates to `createRedisConnection()` from `@build/redis/tcp`:
   - BullMQ v5 is strictly an `ioredis` TCP client.
   - `requireRedisUrl()` checks `process.env.REDIS_URL`.
   - If `REDIS_URL` is absent, invalid, or pointing to an unauthenticated/unreachable Upstash endpoint in Vercel staging, `ioredis` throws.
5. In commit `314f558f`, the call was wrapped in a `try / catch` that returns `acceptedResponse(503)`.
6. However, `04-mpesa-replay-and-idempotency.cy.ts` asserts:

   ```ts
   expect([200, 202]).to.include(firstRes.status);
   ```

   A status of `503` fails the test.

7. **The Architectural Anti-Pattern**: The primary purpose of a webhook receiver is to acknowledge provider callbacks quickly and store them durably. Failable background queue enqueuing should never fail an already-persisted webhook transaction.

---

### Finding 3: BullMQ Postgres Backend Architectural Misalignment

#### Context

In prior sessions, the question arose: _"How do I move BullMQ's backend from Redis to Postgres for my staging environment?"_

#### Investigation & Ground Truth

1. The repository contains `docs/runbooks/queue-postgres-migration.md` and `apps/workers/docs/adr/adr-bullmq-nats-queue-split.md`.
2. In `packages/queue-server/src/backend.ts` lines 121–132:

   ```ts
   if (backend === "postgres") {
     throw new Error(
       `[BullMQ] PostgreSQL queue backend is not supported${queueName ? ` for queue "${queueName}"` : ""}. ` +
         `BullMQ requires Redis connection options. Please configure QUEUE_BACKEND=redis.`,
     );
   }
   ```

3. **The Reality**: The codebase is on **BullMQ v5 (`^5.76.8`)**, which does **not** natively support PostgreSQL. BullMQ requires Redis TCP. Setting `QUEUE_BACKEND=postgres` in staging causes an immediate fatal boot failure.

---

### Finding 4: Spec File Numbering & Workflow Matrix Mismatch

#### Symptom (Finding 4)

In `.github/workflows/staging-e2e.yml`:

```yaml
review-eligibility)
pnpm -C apps/client exec cypress run --spec "cypress/e2e/staging/03-review-eligibility.cy.ts" --env STAGING_RELEASE_E2E=true
;;
```

#### Evidence

Directory listing of `apps/client/cypress/e2e/staging`:

- `01-onboarding-and-verification.cy.ts`
- `02-routing-and-masked-disclosure.cy.ts`
- `03-messaging.cy.ts` _(Collision with 06-messaging)_
- `04-mpesa-replay-and-idempotency.cy.ts`
- `05-capability-rollback.cy.ts`
- `06-messaging.cy.ts`
- `07-queue-recovery.cy.ts`
- `08-verification-public-trust.cy.ts`

There is **no** `03-review-eligibility.cy.ts` file in the repository. If triggered from the GitHub Actions UI with `scenario: review-eligibility`, the runner fails immediately.

---

## Staff-Level Proposed Changes & Improvements

### 1. Edge Middleware & Redirect Loop Elimination

- **Session Settlement Synchronization**: In `apps/client/components/auth/ClerkSignInWidget.tsx`, after calling `await clerk.setActive({ session: attempt.createdSessionId })`, do not invoke `window.location.href` synchronously. Allow Clerk's client SDK to flush cookies (`__session`, `__client_uat`).
- **Pathname & Cookie Assertion in Cypress**: In `apps/client/cypress/support/staging-test-control.ts`, update `resetStagingIdentity` and `loginStagingUser` to ensure both `__session` and `__client_uat` cookies are present and hydrated before issuing navigation commands.
- **Server Component Loop Breaker**: In `apps/client/app/sign-in/[[...sign-in]]/page.tsx`, if `userId` is present and `safeRedirectUrl === "/onboarding"`, verify that the redirect target is not identical to the current referrer to break circular loops.

### 2. M-Pesa Webhook Decoupling & Outbox Resilience

- In `apps/client/app/api/webhooks/mpesa/stk-callback/route.ts`:
  Once `prisma.mpesaCallbackEvent.create()` succeeds, the webhook has fulfilled its primary persistence guarantee.
  If `addMpesaStkCallbackJob` fails due to Redis absence or network failure, log the failure as an enqueue-warning and still return `acceptedResponse(202)` (Accepted).
  An asynchronous Outbox worker or cron job reconciles unprocessed events where `processedAt IS NULL`.

### 3. Queue Architecture Clarification (Redis vs PostgreSQL)

- **Redis Requirement**: BullMQ v5 strictly requires an Upstash Redis TCP connection (`rediss://...`). Provide valid `REDIS_URL` in Vercel staging and CI secrets.
- **PostgreSQL Outbox Option**: If the objective is to eliminate Redis entirely from staging, implement a lightweight PostgreSQL-backed task table or upgrade to BullMQ v6 (which introduces experimental `IQueueBackend`), rather than setting unsupported flags in BullMQ v5.

### 4. Workflow Alignment

- Correct `cypress/e2e/staging/` inventory: resolve the duplicate `03-messaging.cy.ts` and ensure scenario choices in `staging-e2e.yml` map 1:1 to existing spec files.

---

## Architectural Alignment & Precedents

| Architectural Boundary         | Alignment Status | Notes                                                                                                                                  |
| :----------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-001 (Auth Model)**       | **Aligned**      | Clerk remains the canonical runtime identity authority; database state does not override runtime identity claims.                      |
| **ADR-002 (Layer Boundaries)** | **Aligned**      | Testing harness uses isolated adapters (`test-control`) and repository boundaries without leaking test logic into production handlers. |
| **ADR-003 (Domain Structure)** | **Aligned**      | Test control domain (`apps/client/app/lib/domains/testing/test-control`) maintains strict import hierarchy.                            |
| **ADR-004 (Env Boundary)**     | **Aligned**      | Environment variables are centralized through `env.ts` and `envConfig`.                                                                |
