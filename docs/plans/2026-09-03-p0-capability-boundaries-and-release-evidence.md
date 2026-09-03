# P0 Capability Boundaries and Release Evidence Implementation Plan

**Goal:** Make deferred MVP verticals fail closed across public entry points and produce immutable, non-mutating staging release evidence.

**Architecture & Tier Alignment:**

- Target applications: `apps/client`, `apps/admin`, `apps/workers`, root CI/tooling.
- Domain slices: capability policy (new shared client policy module), stores, properties, Idea Books, professional CPD, projects/escrow, notifications, M-Pesa, release governance.
- Relevant ADRs: client ADR-002, ADR-003, ADR-004, ADR-006, ADR-008, ADR-010; admin ADR-ADMIN-001, ADR-ADMIN-002, ADR-ADMIN-008, ADR-ADMIN-012, ADR-ADMIN-016.
- Route handlers remain thin HTTP adapters. The reusable capability policy supplies a typed decision; domain services retain business logic and repositories remain persistence-only. Admin mutations continue through `safeAction` and create existing declarative audit records.

## User Review Required

- The dormant set is stores/materials, properties, Idea Books, CPD, wallets/escrow, and platform custody. All start disabled in staging and production. Enabling an entry is a reviewed environment configuration change, not an admin UI toggle.
- No workflow may run against production. Staging E2E requires separately provisioned test actors, fixtures, and non-production provider credentials before it can be made required.
- GitHub Actions artifacts provide the immutable release-evidence record. This plan deliberately does not add a signing key; manifests are bound to their commit/run and content digests.

## Proposed Changes

### 1. Establish the typed capability policy

#### [NEW] `apps/client/app/lib/capabilities/registry.ts`

- **Interfaces produced:** `MvpCapability`, `CapabilityState`, `getCapabilityDecision(capability)`, `capabilityForPath(pathname)`, `isCapabilityLive(capability)`, `getCapabilityTelemetryAttributes(capability)`.
- Registry data records ownership, default-off state, route/API prefixes, discovery visibility, async-delivery eligibility, and admin lifecycle label.
- Keep all raw environment access in `apps/client/app/lib/infrastructure/env.ts`; the registry receives typed booleans only.

- [ ] **Step 1: Write failing registry tests** in `apps/client/__tests__/lib/capabilities/registry.test.ts` that assert every deferred capability is default-disabled, mapped paths resolve to the correct capability, unknown paths are unaffected, and a test override produces a live decision.
- [ ] **Step 2: Verify RED** with `pnpm --filter client test -- __tests__/lib/capabilities/registry.test.ts`.
- [ ] **Step 3: Add the minimal registry and typed decision helpers.** Define all six dormant capabilities; do not embed policy branches in pages or routes.
- [ ] **Step 4: Add typed environment declarations/defaults** in `apps/client/app/lib/infrastructure/env.ts`, and update `apps/client/scripts/check-env-contract.mjs` fixtures only if the contract checker requires the new declarations.
- [ ] **Step 5: Verify GREEN and typecheck** with `pnpm --filter client test -- __tests__/lib/capabilities/registry.test.ts` and `pnpm run client:check-types`.

### 2. Deny deferred pages and APIs at the edge

#### [MODIFY] `apps/client/middleware.ts`
#### [MODIFY] `apps/client/app/lib/security/middleware/route-matcher.ts`
#### [NEW] `apps/client/__tests__/middleware/capability-boundary.test.ts`

- **Interfaces consumed:** `capabilityForPath()` and `getCapabilityDecision()`.
- **Interfaces produced:** a uniform 404-style document/API response before auth/onboarding routing for disabled capability prefixes.
- Register public and authenticated paths for `/stores`, `/properties`, `/idea-books`, professional portal store/property settings, `/api/stores`, `/api/properties`, `/api/idea-books`, `/api/professionals/cpd`, `/api/v1/market-data/materials-price-index`, and `/api/projects/[id]/escrow/**`. Cover every current handler in `api/stores/{route,me/route,[id]/route,[id]/documents/route,[id]/documents/[documentId]/route}.ts`, `api/properties/**/route.ts`, `api/idea-books/**/route.ts`, `api/professionals/cpd/route.ts`, and `api/projects/[id]/escrow/**/route.ts`; the test asserts this route inventory exhaustively rather than relying on navigation.

- [ ] **Step 1: Write failing middleware tests** for page deep links, authenticated API calls, public API calls, and a live test override. Assert status/body shape does not reveal disabled state.
- [ ] **Step 2: Verify RED** with `pnpm --filter client test -- __tests__/middleware/capability-boundary.test.ts`.
- [ ] **Step 3: Implement a small middleware guard** before public/protected API classification; use `NextResponse.json({ error: "Not found" }, { status: 404 })` for APIs and a rewritten/not-found document response consistent with Next middleware constraints for pages.
- [ ] **Step 4: Extend route-classification tests** so unclassified paths remain fail closed and capability matching cannot broaden unrelated API access.
- [ ] **Step 5: Verify GREEN** with `pnpm --filter client test -- __tests__/middleware/capability-boundary.test.ts __tests__/middleware/route-matrix.test.ts __tests__/middleware/middleware.test.ts`.

### 3. Add server-adapter defense in depth

#### [NEW] `apps/client/app/lib/api/capability-guard.ts`
#### [MODIFY] affected route handlers under `apps/client/app/api/stores/**`, `apps/client/app/api/properties/**`, `apps/client/app/api/idea-books/**`, `apps/client/app/api/professionals/cpd/**`, `apps/client/app/api/v1/market-data/materials-price-index/**`, and `apps/client/app/api/projects/**/escrow/**`
#### [MODIFY] affected server actions under `apps/client/app/actions/`

- **Interfaces produced:** `denyDisabledCapability(capability): NextResponse | null` and `requireLiveCapability(capability): Result<void, AppError>`.
- Route handlers call the HTTP helper before parsing or persistence. Server actions/domain entry points use the `Result` helper so non-middleware execution cannot bypass policy.

- [ ] **Step 1: Add failing tests** beside existing `__tests__/api/stores/route.test.ts`, `__tests__/api/properties/*.test.ts`, Idea Books/API tests, and project escrow tests that prove a disabled feature does not call its service/repository.
- [ ] **Step 2: Verify RED** with the focused Vitest files.
- [ ] **Step 3: Implement the guards and insert them at the adapter boundary.** Preserve existing auth, validation, idempotency, and domain error contracts for live capabilities.
- [ ] **Step 4: Verify GREEN** with `pnpm --filter client test -- __tests__/api/stores/route.test.ts __tests__/api/properties/property-id.route.test.ts __tests__/api/projects` plus the new focused tests.
- [ ] **Step 5: Run client typecheck** with `pnpm run client:check-types`.

### 4. Remove dormant content from discovery and label analytics

#### [MODIFY] `apps/client/app/layout.tsx`
#### [MODIFY] `apps/client/app/lib/domains/search/service.ts`
#### [MODIFY] `apps/client/app/lib/analytics/professional-funnel-sink.ts`
#### [NEW] `apps/client/__tests__/lib/capabilities/discovery-and-analytics.test.ts`

- The current site metadata robots policy and any generated sitemap implementation must use `isCapabilityLive`; add a dedicated `app/sitemap.ts` only if dynamic sitemap generation is introduced during the route inventory.
- Search services must only emit capability-live results. Analytics sinks receive the registry attributes and never classify dormant traffic as conversion/engagement.

- [ ] **Step 1: Write failing discovery/analytics tests** for disabled stores/properties/Idea Books/CPD and a live override, checking that no dormant URL/result is emitted and telemetry includes `capability_state: "disabled"`.
- [ ] **Step 2: Verify RED** with `pnpm --filter client test -- __tests__/lib/capabilities/discovery-and-analytics.test.ts`.
- [ ] **Step 3: Implement shared discovery filtering and telemetry enrichment.** Do not add client-only flags or raw `process.env` reads.
- [ ] **Step 4: Verify GREEN and security drift** with the focused test, `pnpm run client:check-env-contract`, and `pnpm run client:check-security-drift`.

### 5. Suppress deferred async work and external delivery

#### [NEW] `apps/workers/src/capabilities/guard.ts`
#### [MODIFY] `apps/workers/src/processors/price-index.processor.ts`
#### [MODIFY] `apps/workers/src/domains/mpesa/settlement.ts`
#### [MODIFY] feature-specific notification/email producer call sites identified by the route/domain inventory
#### [NEW] `apps/workers/src/capabilities/__tests__/guard.test.ts`

- **Interfaces produced:** `shouldProcessCapabilityWork(capability, source): CapabilityWorkDecision` and structured suppression logging with capability/source/reason/correlation ID.
- Guard before queue submission and before external/in-app delivery. Suppression returns a successful no-op result, never retries and never exposes customer data in logs.

- [ ] **Step 1: Write failing worker tests** that assert disabled materials-price-index and escrow work do not query/update records, enqueue jobs, create notifications, or call email/SMS providers; assert live overrides preserve existing behavior.
- [ ] **Step 2: Verify RED** with `pnpm --filter workers test -- src/capabilities/__tests__/guard.test.ts src/processors/__tests__/mpesa-stk.processor.test.ts`.
- [ ] **Step 3: Implement the worker guard using validated worker configuration** and apply it at producer/processor boundaries. Keep queue payload types unchanged unless a source capability field is absent; if added, version the payload and test backward compatibility.
- [ ] **Step 4: Verify GREEN** with the focused tests and `pnpm run workers:check-types`.

### 6. Make admin visibility explicitly dormant and prevent mutations

#### [MODIFY] `apps/admin/src/lib/config/feature-flags.ts`
#### [MODIFY] `apps/admin/src/lib/security/route-registry.ts`
#### [MODIFY] existing stores/properties/verification admin actions under `apps/admin/src/actions/admin/` and their domain services
#### [NEW] `apps/admin/__tests__/config/mvp-capabilities.test.ts`

- **Interfaces consumed:** server capability state published by the same environment contract; never a `NEXT_PUBLIC` client value as an authority decision.
- **Interfaces produced:** `getAdminCapabilityStatus()` for labels and a `safeAction`-compatible denial result with append-only audit record for blocked mutations.

- [ ] **Step 1: Write failing tests** showing authorized operators can see a dormant label/read-only inventory while create/verify/publish mutations are denied and audited; prove live override restores the normal path.
- [ ] **Step 2: Verify RED** with `pnpm --filter admin test -- __tests__/config/mvp-capabilities.test.ts` plus relevant action tests.
- [ ] **Step 3: Implement the status resolver and action/domain guard.** Do not place Prisma calls in actions or modify role/capability resolution.
- [ ] **Step 4: Verify GREEN** with focused tests, `pnpm run admin:check-types`, and `pnpm run admin:check-governance`.

### 7. Define non-mutating release verification and manifest generation

#### [NEW] `scripts/generate-release-evidence.mjs`
#### [NEW] `scripts/__tests__/generate-release-evidence.test.mjs`
#### [MODIFY] `package.json`
#### [MODIFY] `.gitignore`

- **Interfaces produced:** `pnpm run release:verify` and `pnpm run release:evidence:generate`; manifest schema version, SHA-256 report digest list, run metadata, redacted environment name, and result.
- `release:verify` composes only non-mutating commands, beginning with the existing `ci:local` contract plus focused P0 capability tests. `format` remains write-only developer tooling and is excluded.
- Generator refuses dirty trees, missing `RELEASE_EVIDENCE_ENVIRONMENT`, unavailable Git SHA, failed command reports, or secrets/non-allowlisted environment values.

- [ ] **Step 1: Write failing Node tests** for dirty-tree refusal, missing environment refusal, deterministic valid manifest, digest changes, secret redaction, and command allowlist enforcement.
- [ ] **Step 2: Verify RED** with `node --test scripts/__tests__/generate-release-evidence.test.mjs`.
- [ ] **Step 3: Implement the generator and root scripts.** Write into ignored `.release-evidence/`; accept a CI-provided output directory only after validating it stays inside the workspace.
- [ ] **Step 4: Verify GREEN** with the Node tests, `pnpm run release:verify`, and `git diff --exit-code` to prove no formatter write occurs.

### 8. Store immutable staging release evidence in CI

#### [MODIFY] `.github/workflows/ci.yml`
#### [MODIFY] `docs/launch/GO_NO_GO.md`

- Add a staging-only release-evidence job after validation and staging test prerequisites. It invokes `release:verify`, generates the manifest with `RELEASE_EVIDENCE_ENVIRONMENT=staging`, validates digests, uploads only allowlisted reports, and sets explicit artifact retention.
- Pin `actions/upload-artifact`; if GitHub artifact attestation is supported by repository policy, use the pinned action with minimum `attestations: write` permissions. Otherwise record immutable run URL, artifact ID/digest, retention, and commit SHA in the manifest without claiming cryptographic signing.

- [ ] **Step 1: Add a workflow static test/fixture** in `scripts/__tests__/generate-release-evidence.test.mjs` or a dedicated Node check that fails if the job invokes `validate`, lacks staging branch/environment guards, or uploads an unvalidated manifest.
- [ ] **Step 2: Verify RED** with its focused Node test.
- [ ] **Step 3: Add the CI job and scorecard evidence-link format.** Ensure PRs do not get staging credentials or release artifacts.
- [ ] **Step 4: Verify GREEN** with the static workflow test, `pnpm run docs:check-launch-governance`, and GitHub Actions workflow syntax/action-pin checks already present in CI.

### 9. Build a deterministic staging E2E release suite

#### [NEW] `apps/client/cypress/e2e/release/` scenario specs and support commands
#### [MODIFY] `apps/client/cypress.config.ts`
#### [MODIFY] `apps/client/package.json`
#### [NEW] `apps/client/docs/STAGING_RELEASE_E2E_RUNBOOK.md`

- **Interfaces produced:** `pnpm --filter client test:staging-release-e2e` using `STAGING_E2E_BASE_URL`, isolated run IDs, fixture setup/teardown, and JUnit/JSON reports that are safe for release evidence.
- Implement scenarios in independent specs: onboarding, verification, lead routing/masked disclosure, messaging, review eligibility, queue failure/recovery, M-Pesa callback replay, and capability rollback.
- The test harness must use a staging-only provisioning endpoint or existing protected seed mechanism; do not add production credentials to Cypress or publish test fixture identifiers.

- [ ] **Step 1: Write the first failing capability-rollback E2E spec** against a local/staging test capability provider and report an expected 404 after the switch changes.
- [ ] **Step 2: Verify RED** with `pnpm --filter client cy:run --spec cypress/e2e/release/capability-rollback.cy.ts` in the designated staging test environment.
- [ ] **Step 3: Add fixture lifecycle, correlation IDs, cleanup, and remaining scenario specs**, mocking only external providers that cannot safely be invoked in staging while retaining callback/replay contract assertions.
- [ ] **Step 4: Verify GREEN** with `pnpm --filter client test:staging-release-e2e` and inspect emitted reports for secret/customer-data redaction.
- [ ] **Step 5: Wire this command into the staging evidence job only after test credentials and safe fixture cleanup have been reviewed.**

### 10. Update operational records and changelogs

#### [MODIFY] `docs/MVP_LAUNCH_AUDIT_AND_HARDENING.md`
#### [MODIFY] `docs/MVP_LAUNCH_RECOMMENDATIONS.md`
#### [MODIFY] `docs/CHANGELOG.md`
#### [MODIFY] `apps/client/docs/CHANGELOG.md`
#### [MODIFY] `apps/admin/docs/CHANGELOG.md`
#### [MODIFY] `apps/workers/docs/CHANGELOG.md`
#### [MODIFY] `apps/client/docs/STATUS.md`, `apps/admin/docs/STATUS.md`, and `apps/workers/docs/STATUS.md`

- Record P0-5/P0-6 implemented controls, evidence scope, feature exclusions, operator rollback reference, verification commands/results, owners, and remaining external staging prerequisites. Do not mark the marketplace launch-ready.

- [ ] **Step 1: Add documentation tests/required phrases** to `scripts/__tests__/check-launch-documentation-governance.test.mjs` if the current governance checker can enforce them without encoding mutable release data.
- [ ] **Step 2: Verify RED/GREEN** with `node --test scripts/__tests__/check-launch-documentation-governance.test.mjs` and `pnpm run docs:check-launch-governance`.
- [ ] **Step 3: Update documents and changelogs** after all code/test evidence exists; include actual Git SHA only after the implementation commit is created.

## Verification Plan

### Focused automated tests

```powershell
pnpm --filter client test -- __tests__/lib/capabilities/registry.test.ts __tests__/middleware/capability-boundary.test.ts
pnpm --filter client test -- __tests__/api/stores/route.test.ts __tests__/api/properties/property-id.route.test.ts __tests__/api/projects
pnpm --filter workers test -- src/capabilities/__tests__/guard.test.ts src/processors/__tests__/mpesa-stk.processor.test.ts
pnpm --filter admin test -- __tests__/config/mvp-capabilities.test.ts
node --test scripts/__tests__/generate-release-evidence.test.mjs
node --test scripts/__tests__/check-launch-documentation-governance.test.mjs
```

### Workspace and release verification

```powershell
pnpm run client:check-types
pnpm run admin:check-types
pnpm run workers:check-types
pnpm run client:check-env-contract
pnpm run client:check-security-drift
pnpm run admin:check-governance
pnpm run docs:check-launch-governance
pnpm run release:verify
git diff --check
git diff --exit-code
```

### Staging evidence

```powershell
$env:RELEASE_EVIDENCE_ENVIRONMENT = 'staging'
pnpm --filter client test:staging-release-e2e
pnpm run release:evidence:generate
```

Attach the CI-generated manifest, digest, action run URL/artifact ID, scenario reports, owner, known exclusions, and next review date to the appropriate `GO_NO_GO.md` rows. A local report or a passing static test alone is not staging release evidence.
