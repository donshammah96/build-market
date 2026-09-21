# Staging Test-Control Authority & Cross-Service E2E Implementation Plan

**Goal:** Establish a staging-only, fail-closed test-control authority and authentic cross-service E2E suite that produces reproducible release evidence without exposing a production control plane, touching unowned records, or delivering test communications to real recipients.

**Architecture & Alignment:**

- Target applications/packages: `apps/client`, `apps/workers`, `apps/admin`, `packages/queue-server`, and `packages/db`.
- Relevant ADRs: ADR-001, ADR-002, ADR-003, ADR-004, ADR-006, ADR-008, ADR-010, ADR-ADMIN-001, ADR-ADMIN-002, ADR-ADMIN-008, ADR-ADMIN-012, and ADR-ADMIN-016.
- Trust boundary: Cypress is an untrusted browser client. It never receives database, queue, Clerk, provider, or durable internal-service credentials. The client route is an authenticated adapter; workers own queue inspection and chaos execution.

## User Review Required

1. Create a protected GitHub Environment named `staging-e2e`, approved by Platform Engineering and Marketplace Operations. It owns `STAGING_E2E_BASE_URL`, the staging-only grant issuer key, Clerk test-pool configuration, and sandbox-only M-Pesa callback credentials. Production/repository-level secrets are prohibited.
2. Approve a Prisma migration for `StagingTestRun` and explicit `stagingTestRunId` ownership relations on every seeded fixture. Prefixes are labels only, never cleanup selectors.
3. Approve a staging outbound test sink. Test-run email/SMS/WhatsApp/push must persist redacted delivery records and must not call customer-facing providers.
4. The staging E2E job mutates isolated staging data; it is separate from non-mutating `release:verify` and needs a workflow concurrency lock plus guaranteed cleanup.

## Security and lifecycle contract

### Environment and authentication

The test-control route is fail-closed outside staging/test. It returns a uniform 404 before importing Prisma, Clerk, queue, or test-control modules if the verified deployment environment is not staging and `NODE_ENV !== "test"`. The production guarantee is therefore denial before dependency use—not an inaccurate claim that production never ships route code.

The route stays within `/api/internal/**`: it first validates the normal internal-service secret, then a short-lived, audience-bound staging test-control grant. The grant contains run ID, allowed scenario/actions, staging audience, and expiry of at most five minutes. Cypress obtains it only through a Node-side task/proxy using GitHub Environment secrets; browser code receives no token or secret. The adapter is `POST` only, caps body size, uses `safeParse` on a discriminated action body, records correlation/audit data, and returns the same 404 for non-staging, invalid/expired grants, bad audiences, and unsupported actions.

### Durable ownership and cleanup

`StagingTestRun` stores opaque UUID, scenario, state (`ACTIVE`, `CLEANING`, `CLEANED`, `EXPIRED`), start/expiry/cleanup timestamps, Git SHA, workflow run ID, and a redacted actor label. Fixtures are seeded idempotently by `(stagingTestRunId, fixtureKind, externalKey)` in a transaction. Cleanup validates grant + ownership, transitions atomically to `CLEANING`, deletes only related rows in documented dependency order, verifies no owned rows remain, records `CLEANED`, and is retry safe. A worker expiry sweep cleans abandoned runs. `deleteMany({})`, prefix scans, table truncation, and caller-provided table names are prohibited.

### Queue, chaos, and outbound delivery

`packages/queue-server` owns a typed `StagingTestControlEnvelope`, backend-neutral queue projection, and bounded retry-fault policy. Only active staging runs may carry the envelope; it cannot alter queue name, payload, delay, attempts, or arbitrary processor behavior. `apps/workers` exposes a narrow internally authenticated control adapter and never permits the client to inspect `bullmq` tables or Redis keys. A named allowlisted processor may fail only until attempt 1–2, then must recover to exactly one terminal delivery.

For an active test run, outbound adapters write redacted delivery metadata to the staging sink instead of calling a provider. Tests assert sink records and absence of provider calls for verification notifications, lead alerts, and payment-support notifications.

## Proposed Changes

### 1. Persist staging-run ownership

#### [MODIFY] `packages/db/prisma/schema.prisma`

#### [NEW] `packages/db/prisma/migrations/<timestamp>_add_staging_test_runs/migration.sql`

#### [NEW] `packages/db/src/staging-test-runs/contracts.ts`

- Add `StagingTestRun` and owned fixture relations for onboarding, verification, leads/routing, messaging, reviews, callbacks, queue records, and outbound deliveries.
- Add active-run expiry and per-relationship indexes. Review cascade behavior; cleanup service decides dependency order.

- [ ] **RED:** Cross-run cleanup, duplicate seed-key idempotency, and ownership-predicate tests.
- [ ] **VERIFY RED:** `pnpm -C packages/db test -- staging-test-runs`.
- [ ] **GREEN:** Implement migration, DTOs, and persistence-only repositories.
- [ ] **VERIFY GREEN:** Focused tests and `pnpm -C packages/db exec prisma validate`.

### 2. Implement test-control domain service and route

#### [NEW] `apps/client/app/lib/domains/testing/test-control/{contracts,repository,service}.ts`

#### [NEW] `apps/client/app/api/internal/test-control/route.ts`

#### [MODIFY] `apps/client/app/lib/infrastructure/env.ts`

#### [NEW] focused service and route tests

- Allowlist scenarios: `onboarding`, `verification`, `lead-routing`, `messaging`, `review-eligibility`, `queue-recovery`, `mpesa-replay`, and `capability-rollback`.
- Produce `createRun`, `seedScenario`, `issueBrowserSessionHandoff`, `seedPendingMpesaTransaction`, `getRunProjection`, and `cleanupRun` as `Result<T, AppError>` interfaces.
- Reference pre-provisioned Clerk pool aliases only. Store non-routable email/phone values and no production-like documents.
- Dynamic-import domain code only after environment and credential/grant gates.

- [ ] **RED:** Disallowed scenario/action, expired grant/run, cross-run cleanup, idempotent seed, redaction, and no-production-import tests.
- [ ] **VERIFY RED:** `pnpm client:test __tests__/lib/domains/testing/test-control.service.test.ts __tests__/api/internal/test-control.route.test.ts`.
- [ ] **GREEN:** Implement thin HTTP adapter, service, and repository boundaries.
- [ ] **VERIFY GREEN:** Focused tests, `pnpm run client:check-env-contract`, `pnpm run client:check-security-drift`, and `pnpm run client:check-types`.

### 3. Add worker-owned queue control and outbound sink

#### [NEW] `packages/queue-server/src/staging-test-control.ts`

#### [NEW] `apps/workers/src/test-control/{service,outbound-sink}.ts`

#### [MODIFY] queue payload contracts/producers and affected worker processors

- Queue-server produces backend-neutral state; no app queries undocumented BullMQ/Redis internals.
- The worker validates run ownership/environment, applies bounded faults, and records redacted `test_run_id`/scenario/reason.
- The outbound sink replaces provider delivery solely for owned staging runs; normal traffic is unchanged.

- [ ] **RED:** Backend-neutral projection, inactive-run rejection, bounded retry/recovery, exactly-once terminal delivery, and no-provider-call tests.
- [ ] **VERIFY RED:** `pnpm -C packages/queue-server test -- staging-test-control` and `pnpm -C apps/workers exec vitest run src/test-control`.
- [ ] **GREEN:** Implement contracts, worker adapter, processor guard, and sink.
- [ ] **VERIFY GREEN:** Focused tests and `pnpm run workers:check-types`.

### 4. Build a non-secret Cypress harness

#### [MODIFY] `apps/client/cypress.config.ts`

#### [MODIFY] `apps/client/cypress/support/commands.ts`

#### [NEW] `apps/client/cypress/plugins/staging-test-control.ts`

- Require `STAGING_E2E_BASE_URL`, rejecting localhost and production hosts via an explicit allowlist.
- Use a Node Cypress task/proxy for credentials/grants. Commands create/seed a run, authenticate an opaque session handoff, and clean up in `after` plus an `always` CI fallback.
- Existing browser mocks remain for local UI tests; release specs cannot invoke them.

- [ ] **RED:** Host refusal, no browser secret exposure, and cleanup-on-failure tests.
- [ ] **VERIFY RED:** `pnpm client:test cypress/plugins/staging-test-control.test.ts`.
- [ ] **GREEN:** Implement the Node task and typed Cypress commands.
- [ ] **VERIFY GREEN:** Unit tests and staging dry-run.

### 5. Implement all release scenarios

#### [NEW] `apps/client/cypress/e2e/release/{onboarding-authentic,verification-authentic,lead-routing-masked-disclosure,messaging-eligibility,review-eligibility,queue-resilience,mpesa-callback-replay}.cy.ts`

#### [MODIFY] `apps/client/cypress/e2e/release/capability-rollback.cy.ts`

Every scenario has its own run and asserts browser behavior plus server/worker projection:

1. homeowner/professional onboarding yields expected role/status;
2. verification never exposes a premature public trust signal;
3. lead cohort routing retains contact/address/document masking until recorded consented disclosure;
4. only eligible routed participants can message;
5. a completed project permits one review while duplicate/unrelated attempts fail;
6. an allowlisted queue fault recovers with one terminal delivery and sink record;
7. a first M-Pesa callback creates one event/job while exact replay is accepted but does not create a second processing result; and
8. a reviewed capability rollback denies page/API/discovery/async/analytics behavior after disablement.

- [ ] **RED:** Implement one independent failing scenario at a time with fixture preconditions.
- [ ] **VERIFY RED:** `pnpm -C apps/client run test:staging-release-e2e -- --spec <spec>` in the protected job.
- [ ] **GREEN:** Implement only required control/service changes.
- [ ] **VERIFY GREEN:** Run each scenario twice for retry-safe provisioning/cleanup, then run the complete suite.

### 6. Generate immutable staging evidence

#### [MODIFY] `.github/workflows/ci.yml`

#### [MODIFY] `scripts/generate-release-evidence.mjs`

#### [MODIFY] `docs/launch/GO_NO_GO.md`

#### [MODIFY] `apps/client/docs/STAGING_RELEASE_E2E_RUNBOOK.md`

- Add a protected `staging-release-e2e` job gated by staging branch/ref, validation success, `staging-e2e` Environment approval, and fixture-run concurrency.
- Run cleanup in `always()`. Upload redacted JUnit/JSON reports and failure media as appropriate, then generate a manifest that digests every artifact and records Git SHA, environment, scenario result, hashed run ID, cleanup result, exclusions, owner, and next review.
- `release:verify` remains non-mutating and never invokes E2E. Missing/stale/failed E2E is a no-go evidence result.

- [ ] **RED:** Workflow/manifest tests for Environment protection, no PR/fork secret exposure, `always()` cleanup, artifact digest inclusion, and production-host refusal.
- [ ] **VERIFY RED:** `node --test scripts/__tests__/generate-release-evidence.test.mjs`.
- [ ] **GREEN:** Implement workflow and manifest integration.
- [ ] **VERIFY GREEN:** Staging dry run, artifact redaction/digest review, and immutable artifact link in the scorecard.

## Verification Plan

## Implementation update â€” 2026-09-03

Implemented: the fail-closed test-control route, run/grant lifecycle, explicit
fixture ownership and cleanup, redacted outbound sink, queue inspection, and
protected Cypress tasks. The routing/masked-disclosure, participant-messaging,
M-Pesa callback replay, and capability-rollback scenarios now call real staging
adapters and assert their run projection. `MarketplaceLead` and
`MessageThread` were added as owned fixture roots because they are required for
those cross-service paths.

This plan deliberately does **not** mark mutation of a resettable
onboarding/verification identity green. The application has no per-run identity
reset adapter, so the runbook and status page retain it as a no-go release
control. A page visit is not completion evidence. Project-linked review
eligibility and bounded queue fault/recovery now have implementation coverage,
but still require a protected staging artifact before a go decision.

```powershell
pnpm client:test __tests__/lib/domains/testing/test-control.service.test.ts __tests__/api/internal/test-control.route.test.ts
pnpm -C packages/db exec prisma validate
pnpm -C packages/queue-server test -- staging-test-control
pnpm -C apps/workers exec vitest run src/test-control
pnpm run client:check-env-contract
pnpm run client:check-security-drift
pnpm run workers:check-types
node --test scripts/__tests__/generate-release-evidence.test.mjs
pnpm run docs:check-launch-governance
pnpm run release:verify
```

Only in the protected staging job:

```powershell
$env:STAGING_E2E_BASE_URL = 'https://<approved-staging-host>'
pnpm -C apps/client run test:staging-release-e2e
pnpm run release:evidence:generate
```

Evidence must be redacted: no grants, credentials, raw payment callbacks, customer contact details, or fixture documents may enter reports or artifacts.
