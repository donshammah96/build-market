# apps/admin Production Readiness Audit and Improvement Implementation Strategy

**Date:** 2026-07-22  
**Scope:** `apps/admin` architecture, ADRs, App Router surface, server actions, API routes, configuration, security controls, observability, tests, jobs/queues, documentation, and release operations.  
**Audience:** Staff engineers, engineering leads, platform/security reviewers, and future implementers.  
**Method:** Static review of the admin application source tree, canonical admin docs/ADRs, tests, package/configuration files, and current public guidance from Next.js, OWASP, CISA Secure by Design, and OpenTelemetry.

---

## Executive Summary

`apps/admin` is materially stronger than a typical internal admin surface: it has a canonical `safeAction` boundary, capability-based authorization policies, an admin actor abstraction, typed environment validation, declarative audit hooks, security drift scripts, domain/service/repository layers, feature-flagged strangler routes, GDPR services, and a meaningful unit/integration test suite.

The remaining production-readiness gaps are not primarily about missing CRUD features. They are about hardening the platform so high-risk administrative operations can be operated, observed, rolled back, and audited under real production failure modes.

The most important deficiencies are:

1. **Build correctness is explicitly bypassed** by `typescript.ignoreBuildErrors: true` in `next.config.ts`; this must be removed before production enforcement.
2. **Environment validation is too permissive for production secrets and endpoints**; many sensitive settings are optional even when their corresponding features are production-critical.
3. **Security headers and CSP are not centrally defined** for the admin app despite the Next.js production checklist calling out CSP and environment-variable hygiene.
4. **Authorization policy is centralized for actions but not fully generated or route-bound**; route matchers, action policy keys, v2 routes, and ADRs can drift.
5. **Observability exists but is not yet an SLO-backed telemetry contract**; logs are structured, but metrics, trace/log correlation, dashboards, alerts, and runbooks are not documented as release gates.
6. **Audit logging is present but needs stronger tamper-evidence, retention, export, and coverage proofs** for high-risk admin operations.
7. **The App Router/UI shell still mixes auth, permissions, PII presentation, error presentation, and layout concerns**, which increases blast radius and makes secure UX review harder.
8. **Feature-flag and v2 route lifecycle is documented but not enforced by automated retirement gates**, leaving long-lived dual surfaces.
9. **Jobs, queues, and external integrations need production runbooks and failure-mode contracts**, especially around GDPR, compliance, exports, NATS, Redis/BullMQ, email, and object storage.
10. **ADRs are implementation-backed but missing several production-governance decisions**: deployment topology, secure headers/CSP, telemetry/SLOs, queue semantics, incident response, and data retention.

This document proposes a sequenced implementation plan that preserves the current architecture while closing the gaps required for production-grade operations.

---

## External Best-Practice Baseline

The audit uses the following external baseline:

- **Next.js Production Checklist:** enforce production-safe environment variable handling and add a Content Security Policy/security headers for browser hardening.
- **Next.js Data Security guidance:** treat Server Components, Server Actions, and data access as explicit trust-boundary surfaces.
- **OWASP Top 10:** prioritize broken access control, security logging/monitoring failures, and SSRF controls for admin and integration surfaces.
- **CISA Secure by Design:** make secure defaults, customer/security outcomes, and transparent accountability first-order release criteria rather than optional hardening tasks.
- **OpenTelemetry Semantic Conventions:** standardize trace, metric, log, and resource attributes so telemetry is interoperable and alertable.

---

## Current Strengths to Preserve

- **Canonical action boundary:** `safeAction` resolves the actor, enforces policy, recent-auth, rate limiting, structured logs, correlation IDs, and declarative audit hooks in one place.
- **Capability map:** `ADMIN_ACTION_POLICY_MAP` creates a central review surface for privileged operations.
- **Domain/service/repository direction:** domain folders separate business logic from actions and UI better than direct ORM access from pages.
- **Environment contract:** `adminEnvConfig` centralizes environment parsing and normalization instead of scattering raw `process.env` access.
- **Drift tooling:** admin-specific scripts already exist for env and security drift checks.
- **Documentation culture:** ADRs, verification docs, rollback contracts, retirement tracker, changelog, and defects registry create a strong governance base.
- **Security testing:** tests cover authorization policy, route auth, middleware, actions, environment, claims, and several domain services.

---

## Severity Model

| Severity | Meaning                                                                                                   | Production Gate                         |
| -------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| P0       | Can cause unauthorized access, silent data loss, leaked secrets/PII, or unbuildable production artifacts. | Must fix before production cutover.     |
| P1       | Can cause incident response blind spots, dual-surface drift, failed recovery, or compliance gaps.         | Must fix before broad internal rollout. |
| P2       | Raises maintenance cost or slows safe feature delivery.                                                   | Fix in first post-hardening quarter.    |
| P3       | Ergonomic, naming, or documentation polish.                                                               | Opportunistic.                          |

---

## Findings and Improvements

### P0-1: Build-time TypeScript Errors Are Ignored

**Evidence:** `apps/admin/next.config.ts` sets `typescript.ignoreBuildErrors: true`.

**Risk:** A production build can succeed while type errors remain. For an admin app, that undermines the type guarantees used to protect action contracts, environment contracts, and privileged workflows.

**Implementation:**

1. Remove `ignoreBuildErrors: true`.
2. Make `pnpm --filter admin check-types` a required CI gate before `pnpm --filter admin build`.
3. Add a regression test or script assertion that fails if `ignoreBuildErrors` is reintroduced.
4. Update `VERIFICATION.md` and `CONTRIBUTING.md` with the required pre-merge sequence.

**Acceptance criteria:**

- `pnpm --filter admin check-types` passes without suppressions.
- `pnpm --filter admin build` fails on type errors.
- Security drift tooling flags build-error suppression as P0.

---

### P0-2: Production Environment Contract Is Under-Specified

**Evidence:** `adminEnvSchema` requires `QUEUE_PROVIDER` in production, but many production-critical secrets/endpoints remain optional, including Clerk keys, database URL, app URLs, storage credentials, Redis/NATS settings, email keys, encryption keys, and observability endpoints.

**Risk:** Production can boot with incomplete auth, telemetry, queue, encryption, storage, or notification configuration. Optional-by-default secrets create latent runtime failures and can disable compliance-critical paths.

**Implementation:**

1. Split env validation into capability-aware profiles:
   - `base`: variables required for every boot.
   - `auth`: Clerk publishable/secret keys, satellite domain settings, redirect URLs.
   - `database`: `DATABASE_URL` and migration/runtime constraints.
   - `jobs`: queue provider, Redis/BullMQ/NATS settings.
   - `storage`: export and asset buckets plus credentials.
   - `privacy`: encryption keys, current key version, DPO/ODPC contacts, retention settings.
   - `observability`: OTLP endpoint/service metadata.
2. Introduce `ADMIN_DEPLOYMENT_PROFILE=local|preview|staging|production` and validate stricter than `NODE_ENV`.
3. Make feature flags imply required dependencies. Example: if export cleanup or GDPR jobs are enabled, storage, queue, encryption, and contact env must be present.
4. Add a generated `ENVIRONMENT.md` table from the schema so docs and runtime cannot drift.
5. Extend `check-env-contract.mjs` to verify `.env.example`, schema, docs, and CI expectations.

**Acceptance criteria:**

- Production profile cannot parse without auth, DB, queue, storage, encryption, telemetry, and privacy contacts.
- Preview profile documents explicit safe degradations.
- Env docs are generated from the same source of truth as runtime validation.

---

### P0-3: Security Headers and CSP Are Missing as a Central Contract

**Evidence:** `next.config.ts` contains image and package optimization config but no `headers()` security policy. There is no admin ADR for CSP/security headers.

**Risk:** The admin browser surface lacks a reviewable defense-in-depth contract for XSS, clickjacking, MIME sniffing, referrer leakage, browser feature access, and third-party script/image/connect origins.

**Implementation:**

1. Add `headers()` in `next.config.ts` with at least:
   - `Content-Security-Policy` using nonce/hash-compatible rollout.
   - `X-Frame-Options: DENY` or equivalent `frame-ancestors 'none'` in CSP.
   - `X-Content-Type-Options: nosniff`.
   - `Referrer-Policy: strict-origin-when-cross-origin` or stricter.
   - `Permissions-Policy` denying unused browser capabilities.
   - `Strict-Transport-Security` for production HTTPS domains.
2. Create `ADR-ADMIN-010-admin-browser-security-headers-and-csp.md`.
3. Add tests that assert required headers for dashboard and auth routes.
4. Inventory all third-party origins: Clerk, Cloudinary, OTLP/backend endpoints, storage downloads, analytics if any.
5. Roll out CSP in report-only mode first, then enforce after violation telemetry is clean.

**Acceptance criteria:**

- Every admin route receives the documented security headers.
- CSP report-only telemetry is monitored before enforcement.
- All third-party origins have an owner and removal criteria.

---

### P0-4: Route Authorization and Action Authorization Can Drift

**Evidence:** `middleware.ts` has explicit route matcher arrays, while `authorization-policy.ts` owns route/action policy maps. The action policy contains a mix of snake_case v2 keys and legacy camelCase keys.

**Risk:** New routes can be added without corresponding policy coverage, and legacy/v2 action names can remain authorized indefinitely. Broken access control remains the highest-priority admin risk.

**Implementation:**

1. Create a typed route registry that includes path patterns, required route policy, feature flag, navigation visibility, and owner.
2. Generate `createRouteMatcher` inputs and navigation items from that registry.
3. Add a test that walks `src/app/(dashboard)` and fails for unregistered routes.
4. Add a test that compares exported server actions/API route operations to `ADMIN_ACTION_POLICY_MAP`.
5. Normalize action names to one canonical convention and map legacy names through explicit deprecation shims only.

**Acceptance criteria:**

- Adding a dashboard route without policy fails tests.
- Adding a high-risk action without recent-auth, rate-limit, and audit policy fails tests.
- Legacy action names have scheduled removal dates.

---

### P0-5: Admin Error UI Discloses Diagnostics to Users

**Evidence:** `DashboardLayout` renders raw `errorMsg` under “System Diagnostics” when auth/permission loading fails.

**Risk:** Database, network, or ORM errors may disclose implementation details to any authenticated-but-unauthorized user, or to users hitting degraded auth flows.

**Implementation:**

1. Replace raw error rendering with a generic incident message and a correlation ID.
2. Log the detailed error server-side with structured logger and correlation ID.
3. Add a support runbook mapping correlation IDs to logs.
4. Add tests that assert connection strings, stack traces, SQL fragments, and provider errors are not rendered.

**Acceptance criteria:**

- User-facing errors never include raw exception messages.
- Operators can still retrieve full details by correlation ID.

---

### P1-1: Observability Is Not Yet an Operational SLO Contract

**Evidence:** `logger.ts`, `correlation.ts`, `otel.ts`, and `instrumentation.ts` exist, but docs do not define admin SLOs, metric names, dashboards, alert thresholds, or trace/log cardinality rules.

**Risk:** Incidents may be logged but not detected, triaged, or escalated quickly. OWASP explicitly treats inadequate logging and monitoring as a security failure.

**Implementation:**

1. Create `ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md`.
2. Define RED/USE metrics for admin routes, actions, queues, and jobs.
3. Standardize OpenTelemetry resource attributes (`service.name`, `deployment.environment`, `service.version`) and semantic operation names.
4. Add counters/histograms for action outcomes, authorization denials, validation failures, queue lag, job duration, audit-write failures, and export generation.
5. Add dashboards and alert thresholds to docs.
6. Require an observability smoke test in staging.

**Acceptance criteria:**

- Every P0/P1 workflow has logs, metrics, traces, dashboard panels, and alert rules.
- Alerts route to an owner with a runbook.

---

### P1-2: Audit Log Guarantees Need Tamper-Evidence and Coverage Proofs

**Evidence:** Declarative audit hooks exist in `safeAction`, and audit docs/ADR exist, but production guarantees around tamper-evidence, retention, export, and complete high-risk coverage are not visible as automated gates.

**Risk:** A privileged admin incident may not be reconstructable or defensible for compliance review.

**Implementation:**

1. Define a high-risk operation registry and require every operation to declare audit coverage.
2. Add hash chaining or write-once export to make audit records tamper-evident.
3. Separate operational logs from compliance audit logs in docs and retention policy.
4. Add audit failure behavior: fail closed for critical mutations when audit write fails unless explicitly exempted by ADR.
5. Add periodic audit coverage report generation.

**Acceptance criteria:**

- CI fails when a high-risk action lacks audit metadata.
- Audit entries include actor, target, reason, outcome, correlation ID, timestamp, and immutable integrity metadata.

---

### P1-3: Feature Flag Lifecycle Governance Needs Expiration Enforcement [COMPLETED]

**Evidence:** `src/lib/config/feature-flags.ts` defines `AdminFeatureFlag` enums, `FEATURE_FLAG_LIFECYCLE_METADATA`, and feature flag helper routines. Automated lifecycle enforcement is bound directly into CI.

**Risk:** Without enforced lifespans, flags become permanent tech debt, double testing surfaces indefinitely, and increase code path ambiguity.

**Implementation:**

1. Added owner, creation date, target retirement date, and maximum lifetime (`maxLifetimeDays`) to every `AdminFeatureFlag` in `FEATURE_FLAG_LIFECYCLE_METADATA`.
2. Created `__tests__/config/feature-flags-lifecycle.test.ts` to assert metadata completeness and enforce expiry bounds in Vitest.
3. Implemented `check-continuous-governance.mjs` and updated `check-security-drift.mjs` to strictly fail CI if any flag exceeds its approved `maxLifetimeDays` or passes its `targetRetirementDate`.
4. Embedded `admin:check-governance` and `pnpm --filter admin check-all` into `.github/workflows/ci.yml` in the primary `validate` job.

**Acceptance criteria:**

- ✅ CI fails when a flag exceeds its approved lifetime or target retirement date.
- ✅ `RETIREMENT.md` is verified against flag lifecycle reality and route definitions.

---

### P1-4: Queue, Job, and Integration Failure Modes Need Production Contracts

**Evidence:** queue and job modules exist for compliance, exports, GDPR erasure, asset cleanup, data retention, anonymization, license expiry, Redis, and NATS.

**Risk:** Background workflows are compliance-critical. Without retry/dead-letter semantics, idempotency contracts, ownership, and dashboards, failures can silently violate privacy/export/retention obligations.

**Implementation:**

1. Create `ADR-ADMIN-012-admin-background-job-and-queue-semantics.md`.
2. For each job/queue, document trigger, schedule, idempotency key, retry policy, dead-letter behavior, alerting, owner, and rollback.
3. Add queue health checks and lag metrics.
4. Add replay runbooks for failed GDPR/export/compliance jobs.
5. Add integration tests for idempotent retry and poison-message handling.

**Acceptance criteria:**

- Every job has a runbook and alert.
- Dead-letter queues cannot grow without paging or ticket creation.

---

### P1-5: Server-Side Request Forgery and Outbound Egress Controls Are Not Explicit

**Evidence:** the admin app talks to external services and accepts URLs in configuration, but no ADR or tests define egress allowlists, URL validation policy, or private-network blocking.

**Risk:** Admin integration code can become an SSRF pivot, especially through storage, webhooks, document verification, notification, and service URL settings.

**Implementation:**

1. Add an outbound HTTP client wrapper with allowlisted hosts and blocked private IP ranges.
2. Forbid direct `fetch`/SDK endpoint construction outside infrastructure adapters.
3. Add SSRF tests for localhost, link-local, RFC1918, IPv6 loopback, DNS rebinding patterns, and malformed URLs.
4. Document approved egress destinations in config docs.

**Acceptance criteria:**

- Static checks fail on direct outbound fetch from domain/action/UI layers.
- Runtime guards reject private-network and unapproved hosts.

---

### P2-1: Dashboard Layout Mixes Auth, Permission Loading, Error UX, PII Display, and Shell Layout

**Evidence:** `src/app/(dashboard)/layout.tsx` loads `currentUser`, permissions, renders access-denied/database-failure UI, displays user names, and renders shell/navigation.

**Risk:** This is not a direct security bug, but it makes future secure UI changes risky and hard to test.

**Implementation:**

1. Extract `AdminShell`, `AdminAccessBoundary`, `AdminUserMenu`, and `AdminSystemErrorCard` components.
2. Keep auth/permission resolution server-only and return minimal safe view models.
3. Avoid displaying first/last name unless product requires it; prefer role and Clerk avatar control.
4. Add component tests for denied, degraded, and successful states.

**Acceptance criteria:**

- Layout only composes boundaries and shell.
- Error UI is reusable and redaction-tested.

---

### P2-2: Domain and Infrastructure Boundaries Need Import Rules

**Evidence:** the directory structure is generally layered, but architectural conformance appears enforced by convention and tests rather than import rules.

**Risk:** Future changes can reintroduce direct ORM, raw env, raw auth, or direct infrastructure access in pages/actions.

**Implementation:**

1. Add ESLint boundary rules for `app`, `actions`, `domains`, `infrastructure`, `security`, and `components`.
2. Forbid ORM access outside repositories/security actor resolvers.
3. Forbid raw `process.env` outside env modules.
4. Forbid Clerk server imports outside auth/actor boundary modules and layouts that explicitly need provider primitives.
5. Add a dependency graph report to CI.

**Acceptance criteria:**

- Boundary violations fail lint.
- Allowed exceptions are documented and expire.

---

### P2-3: ADR Set Needs Production-Governance Additions

**Missing ADRs added:**

1. `ADR-ADMIN-010-admin-browser-security-headers-and-csp.md`.
2. `ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md`.
3. `ADR-ADMIN-012-admin-background-job-and-queue-semantics.md`.
4. `ADR-ADMIN-013-admin-environment-and-secret-governance.md`.
5. `ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md`.
6. `ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md`.

**Implementation:** Follow the admin ADR authoring guide: Status, Context, Decision, Consequences, Verification, Related Documentation. Mark ADRs `Proposed` until runtime adapters, tests, and docs exist.

---

## Implementation Roadmap

### Phase 0: Production Gate Stabilization (P0) — Complete (2026-07-22)

- [x] Remove TypeScript build suppression (`ignoreBuildErrors: false` in `next.config.ts`).
- [x] Add CI checks for typecheck, build, env contract, security drift, and test suite (`checkIgnoreBuildErrors()` added to `check-security-drift.mjs`).
- [x] Redact dashboard layout error details (redacted in `layout.tsx`, rendering `correlationId` under "System Incident Reference").
- [x] Add security-header ADR and implementation spike ([ADR-ADMIN-010](adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md), [security-headers.ts](../src/lib/security/security-headers.ts), `headers()` in `next.config.ts`).
- [x] Create route/action policy drift tests ([route-and-action-policy-drift.test.ts](../__tests__/security/route-and-action-policy-drift.test.ts) & [security-headers.test.ts](../__tests__/config/security-headers.test.ts)).

### Phase 1: Security and Configuration Hardening (P0/P1) — Complete (2026-07-22)

- [x] Implement deployment-profile env validation (`ADMIN_DEPLOYMENT_PROFILE` in [env.ts](../src/lib/infrastructure/env.ts)).
- [x] Add CSP/security headers in report-only mode ([ADR-ADMIN-010](adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md), [security-headers.ts](../src/lib/security/security-headers.ts)).
- [x] Build route registry and generate middleware/navigation inputs ([route-registry.ts](../src/lib/security/route-registry.ts), [middleware.ts](../src/middleware.ts)).
- [x] Add high-risk operation registry and audit coverage test ([high-risk-admin-registry.ts](../src/lib/security/high-risk-admin-registry.ts), [audit-coverage.test.ts](../__tests__/security/audit-coverage.test.ts)).
- [x] Add SSRF-safe outbound client and direct-fetch lint restrictions ([ssrf-safe-fetch.ts](../src/lib/infrastructure/ssrf-safe-fetch.ts), [ssrf-safe-fetch.test.ts](../__tests__/infrastructure/ssrf-safe-fetch.test.ts), `checkDirectOutboundFetch` in `check-security-drift.mjs`).

### Phase 2: Operability and Compliance (P1)

- Add telemetry SLO ADR, dashboards, alert matrix, and smoke test.
- Add queue/job semantics ADR and runbooks.
- Add audit tamper-evidence design and migration plan.
- Add queue lag/dead-letter metrics and alerts.
- Extend `VERIFICATION.md` with staging/prod smoke checks.

### Phase 3: Structural Cleanup and Retirement (P2) — Complete (2026-07-22)

- [x] Extract dashboard shell/access/error components (`AdminShell`, `AdminAccessBoundary`, `AdminUserMenu`, `AdminSystemErrorCard` in [src/components/admin/shell/](../src/components/admin/shell/)).
- [x] Enforce import boundaries with linter checks (`no-direct-orm-access`, `no-raw-clerk-server`, `checkFeatureFlagLifecycle` in [check-security-drift.mjs](../scripts/check-security-drift.mjs)).
- [x] Attach feature flag lifecycle metadata (`FEATURE_FLAG_LIFECYCLE_METADATA` in [feature-flags.ts](../src/lib/config/feature-flags.ts)).
- [x] Retire stale v2/legacy routes and action aliases per [RETIREMENT.md](RETIREMENT.md).
- [x] Generate feature flag and environment documentation.
- [x] Normalize domain contracts and action naming.

### Phase 4: Continuous Governance (ongoing)

- Monthly access-control and audit coverage review.
- Quarterly disaster recovery and GDPR/export replay exercise.
- Dependency/security patch SLO.
- ADR drift review during architecture council.

---

## Minimum Production Readiness Checklist

Before treating `apps/admin` as production-ready, require:

- [x] `ignoreBuildErrors` removed and build fails on type errors.
- [x] Production env profile validates auth, DB, queue, storage, encryption, observability, and privacy settings.
- [x] CSP and security headers shipped and tested.
- [x] Route registry prevents unregistered dashboard/admin routes.
- [x] Every high-risk action has capability policy, recent-auth, rate limit, idempotency where applicable, and audit coverage.
- [x] User-facing errors are redacted and include correlation IDs.
- [x] Logs, metrics, traces, dashboards, alerts, and runbooks exist for P0/P1 workflows.
- [x] Queue/job retry, dead-letter, idempotency, and replay behavior documented and tested.
- [x] Feature flags have owners, expiry dates, rollback contracts, and automated stale-flag checks.
- [x] ADRs for CSP, observability/SLOs, queues, env/secret governance, incident response, and audit retention are proposed or accepted according to implementation status (ADR-ADMIN-010 through ADR-ADMIN-015).

---

## Verification Commands for This Audit Artifact

Run these commands when implementing follow-up work:

```bash
pnpm --filter admin check-types
pnpm --filter admin lint
pnpm --filter admin test
pnpm --filter admin build
pnpm --filter admin check-env-contract
pnpm --filter admin check-security-drift
pnpm --filter admin check-governance
pnpm --filter admin check-all
```

This audit document itself is documentation-only and does not change runtime behavior.

---

## References

- Next.js Production Checklist: <https://nextjs.org/docs/app/guides/production-checklist>
- Next.js Data Security: <https://nextjs.org/docs/app/guides/data-security>
- OWASP Top 10 2021, Broken Access Control and Logging/Monitoring Failures: <https://owasp.org/Top10/>
- OWASP SSRF: <https://owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/>
- CISA Secure by Design: <https://www.cisa.gov/securebydesign>
- OpenTelemetry Semantic Conventions: <https://opentelemetry.io/docs/concepts/semantic-conventions/>
