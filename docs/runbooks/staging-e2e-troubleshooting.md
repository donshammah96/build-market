# Staging E2E Suite: Complete Setup & Operational Troubleshooting Runbook

**Document Owner:** Staff Infrastructure & QA Engineering  
**Target Systems:** `apps/client`, `apps/workers`, GitHub Actions, Vercel Staging, Clerk Identity Platform, Supabase PostgreSQL, Upstash Redis.  
**Related ADRs:** [ADR-001 (Auth Model)](../apps/client/docs/adr/ADR-001-auth-model.md), [ADR-002 (Layer Boundaries)](../apps/client/docs/adr/ADR-002-client-layer-boundaries.md), [ADR-004 (Canonical Env)](../apps/client/docs/adr/ADR-004-cannonical-env-access-boundary.md).

---

## 1. Architecture & Component Blueprint

The staging end-to-end validation system automates real-world browser and API testing against the live, deployed staging environment without mutating production data.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GitHub Actions Runner                              │
│                                                                             │
│  1. preflight-staging-db-check.mjs ──► Tests DB connectivity via deployed API│
│  2. Cypress E2E Runner ──────────────► Headless Electron executes specs      │
│  3. emergency-staging-cleanup.mjs ──► Direct DB sweep in if: always()       │
└───────────────────────┬──────────────────────────────────┬──────────────────┘
                        │ HTTPS (Test-Control & UI)         │ Direct PostgreSQL
                        ▼                                  ▼
┌───────────────────────────────────────┐  ┌──────────────────────────────────┐
│         Vercel Staging Deployment      │  │        PostgreSQL Database       │
│                                       │  │                                  │
│  ├─ Edge Middleware (middleware.ts)   │  │  ├─ staging_test_runs            │
│  ├─ /api/internal/test-control        │  │  ├─ staging_test_identity_leases │
│  ├─ /sign-in (ClerkSignInWidget)      │  │  └─ Test-scoped domain entities  │
│  └─ /api/webhooks/mpesa/stk-callback  │  └──────────────────────────────────┘
└───────────────────┬───────────────────┘
                    │ HTTPS / TCP
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ Clerk Staging │       │ Upstash Redis │
│ Identity FAPI │       │ BullMQ Queues │
└───────────────┘       └───────────────┘
```

---

## 2. Complete Environment & Secrets Setup

The validation suite requires specific secrets synchronized across **GitHub Actions Secrets** (for the runner) and **Vercel Project Environment Variables** (for the deployed application).

### 2.1 GitHub Actions Secrets (`staging-e2e` Environment)

Configure these in **GitHub Repository $\rightarrow$ Settings $\rightarrow$ Environments $\rightarrow$ staging-e2e**:

| Secret Name                 | Example / Format                      | Purpose                                                      |
| :-------------------------- | :------------------------------------ | :----------------------------------------------------------- |
| `STAGING_E2E_BASE_URL`      | `https://staging.buildmarket.app`     | Target deployment URL (must be HTTPS)                        |
| `STAGING_E2E_ALLOWED_HOSTS` | `staging.buildmarket.app`             | Host allowlist preventing accidental execution on production |
| `INTERNAL_SERVICE_SECRET`   | `sec_int_...` (32+ char random hex)   | Constant-time HMAC verification on `/api/internal/*`         |
| `TEST_CONTROL_SECRET`       | `sec_tc_...` (32+ char random hex)    | Secret used to sign and verify test-control grant tokens     |
| `STAGING_AUTH_SECRET`       | `sec_stg_...`                         | Bypasses HTTP Basic Auth / perimeter protection on staging   |
| `DATABASE_URL`              | `postgresql://user:pass@host:5432/db` | Direct PostgreSQL connection string for runner cleanup sweep |

### 2.2 Vercel Staging Environment Variables

Configure these in **Vercel Project Settings $\rightarrow$ Environment Variables** scoped strictly to **Preview (Git Branch: `staging`)**:

| Variable Name                       | Required Scope      | Notes                                                                        |
| :---------------------------------- | :------------------ | :--------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Preview (`staging`) | **Direct / Session Pooler (port 5432)**. Do NOT point to loopback/localhost! |
| `DIRECT_URL`                        | Preview (`staging`) | Direct PostgreSQL connection for Prisma migrations                           |
| `INTERNAL_SERVICE_SECRET`           | Preview (`staging`) | Must match GitHub Actions runner secret identically                          |
| `TEST_CONTROL_SECRET`               | Preview (`staging`) | Must match GitHub Actions runner secret identically                          |
| `STAGING_AUTH_SECRET`               | Preview (`staging`) | Perimeter bypass cookie/header token                                         |
| `ENABLE_STAGING_TEST_CONTROL`       | Preview (`staging`) | Set to `true` to enable `/api/internal/test-control`                         |
| `DD_ENV`                            | Preview (`staging`) | Must be set to `staging`                                                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview (`staging`) | Staging Clerk publishable key (`pk_live_...` or `pk_test_...`)               |
| `CLERK_SECRET_KEY`                  | Preview (`staging`) | Staging Clerk secret key                                                     |
| `NEXT_PUBLIC_CLERK_FRONTEND_API`    | Preview (`staging`) | `https://clerk.staging.buildmarket.app`                                      |
| `REDIS_URL`                         | Preview (`staging`) | `rediss://:TOKEN@<host>.upstash.io:6379` (BullMQ TCP endpoint)               |

> [!CAUTION]
> **Vercel Deployment Immutability**: Vercel deployments are immutable snapshots. Adding or updating environment variables in the Vercel dashboard has **zero effect** on currently running deployments. You **must redeploy** the `staging` branch (or push an empty commit) for variable changes to activate.

---

## 3. Staging Identity Pool Setup

The staging environment maintains 4 dedicated, non-routable pool slots:

| Role           | Slot       | Email Address                          | Assigned Scenarios           |
| :------------- | :--------- | :------------------------------------- | :--------------------------- |
| `PROFESSIONAL` | `pro-1`    | `e2e_pro_1@staging.buildmarket.app`    | `onboarding`, `verification` |
| `PROFESSIONAL` | `pro-2`    | `e2e_pro_2@staging.buildmarket.app`    | `onboarding`, `verification` |
| `CLIENT`       | `client-1` | `e2e_client_1@staging.buildmarket.app` | `onboarding`                 |
| `CLIENT`       | `client-2` | `e2e_client_2@staging.buildmarket.app` | `onboarding`                 |

### 3.1 Clerk Dashboard Metadata Baseline

In Clerk Dashboard $\rightarrow$ **Users** $\rightarrow$ select user $\rightarrow$ **Metadata**:

```json
{
  "role": "PROFESSIONAL",
  "isOnboarded": false,
  "isProfileComplete": false
}
```

### 3.2 Database Identity Seeding

Execute direct SQL against the staging PostgreSQL database to register base user records:

```sql
INSERT INTO "users" (
  "id", "clerkId", "email", "role", "status", "isEmailVerified", "isProfileComplete", "updatedAt", "createdAt"
) VALUES (
  gen_random_uuid(),
  'user_3ItBP8JFyS2GsV7nVGxqyZRVbUD', -- Replace with Clerk User ID for pro-1
  'e2e_pro_1@staging.buildmarket.app',
  'PROFESSIONAL',
  'ONBOARDING',
  true,
  false,
  NOW(),
  NOW()
) ON CONFLICT ("clerkId") DO UPDATE SET
  "email" = EXCLUDED."email",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "updatedAt" = NOW();
```

---

## 4. Local Execution & Verification Guide

You can run the staging test harness locally on your workstation to reproduce CI issues without triggering remote workflows.

### 4.1 Step 1: Preflight Connectivity Check

Verify that the target staging site is deployed, accessible, and connected to its database:

```bash
node scripts/preflight-staging-db-check.mjs https://staging.buildmarket.app
```

**Expected Output:**

```text
[preflight] Probing https://staging.buildmarket.app/api/internal/test-control ...
[preflight] OK — deployment can reach its database (run run_...).
[preflight] Passed. Proceeding to full Cypress suite.
```

### 4.2 Step 2: Run a Targeted Scenario Locally

```bash
# Run onboarding & verification spec
pnpm -C apps/client exec cypress run \
  --spec "cypress/e2e/staging/01-onboarding-and-verification.cy.ts" \
  --env STAGING_RELEASE_E2E=true

# Run M-Pesa replay & idempotency spec
pnpm -C apps/client exec cypress run \
  --spec "cypress/e2e/staging/04-mpesa-replay-and-idempotency.cy.ts" \
  --env STAGING_RELEASE_E2E=true
```

### 4.3 Step 3: Run Emergency Cleanup Sweep

Sweep any stranded leases or test fixtures created during local testing:

```bash
node scripts/emergency-staging-cleanup.mjs
```

---

## 5. Comprehensive Troubleshooting Matrix

### Issue 1: `The application redirected to /sign-in?redirect_url=%2Fonboarding more than 20 times` or `500 MIDDLEWARE_INVOCATION_FAILED`

- **Observed In**: Specs `01`, `02`, `03`, `06`, `08`.
- **Root Cause**:
  1. Next.js Edge Middleware on `/onboarding` fails to recognize the user's session token (`auth().userId` is null), redirecting to `/sign-in`. In `/sign-in`, the Node.js server component _does_ recognize the session and redirects back to `/onboarding`, creating an infinite loop.
  2. In Clerk v7, passing `secretKey` into `clerkMiddlewareOptions` activates Dynamic Keys mode, which requires `CLERK_ENCRYPTION_KEY`. If missing on Vercel, Clerk throws `encryptionKeyMissing`, causing `500 MIDDLEWARE_INVOCATION_FAILED`.
- **Diagnostic Steps**:
  1. Inspect the Cypress failure screenshot under `apps/client/cypress/screenshots`.
  2. Verify if `CLERK_SECRET_KEY` is set on Vercel Preview (`staging`).
  3. Check if `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` matches the staging Clerk instance (`pk_live_Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk` or `pk_test_...`).
  4. Look for `MIDDLEWARE_INVOCATION_FAILED` in Cypress run logs or test-control handoffs.
- **Remediation**:
  - In `apps/client/middleware.ts`, ensure `secretKey` is NOT passed into `clerkMiddlewareOptions`; Clerk reads ambient `CLERK_SECRET_KEY` in static mode.
  - In `apps/client/components/auth/ClerkSignInWidget.tsx`, verify session ticket consumption completes and cookies flush before redirecting.
  - In `apps/client/cypress/support/staging-test-control.ts`, assert `__session` and `__client_uat` cookies are present before navigating away from `/sign-in`.

---

### Issue 2: `AssertionError: expected [ 200, 202 ] to include 500` (or `503`)

- **Observed In**: Spec `04` (`04-mpesa-replay-and-idempotency.cy.ts`).
- **Root Cause**: The M-Pesa webhook handler (`/api/webhooks/mpesa/stk-callback`) successfully creates an `MpesaCallbackEvent` in PostgreSQL, but crashes or fails closed with `503` when attempting to enqueue a background job to BullMQ via `addMpesaStkCallbackJob`. This occurs when `REDIS_URL` is unconfigured or unreachable.
- **Diagnostic Steps**:
  1. Check Vercel logs for `/api/webhooks/mpesa/stk-callback`. Look for:
     `[MpesaStkCallback] Failed to enqueue background job: Error: REDIS_URL is required for BullMQ connections`.
  2. Verify Upstash Redis connectivity:

     ```bash
     pnpm -C packages/redis run healthcheck
     ```

- **Remediation**:
  - Add `REDIS_URL=rediss://:TOKEN@<host>.upstash.io:6379` to Vercel Preview (`staging`) environment variables and trigger a redeployment.
  - Decouple webhook durability from queue enqueuing: once the callback is recorded in PostgreSQL, return HTTP 202 regardless of transient Redis connection states.

---

### Issue 3: `resetIdentityBaseline failed with status 409: All staging identity slots are currently leased`

- **Observed In**: Preflight or any spec setup.
- **Root Cause**: All 4 pool slots (`pro-1` / `e2e_pro_1`, `pro-2` / `e2e_pro_2`, `client-1` / `e2e_client_1`, `client-2` / `e2e_client_2`) are locked in `LEASED`, `RESETTING`, or `READY` states due to aborted test runs or unhandled exceptions.
- **Remediation**:
  1. Trigger manual emergency cleanup:

     ```bash
     node scripts/emergency-staging-cleanup.mjs
     ```

  2. Or release slots directly via SQL:

     ```sql
     UPDATE "staging_test_identity_leases"
     SET "state" = 'RELEASED', "releasedAt" = NOW()
     WHERE "state" IN ('LEASED', 'RESETTING', 'READY');
     ```

---

### Issue 4: `Deployment returned 404 (denial: ...)` on `/api/internal/test-control`

- **Observed In**: Preflight script or Cypress setup tasks.
- **Root Cause**:
  - `ENABLE_STAGING_TEST_CONTROL` is not set to `true` on Vercel.
  - `INTERNAL_SERVICE_SECRET` or `TEST_CONTROL_SECRET` in GitHub Actions does not match the value on Vercel.
  - Staging protection blocked the request because `STAGING_AUTH_SECRET` was missing.
- **Remediation**:
  1. Verify header pass-through in `preflight-staging-db-check.mjs`:
     `x-internal-secret`, `x-test-control-secret`, and `x-staging-secret`.
  2. Ensure `ENABLE_STAGING_TEST_CONTROL=true` in Vercel staging environment.

---

### Issue 5: `Deployment resolved database host to localhost/127.0.0.1`

- **Observed In**: Preflight script output.
- **Root Cause**: The running deployment on Vercel was built before `DATABASE_URL` was scoped to Preview (`staging`), causing Prisma to fall back to a local-dev default.
- **Remediation**:
  1. Confirm `DATABASE_URL` is set in Vercel under Project $\rightarrow$ Settings $\rightarrow$ Environment Variables with scope **Preview (staging)**.
  2. Redeploy the staging branch.

---

## 6. Emergency Disaster Recovery & Kill Switch

If the test-control system behaves unexpectedly or a security incident is suspected:

1. **Immediate API Revocation (Kill Switch)**:
   In Vercel Dashboard $\rightarrow$ Environment Variables:
   - Set `ENABLE_STAGING_TEST_CONTROL=false`.
   - Clear or rotate `TEST_CONTROL_SECRET` and `INTERNAL_SERVICE_SECRET`.
   - Redeploy immediately.
   - All calls to `/api/internal/test-control` will immediately fail closed with HTTP 404 and header `x-test-control-denial: not_staging_environment`.
   - With the strict AND-gate implemented in Phase 5, the kill switch is fail-closed regardless of whether `ddEnv === "staging"` or staging basic auth is active. Actual production (`isProd` without `isVercelPreview` and without `ddEnv === "staging"`) is unconditionally excluded.

2. **Purge Stranded Leases and Fixtures**:

   ```bash
   node scripts/emergency-staging-cleanup.mjs
   ```

3. **Session Invalidation**:
   In Clerk Dashboard $\rightarrow$ Users $\rightarrow$ filter by `@staging.buildmarket.app` $\rightarrow$ select **Revoke all active sessions**.
