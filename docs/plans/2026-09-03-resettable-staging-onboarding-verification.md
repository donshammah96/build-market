# Resettable Staging Onboarding and Verification Implementation Plan

**Goal:** Make the onboarding and verification staging E2E scenario mutate a dedicated, resettable test identity and prove the resulting public-trust boundary without exposing a production control plane or corrupting the Clerk identity pool.

**Architecture and Tier Alignment:**

- Target packages/apps: `packages/db`, `apps/client`, `apps/workers`, and the protected `staging-e2e` GitHub Environment.
- Relevant client ADRs: ADR-001 (identity/environment boundaries), ADR-002 (route adapters), ADR-003 (domain/repository layering), ADR-005 (observable outcomes), ADR-006 (privacy), ADR-008 (payments/webhooks), ADR-010 (worker boundary).
- All control actions remain staging/test-only under `/api/internal/test-control`; Cypress receives neither Clerk, database, nor provider credentials.
- The route validates the normal internal secret, a short-lived audience-bound run grant, the run’s allowlisted scenario, and a server-side test-identity lease before importing Clerk mutation code.

## User Review Required

1. Provision at least two dedicated Clerk identities per role in the protected staging instance: `e2e_client_<slot>@staging.buildmarket.app` and `e2e_pro_<slot>@staging.buildmarket.app`. They must use non-routable data, have no customer content, and be excluded from operational metrics and marketing.
2. Approve a dedicated `StagingTestIdentityLease` migration. A run may lease one identity at a time; a second active run cannot reset or authenticate the same identity.
3. Approve the reset baseline: Clerk public metadata, DB `User`, `OnboardingState`, professional profile/documents, verification decisions, notifications, and outbox records owned by the leased identity are restored to the documented baseline. The reset must never delete unowned data.
4. Configure the protected `staging-e2e` Environment with the Clerk backend credential required to update only the designated test-pool identities. It must not be exposed to browser tests, PRs, forks, repository secrets, or release verification.

## Baseline and Invariants

Each identity slot has an immutable server-side configuration record:

| Role           | Initial DB state                                               | Clerk metadata                                        | Expected public state                 |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `CLIENT`       | `ONBOARDING`, `NOT_STARTED`                                    | `{ role: "CLIENT", onboardingComplete: false }`       | Not discoverable as a professional    |
| `PROFESSIONAL` | `ONBOARDING`, `NOT_STARTED`, no mutable verification artifacts | `{ role: "PROFESSIONAL", onboardingComplete: false }` | Not publicly verified or discoverable |

The reset is idempotent. It rejects a non-active run, a scenario other than `onboarding` or `verification`, an expired/foreign lease, or a Clerk identity outside the configured test pool. It records only opaque IDs, slot names, and result codes; it never logs email, phone, raw verification documents, Clerk tickets, or grant tokens.

## Proposed Changes

### 1. Persist identity-pool configuration and leases

#### [MODIFY] `packages/db/prisma/schema.prisma`

#### [NEW] `packages/db/prisma/migrations/<timestamp>_add_staging_test_identity_leases/migration.sql`

#### [NEW] `packages/db/src/staging-test-runs/identity-contracts.ts`

- Add `StagingTestIdentityLease` with `id`, `stagingTestRunId`, `slot`, `role`, `userId`, `clerkId`, `state` (`LEASED`, `RESETTING`, `READY`, `RELEASED`, `FAILED`), `leaseExpiresAt`, `resetAt`, and `releasedAt`.
- Add unique active-lease protection for `(slot, state)` using a partial unique index for `LEASED`, `RESETTING`, and `READY`; add a unique relation to the run/slot. Do not add user-provided email or arbitrary Clerk IDs to the control payload.
- Add a typed, server-owned slot allowlist sourced from `STAGING_TEST_IDENTITY_SLOTS` as JSON with only `{ slot, role, email }`; validate at boot and reject production/test-disabled environments.
- Extend cleanup order: reset/release the lease before marking the run `CLEANED`; retain the audit row for evidence instead of deleting it.

- [ ] **RED:** Add database contract tests for active-lease exclusivity, scenario/role mismatch, stale lease rejection, and release idempotency.
- [ ] **VERIFY RED:** `pnpm -C packages/db exec vitest run src/staging-test-runs/__tests__/identity-contracts.test.ts`.
- [ ] **GREEN:** Implement schema, migration, typed slot contract, and pure state-transition helpers.
- [ ] **VERIFY GREEN:** Run the focused suite and `pnpm -C packages/db exec prisma validate`.

### 2. Add a persistence-only lease/reset repository

#### [NEW] `apps/client/app/lib/domains/testing/test-control/identity-repository.ts`

#### [MODIFY] `apps/client/app/lib/domains/testing/test-control/repository.ts`

- Produce these repository interfaces:

  ```ts
  leaseIdentity(input: {
    runId: string;
    scenario: "onboarding" | "verification";
    role: "CLIENT" | "PROFESSIONAL";
    now: Date;
  }): Promise<IdentityLease | null>;

  restoreIdentityBaseline(input: {
    leaseId: string;
    runId: string;
    baseline: IdentityBaseline;
  }): Promise<IdentityResetProjection>;

  releaseIdentityLease(runId: string): Promise<void>;
  ```

- `leaseIdentity` uses a transaction with a conditional update or `SELECT ... FOR UPDATE SKIP LOCKED`; it must not select by email supplied by Cypress.
- `restoreIdentityBaseline` owns only rows tied to the leased `userId`: reset `User` status/profile fields, upsert `OnboardingState`, delete documented test-only profile/verification rows, and remove run-owned notifications/outbox rows. It performs explicit counts before/after and returns a redacted projection.
- Do not delete the base `User` or the Clerk identity. The existing run-owned fixture cleanup remains responsible only for fixtures created by the run.

- [ ] **RED:** Repository integration tests with two concurrent lease attempts and a foreign run attempting reset/release.
- [ ] **VERIFY RED:** `pnpm client:test __tests__/lib/domains/testing/test-control.identity-repository.test.ts`.
- [ ] **GREEN:** Implement transactions and count assertions.
- [ ] **VERIFY GREEN:** Re-run the focused tests twice against an isolated database; the second reset must have the same projection.

### 3. Add a narrow Clerk baseline adapter

#### [NEW] `apps/client/app/lib/domains/testing/test-control/clerk-identity-adapter.ts`

#### [NEW] `apps/client/__tests__/lib/domains/testing/test-control.clerk-identity-adapter.test.ts`

- Expose `restoreClerkIdentityBaseline(lease: IdentityLease): Promise<Result<void, TestControlError>>`.
- Resolve the user strictly from the leased `clerkId`; assert the email remains one of the server-configured pool entries before calling Clerk.
- Set only the documented public/private metadata baseline and revoke all active sessions/sign-in tokens before issuing a new handoff ticket. Do not change password, primary email, MFA, organization memberships, or arbitrary Clerk profile fields.
- If Clerk reset fails, mark the lease `FAILED`, return a retriable `CLERK_BASELINE_RESET_FAILED` result, and do not issue a handoff ticket.

- [ ] **RED:** Tests for non-pool rejection, metadata exactness, session revocation, and Clerk failure marking the lease failed.
- [ ] **VERIFY RED:** `pnpm client:test __tests__/lib/domains/testing/test-control.clerk-identity-adapter.test.ts`.
- [ ] **GREEN:** Implement the adapter behind the staging/test environment gate.
- [ ] **VERIFY GREEN:** Focused tests plus `pnpm -C apps/client run check-types`.

### 4. Extend the test-control service and route

#### [MODIFY] `apps/client/app/lib/domains/testing/test-control/contracts.ts`

#### [MODIFY] `apps/client/app/lib/domains/testing/test-control/service.ts`

#### [MODIFY] `apps/client/app/api/internal/test-control/route.ts`

#### [MODIFY] `apps/client/__tests__/lib/domains/testing/test-control.service.test.ts`

#### [MODIFY] `apps/client/__tests__/api/internal/test-control.route.test.ts`

- Add action `reset-identity-baseline` with `{ runId, role }`; do not accept slot, email, Clerk ID, status, verification state, or raw baseline fields from callers.
- Add the action to the typed grant action enum. The route verifies that the grant scenario is `onboarding` or `verification`, and service rechecks it against the stored run before any repository/Clerk mutation.
- `resetIdentityBaseline` sequence: lease → mark resetting → reset Clerk → restore DB baseline → mark ready → issue a fresh Clerk sign-in ticket. On failure, revoke the ticket/session, mark failure, and return a redacted error.
- Extend `cleanupRun` to release the lease only after DB cleanup and ensure an expired run cannot retain an active session.

- [ ] **RED:** Route/service tests for production 404 before dynamic imports, grant action/scenario mismatch, expired run, duplicate lease, failed Clerk reset, and idempotent cleanup.
- [ ] **VERIFY RED:** `pnpm client:test __tests__/lib/domains/testing/test-control.service.test.ts __tests__/api/internal/test-control.route.test.ts`.
- [ ] **GREEN:** Implement the service orchestration and thin route dispatch.
- [ ] **VERIFY GREEN:** Focused tests, `pnpm -C apps/client run check-types`, and `pnpm run client:check-security-drift`.

### 5. Build authentic onboarding and verification staging scenarios

#### [MODIFY] `apps/client/cypress.config.ts`

#### [MODIFY] `apps/client/cypress/support/staging-test-control.ts`

#### [MODIFY] `apps/client/cypress/e2e/staging/01-onboarding-and-verification.cy.ts`

#### [NEW] `apps/client/cypress/e2e/staging/08-verification-public-trust.cy.ts`

- Add a Node-only `resetIdentityBaseline(role)` task and `cy.resetStagingIdentity(role)` command; only opaque result fields (`userId`, `role`, `state`) cross the task boundary.
- Onboarding scenario: reset the professional baseline, authenticate with the fresh ticket, submit the real onboarding form/API, assert `PENDING_VERIFICATION`, and verify that no public directory response returns a verified/trust signal before a review decision.
- Verification scenario: reset a distinct professional slot, execute the real verification decision through the approved staff/worker boundary, poll the public directory/projection until the expected verified signal appears, and assert that direct contact data remains subject to the existing disclosure rule.
- Each spec captures only redacted projection/JUnit data; screenshots must not include test email, documents, Clerk ticket URLs, or headers.

- [ ] **RED:** Cypress command unit tests for refusing browser-side secrets and a spec assertion that initial/reset state is not public.
- [ ] **VERIFY RED:** `pnpm client:test cypress/plugins/staging-test-control.test.ts`.
- [ ] **GREEN:** Implement task/command and two authentic staging specs.
- [ ] **VERIFY GREEN:** In the protected environment, run each spec twice: `pnpm -C apps/client exec cypress run --spec <spec> --env STAGING_RELEASE_E2E=true`.

### 6. Operational evidence, alerting, and rollback

#### [MODIFY] `.github/workflows/staging-e2e.yml`

#### [MODIFY] `apps/client/docs/STAGING_RELEASE_E2E_RUNBOOK.md`

#### [MODIFY] `apps/client/docs/STATUS.md`

#### [MODIFY] `docs/launch/GO_NO_GO.md`

#### [MODIFY] `docs/CHANGELOG.md` and `apps/client/docs/CHANGELOG.md`

- Add `verification` to the workflow dispatch choices and map onboarding/verification to their independent specs.
- Before Cypress, run a redacted readiness probe that validates pool-slot configuration and ensures no existing active lease. Fail closed with no secret echo.
- In `always()`, run cleanup and report per-run `leaseState`, `resetResult`, `cleanupResult`, hashed run ID, commit SHA, and scenario result in the existing release evidence manifest.
- Add an alert/runbook action for `FAILED` leases: disable staging E2E concurrency, rotate the affected slot manually, attach the redacted failure artifact, and do not rerun against that slot until reset evidence is attached.

- [ ] **RED:** Node tests for workflow scenario mapping and evidence manifest fields; static checks that no repository/PR secret is used.
- [ ] **VERIFY RED:** `node --test scripts/__tests__/generate-release-evidence.test.mjs`.
- [ ] **GREEN:** Update workflow, evidence generator, runbook, scorecard, and changelogs.
- [ ] **VERIFY GREEN:** Protected staging dry run with artifact digest review.

## Verification Plan

```powershell
pnpm -C packages/db exec vitest run src/staging-test-runs/__tests__/identity-contracts.test.ts
pnpm client:test __tests__/lib/domains/testing/test-control.identity-repository.test.ts
pnpm client:test __tests__/lib/domains/testing/test-control.clerk-identity-adapter.test.ts
pnpm client:test __tests__/lib/domains/testing/test-control.service.test.ts __tests__/api/internal/test-control.route.test.ts
pnpm -C packages/db exec prisma validate
pnpm -C apps/client run check-types
pnpm run client:check-security-drift
node --test scripts/__tests__/generate-release-evidence.test.mjs
pnpm run docs:check-launch-governance
```

Only in the protected `staging-e2e` Environment:

```powershell
pnpm -C apps/client exec cypress run --spec "cypress/e2e/staging/01-onboarding-and-verification.cy.ts" --env STAGING_RELEASE_E2E=true
pnpm -C apps/client exec cypress run --spec "cypress/e2e/staging/08-verification-public-trust.cy.ts" --env STAGING_RELEASE_E2E=true
pnpm run release:evidence:generate
```

The release remains no-go unless both scenarios pass twice consecutively, each leaves its lease `RELEASED`, cleanup is successful, and the uploaded redacted evidence manifest identifies the staging commit and artifact digests.
