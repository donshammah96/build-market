# P0 Launch Documentation and Toolchain Hardening Implementation Plan

**Goal:** Implement P0-1 through P0-4 with current, auditable launch documentation and a CI-enforced Node 24/documentation-governance contract.

**Architecture & Tier Alignment:**

- Target: repository governance, `apps/workers`, and release tooling
- Domain slices: documentation lifecycle, worker operations, release evidence
- Relevant ADRs: client ADR-009 and ADR-010; admin ADR-ADMIN-010 through ADR-ADMIN-016
- Boundary: no application business logic, server-action, route, DTO, database schema, or queue-payload change

## User Review Required

The approved design selects Node 24 as the only supported runtime. Runtime references in active CI, Dockerfiles, manifests, and onboarding docs must converge to Node 24; historical/archive records may retain their historical context when marked as such.

## Proposed Changes

### 1. Add the documentation-governance checker and its fixture tests

#### [NEW] `scripts/check-launch-documentation-governance.mjs`

- **Input:** repository root plus an optional fixture-root argument for tests
- **Output:** zero when every governance rule passes; concise file/rule failures and non-zero otherwise
- **Rules:** ADR inventory/metadata, canonical status metadata, launch scorecard evidence, current worker runbook link, and Node 24 active runtime configuration

- [x] **Step 1: Write the failing behavior tests**
      Create Node test fixtures that represent a valid minimal repository and one invalid case for each rule. The test break to catch is a checker that silently accepts a missing ADR metadata field, incomplete index, incomplete status evidence, unreferenced scorecard control, missing worker recovery runbook, or Node 20 active runtime configuration.

- [x] **Step 2: Verify RED**
      Run: `node --test scripts/__tests__/check-launch-documentation-governance.test.mjs`
      Expected: FAIL because the checker module/CLI does not exist.

- [x] **Step 3: Implement the minimal checker**
      Resolve paths relative to the supplied root, collect all violations deterministically, print each violation, and use exit code `1` only when violations exist. Do not mutate files.

- [x] **Step 4: Verify GREEN**
      Run: `node --test scripts/__tests__/check-launch-documentation-governance.test.mjs`
      Expected: PASS with all valid and invalid fixture behaviors asserted.

- [x] **Step 5: Wire root package and CI**
      Add a non-mutating root script and execute it from the existing CI validation path after checkout/install. Preserve existing CI commands and cache behavior.

### 2. Establish complete ADR authority and metadata

#### [MODIFY] `README.md`, `.agent/DOCUMENT-HIERARCHY.md`, `.agent/ADMIN-ARCHITECTURE.md`, `.github/copilot-instructions.md`

- **Interfaces produced:** an explicit complete index for client ADR-001..ADR-010 and admin ADR-ADMIN-001..ADR-ADMIN-016
- **Error contract:** the checker rejects missing or stale index entries

- [x] **Step 1: Update all current ADRs**
      Add `Status`, `Owner`, and `Next review` metadata consistently without modifying their decision rationale. Use `Accepted` for current ADRs unless the decision itself explicitly marks it superseded/deprecated.

- [x] **Step 2: Update authority references**
      Replace obsolete upper bounds and ensure the root and app architecture guidance point to the full indexes.

- [x] **Step 3: Verify against the real repository**
      Run: `pnpm run docs:check-launch-governance`
      Expected: PASS with an exhaustive current ADR set.

### 3. Publish worker operations and recovery procedures

#### [MODIFY] `apps/workers/README.md`

#### [NEW] `apps/workers/docs/QUEUE_RECOVERY_RUNBOOK.md`

- **Interfaces produced:** health semantics and queue recovery procedure for operations
- **Evidence consumed:** `apps/workers/src/health.ts`, `src/index.ts`, processor code, and existing worker tests

- [x] **Step 1: Reconcile documentation with implementation**
      Describe process liveness separately from aggregate readiness, list Redis/PostgreSQL/BullMQ/NATS checks, and identify the health endpoint as an aggregate readiness signal rather than a recent-job-success proof.

- [x] **Step 2: Document maintenance semantics and queue recovery**
      For each active processor/queue, state the actual effect and exclusions; provide owner role, detection, pause/restart/recovery, and verification procedure. Do not claim erasure/anonymization/asset deletion beyond implementation evidence.

- [x] **Step 3: Verify worker behavior and documentation contract**
      Run: `pnpm --filter workers test __tests__/health.test.ts __tests__/processors.test.ts`
      Run: `pnpm run docs:check-launch-governance`
      Expected: PASS; checker finds the required runbook link.

### 4. Establish canonical current status and launch evidence

#### [NEW] `apps/client/docs/STATUS.md`, `apps/admin/docs/STATUS.md`, `apps/verification-ops/docs/STATUS.md`, `apps/workers/docs/STATUS.md`

#### [NEW] `docs/launch/GO_NO_GO.md`

#### [MODIFY] `docs/MVP_LAUNCH_AUDIT_AND_HARDENING.md`, `docs/MVP_LAUNCH_RECOMMENDATIONS.md`

- **Interfaces produced:** one current evidence document per deployable application and a single launch go/no-go scorecard
- **Required fields:** Status, Scope, Evidence date, Git SHA, Environment, Commands and results, Owner, Known exclusions, Next review

- [x] **Step 1: Create current-status documents**
      Use the exact required evidence fields, explicitly state that unexecuted items remain pending, and link historical progress/autopsy records as non-current supporting context.

- [x] **Step 2: Create/update launch scorecard evidence**
      Every criterion names supporting ADRs and controls; the status is evidence-scoped and never claims public launch approval without the listed proof.

- [x] **Step 3: Mark historical records as historical where necessary**
      Add small status banners/links only to currently misleading progress or autopsy documentation. Do not rewrite historical facts.

- [x] **Step 4: Verify governance contract**
      Run: `pnpm run docs:check-launch-governance`
      Expected: PASS with every canonical document and scorecard control referenced.

### 5. Converge and enforce the Node 24 toolchain

#### [MODIFY] `.nvmrc`, active package manifests, active Dockerfiles, `.github/workflows/*.yml`, root/app READMEs

- **Runtime contract:** Node.js `24.x` only
- **Error contract:** a divergent active runtime reference causes the governance check and CI to fail

- [x] **Step 1: Write/assert the failing Node mismatch fixture**
      Confirm the fixture test fails when active runtime configuration uses Node 20.

- [x] **Step 2: Update active runtime selections**
      Change `.nvmrc`, package engine ranges, Docker bases, CI action setup, and current READMEs to Node 24. Keep disabled/archived historical context only when clearly marked as non-active.

- [x] **Step 3: Verify runtime consistency**
      Run: `pnpm run docs:check-launch-governance`
      Expected: PASS and report Node 24 compliance.

### 6. Update changelogs and execute release verification

#### [MODIFY] `docs/CHANGELOG.md`, `apps/workers/docs/CHANGELOG.md`, and application changelogs whose current-status or architecture documentation changes

- [x] **Step 1: Add changelog entries**
      Record the governance checker, ADR index, worker operations runbook, current-status contract, and Node 24 convergence in the appropriate unreleased sections.

- [x] **Step 2: Run focused proof**
      Run: `node --test scripts/__tests__/check-launch-documentation-governance.test.mjs`
      Run: `pnpm run docs:check-launch-governance`
      Run: `pnpm --filter workers test __tests__/health.test.ts __tests__/processors.test.ts`

- [x] **Step 3: Run repository quality gates appropriate to changed code**
      Run: `pnpm run client:tsc-noemit`
      Run: `pnpm run admin:check-types`
      Run: `pnpm run client:report-security-drift:strict`
      Run: `pnpm run admin:report-security-drift:strict`

## Verification Plan

### Automated Tests

- `node --test scripts/__tests__/check-launch-documentation-governance.test.mjs`
- `pnpm run docs:check-launch-governance`
- `pnpm --filter workers test __tests__/health.test.ts __tests__/processors.test.ts`
- `pnpm run client:tsc-noemit`
- `pnpm run admin:check-types`
- `pnpm run client:report-security-drift:strict`
- `pnpm run admin:report-security-drift:strict`

### Manual Review

- Confirm no active Node 20 runtime selection remains in files covered by the checker.
- Confirm the worker recovery runbook contains no environment-specific endpoints or credentials.
- Confirm each status page scopes its claim to its listed evidence and exclusions.
