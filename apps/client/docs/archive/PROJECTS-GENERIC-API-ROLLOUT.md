# Projects Generic API Rollout

Last updated: 2026-04-13

## Purpose

Document the completed staged rollout for canonical generic projects APIs (`/api/projects/**`) and the follow-through actions required for post-cutover stability.

## Current State

- Generic read and mutation paths are now always enabled for the browser facade and canonical domain client.
- Transitional rollout gates (`NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API`, `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS`) are retired from runtime client behavior.
- Monitoring and stability controls are now enforced through adapter/domain contracts, targeted suites, and operational telemetry instead of feature-flag gating.

## Rollout Stages

1. Stage 0: Development Safety - Completed

- Scope: local development only.
- Read paths: enabled.
- Mutation paths: enabled.
- Exit criteria:
  - `__tests__/api/projects` green.
  - `__tests__/lib/projects-client-gate.test.ts` green with always-on generic method coverage.

1. Stage 1: Staging Full Path - Completed

- Scope: staging and pre-production.
- Read paths: enabled.
- Mutation paths: enabled.
- Validation:
  - Full projects API suite pass.
  - Regression checks for idempotency and optimistic-lock mutation flows.
  - Basic synthetic create/update/delete/milestone/escrow exercises.

1. Stage 2: Production Canary - Completed

- Scope: small controlled user cohort.
- Read paths: enabled.
- Mutation paths: enabled for canary.
- Monitoring:
  - 4xx/5xx rates on `/api/projects/**` writes.
  - Idempotency conflict rate (`409`) trend.
  - Optimistic lock precondition/conflict patterns (`428` / conflict responses).

1. Stage 3: Production General Availability - Completed

- Scope: all production traffic.
- Read paths: enabled.
- Mutation paths: enabled.
- Follow-up:
  - Remove transitional docs language around deferred generic API rollout.
  - Retire rollout-gate semantics and tests that assume read-only generic API mode.

## Environment Matrix

- `development`: generic projects reads and mutations enabled
- `test`: generic projects reads and mutations enabled
- `staging`: generic projects reads and mutations enabled
- `production`: generic projects reads and mutations enabled

## Rollback

If mutation regressions are detected after GA cutover:

1. Roll back the affected deployment revision.
2. Re-run projects API and projects client suites against the rollback candidate.
3. Re-open rollout triage with mutation-path telemetry and restore once regression root cause is fixed.

## Verification Commands

```bash
pnpm -C apps/client vitest --run __tests__/api/projects
pnpm -C apps/client exec vitest --run __tests__/lib/projects-client-split.test.ts __tests__/lib/projects-client-contracts.test.ts __tests__/lib/projects-client-gate.test.ts __tests__/lib/projects-client-facade-gate.test.ts
```

## Monitoring Evidence

For Phase 2 Acceptance Criterion 2 evidence capture and threshold checks, use:

- `apps/client/scripts/summarize-project-mutation-health.mjs`

Example command:

```bash
pnpm -C apps/client run report:projects-mutation-health -- --input <path-to-ndjson-log>
```

Evidence windows to capture:

1. Canary day 1-2 (staging)
2. Broad rollout day 1-2 (production)

Signals required per window:

1. Write 5xx rate
2. 409 idempotency conflict rate
3. 428 and version-related 409 optimistic-lock conflict rate
