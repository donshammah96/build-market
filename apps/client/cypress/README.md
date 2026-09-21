# Cypress E2E Testing Guide

Comprehensive guide for End-to-End (E2E) testing across the Build Market client application, covering local development testing, mock-based component tests, and the live **Staging Release E2E Suite**.

---

## 1. Test Suites Overview

The client application includes two distinct E2E testing paradigms:

| Suite                   | Target Environment                | Authentication                                    | Purpose                                                                          | Config File                 |
| :---------------------- | :-------------------------------- | :------------------------------------------------ | :------------------------------------------------------------------------------- | :-------------------------- |
| **Local E2E Specs**     | `http://localhost:3500`           | Mocked (`cy.mockOnboardingApi`)                   | Local form validation, UI flows, visual regressions                              | `cypress.config.ts`         |
| **Staging Release E2E** | `https://staging.buildmarket.app` | Real Clerk backend tickets (`stagingTestControl`) | Strict contract testing, auth transitions, webhook replay, and background queues | `cypress.staging.config.ts` |

---

## 2. Directory Structure

```text
apps/client/cypress/
├── e2e/
│   ├── onboarding-visual.cy.ts             # Visual regression for client onboarding
│   ├── professional-dashboard-visual.cy.ts # Visual regression for professional dashboard
│   ├── professional-onboarding.cy.ts       # Comprehensive onboarding form validation
│   └── staging/                            # 8-spec Staging Release E2E Suite
│       ├── 01-onboarding-and-verification.cy.ts
│       ├── 02-routing-and-masked-disclosure.cy.ts
│       ├── 03-review-eligibility.cy.ts
│       ├── 04-mpesa-replay-and-idempotency.cy.ts
│       ├── 05-capability-rollback.cy.ts
│       ├── 06-messaging.cy.ts
│       ├── 07-queue-recovery.cy.ts
│       └── 08-verification-public-trust.cy.ts
├── fixtures/                               # Static test fixtures (e.g. professional-form.json)
├── plugins/                                # Node-side Cypress plugin and task definitions
├── support/
│   ├── commands.ts                         # Custom UI and form commands
│   ├── e2e.ts                              # Global hooks, cookie management, and CSRF/UAT handling
│   ├── staging-test-control.ts             # Staging test control commands & identity leasing
│   └── component.ts                        # Cypress component test harness
├── cypress.config.ts                       # Base Cypress configuration
├── cypress.staging.config.ts               # Staging E2E runner configuration
└── tsconfig.json                           # TypeScript configuration for test files
```

---

## 3. Environment & Credentials

Local runs automatically load environment variables from `.env.local`, `apps/client/.env.local`, `.env`, and `apps/client/.env`.

### Required Variables for Staging Release E2E

| Variable                    | Description                                                                            | Source                                                            |
| :-------------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| `STAGING_E2E_BASE_URL`      | Target deployment URL (defaults to `https://staging.buildmarket.app`)                  | Vercel preview/staging domain                                     |
| `INTERNAL_SERVICE_SECRET`   | Secret authorizing `/api/internal/*` service calls                                     | Monorepo env (`INTERNAL_SERVICE_SECRET` or `INTERNAL_API_SECRET`) |
| `TEST_CONTROL_SECRET`       | Secret enabling the staging test-control router on Vercel                              | Monorepo env / GitHub Actions secrets                             |
| `STAGING_AUTH_SECRET`       | Secret value for `bm_staging_auth` cookie bypassing Cloudflare/edge staging protection | Monorepo env / GitHub Actions secrets                             |
| `STAGING_AUTH_USER`         | Basic auth username fallback for staging perimeter protection                          | Default: `buildmarket`                                            |
| `STAGING_AUTH_PASSWORD`     | Basic auth password fallback for staging perimeter protection                          | Monorepo env                                                      |
| `STAGING_E2E_ALLOWED_HOSTS` | Comma-separated whitelist of allowed targets (defaults to `staging.buildmarket.app`)   | Monorepo env                                                      |

---

## 4. Running Tests

### A. Local Development Specs (Mocked Auth)

Start the local server and run tests in interactive or headless mode:

```bash
# Interactive Cypress UI (starts dev server automatically)
pnpm --filter client test:e2e:open

# Headless mode for all local specs
pnpm --filter client test:e2e

# Targeted browser execution
pnpm --filter client cy:run:chrome
pnpm --filter client cy:run:firefox
```

### B. Live Staging Release E2E Suite

The staging suite runs against the deployed Vercel staging perimeter.

```bash
# 1. Verify deployment has promoted the target commit and all preflight probes pass
node scripts/wait-for-staging-deployment.mjs
node scripts/preflight-staging-db-check.mjs

# 2. Run the full 8-spec staging suite
pnpm --filter client test:staging-release-e2e

# 3. Or execute via Cypress CLI with custom baseUrl
pnpm -C apps/client exec cypress run \
  --config-file cypress.staging.config.ts \
  --config baseUrl=https://staging.buildmarket.app \
  --env STAGING_RELEASE_E2E=true
```

### C. Running Individual Staging Specs

To debug or verify a single staging spec during development:

```bash
# Spec 01: Onboarding and Verification Boundary
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/01-onboarding-and-verification.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 02: Lead Routing and Masked Contact Disclosure
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/02-routing-and-masked-disclosure.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 03: Project-Linked Review Eligibility
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/03-review-eligibility.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 04: M-Pesa Webhook Replay & Idempotency
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/04-mpesa-replay-and-idempotency.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 05: Capability Rollback & Feature Flag Gating
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/05-capability-rollback.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 06: Dual-Identity Participant Messaging
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/06-messaging.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 07: Queue Health & Asynchronous Worker Recovery
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/07-queue-recovery.cy.ts" --env STAGING_RELEASE_E2E=true

# Spec 08: Public Verification & Trust Tier Boundary
pnpm -C apps/client exec cypress run --config-file cypress.staging.config.ts --spec "cypress/e2e/staging/08-verification-public-trust.cy.ts" --env STAGING_RELEASE_E2E=true
```

---

## 5. Staging Suite Specifications Matrix

The 8 staging specs validate end-to-end business and architectural invariants against real backend services (PostgreSQL, Redis/BullMQ, Clerk FAPI, M-Pesa callbacks):

| Spec                                   | Target Invariant                  | Verifications Performed                                                                                                                                                    |
| :------------------------------------- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`01-onboarding-and-verification`**   | Identity Baseline & Gating        | Leases test identity, asserts baseline `NOT_STARTED`, verifies unonboarded user redirection and public API 404/403 exclusion.                                              |
| **`02-routing-and-masked-disclosure`** | Privacy & Lead Routing            | Seeds `lead-routing` scenario, verifies homeowner email is masked in pro inbox until explicit `/accept` mutation, verifies projection unmasking.                           |
| **`03-review-eligibility`**            | Review Submission Replay          | Verifies only completed run-owned project allows review submission; duplicate review attempt is rejected with 409/400 conflict.                                            |
| **`04-mpesa-replay-and-idempotency`**  | Financial Transaction Idempotency | Seeds pending STK transaction, dispatches callback webhook, asserts transition to `COMPLETED`, replays identical payload and asserts deduplication without double-credit.  |
| **`05-capability-rollback`**           | Feature Flag Safety               | Verifies system degrades safely or rolls back capabilities when administrative feature flag boundaries change.                                                             |
| **`06-messaging`**                     | Cross-Identity Thread Isolation   | Tests client sending a message in a private thread, switching session to professional identity via single-use ticket, and confirming receipt without cross-tenant leakage. |
| **`07-queue-recovery`**                | Async Worker Health               | Probes BullMQ queue backend via `/api/internal/queue-health`, verifying Redis connectivity and active consumer presence.                                                   |
| **`08-verification-public-trust`**     | Regulatory Trust Boundary         | Verifies professional trust tier and badges are only publicly disclosed when verified credentials satisfy NCA/regulatory criteria.                                         |

---

## 6. Staging Test Control Commands

The staging test control framework (`apps/client/cypress/support/staging-test-control.ts`) provides isolation between concurrent specs without hardcoding static test accounts:

```typescript
// 1. Initialize an isolated staging test run (scoped grant token)
cy.initStagingRun("lead-routing", "cypress-routing-e2e");

// 2. Reset leased identity baseline before testing
cy.resetStagingIdentity("PROFESSIONAL").then((identity) => {
  expect(identity.role).to.eq("PROFESSIONAL");
  expect(identity.state).to.eq("NOT_STARTED");
});

// 3. Authenticate leased staging user via single-use Clerk ticket
cy.loginStagingUser("PROFESSIONAL").then((session) => {
  expect(session.userId).to.be.a("string");
});

// 4. Seed run-scoped database fixtures (e.g. leads, message threads)
cy.seedStagingScenario("lead-routing").then(
  ({ routingEventId, clientEmail }) => {
    // Use seeded identifiers
  },
);

// 5. Seed and trigger simulated M-Pesa webhook callbacks
cy.seedStagingMpesa({ amount: 1500, role: "CLIENT" }).then(
  ({ checkoutRequestId }) => {
    cy.postStagingMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
        },
      },
    });
  },
);

// 6. Inspect run-owned projection state without cross-spec interference
cy.getStagingProjection().then((proj) => {
  expect(proj.run.state).to.eq("ACTIVE");
});

// 7. Poll projection state for asynchronous worker jobs
cy.pollStagingProjection(
  (proj) => {
    return (
      proj.fixtures.marketplaceLeads[0].routingEvents[0].contactDisclosedAt !==
      null
    );
  },
  { timeoutMs: 15000, intervalMs: 500 },
);

// 8. Inspect Redis/BullMQ background queue health
cy.checkStagingQueueHealth().then((health) => {
  expect(health.connected).to.be.true;
});

// 9. Clean up all run-owned entities in leaf-to-root dependency order
cy.cleanupStagingRun();
```

---

## 7. Preflight & Maintenance Scripts

Located in `scripts/`:

1. **`wait-for-staging-deployment.mjs`**:
   - Polls `/api/healthz` and `/api/health` until the target commit (or a direct git descendant that supersedes it) is active on Vercel.
   - Prevents running E2E suites against stale deployments.

   ```bash
   node scripts/wait-for-staging-deployment.mjs [EXPECTED_SHA]
   ```

2. **`preflight-staging-db-check.mjs`**:
   - Validates that the staging test-control kill switch (`FEATURE_STAGING_TEST_CONTROL_ENABLED`) is active.
   - Asserts that Vercel serverless functions can connect to the database.
   - Probes the Redis queue backend to ensure background consumers are active.

   ```bash
   node scripts/preflight-staging-db-check.mjs
   ```

3. **`emergency-staging-cleanup.mjs`**:
   - Sweeps expired, orphaned, or stranded test runs and associated leases directly from the database if a test process is abruptly terminated.

   ```bash
   node scripts/emergency-staging-cleanup.mjs
   ```

---

## 8. Architectural Invariants & Guardrails

- **Single-Use Ticket Precedence (C-1)**: Single-use tickets (`__clerk_ticket` query param) outrank ambient browser sessions. `ClerkSignInWidget` signs out stale identities and completes ticket exchange before redirecting to prevent identity bleeding between tests.
- **CSRF & Origin Enforcement**: `cy.request` is globally wrapped in `cypress/support/e2e.ts` to automatically attach the trusted `Origin` header on mutations and synchronize `__client_uat` timestamps with `__session` token `iat` claims.
- **Staging Perimeter Preservation**: Cookie clearing in test hooks restores `bm_staging_auth` so edge middleware allows browser navigation to protected staging preview routes.
- **No Skipping or Muting**: Modifying, weakening, skipping (`.skip()`), or muting assertions to mask staging flakes is strictly prohibited under repository engineering guidelines. Any failure must be diagnosed at the root cause and reproduced deterministically.
