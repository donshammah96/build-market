# P0 Capability Boundaries and Release Evidence Design

**Status:** Approved for implementation  
**Decision date:** 2026-09-03  
**Owner:** Platform Engineering with Marketplace Operations  
**Next review:** 2026-12-03

## Goal

Resolve P0-5 and P0-6 from `docs/MVP_LAUNCH_AUDIT_AND_HARDENING.md`. Disabled MVP verticals become server-enforced capabilities rather than navigation-only changes, and every release candidate receives reproducible, non-mutating verification evidence.

## Scope and non-goals

The dormant capability set is materials commerce/stores, property transactions, Idea Books, CPD, wallets/escrow, and platform custody. The public client application, client APIs, relevant background-job producers/processors, analytics, admin visibility, release scripts, CI, and launch evidence documentation are in scope.

This work does not enable a deferred vertical, alter its underlying persistence models, move customer funds, introduce a production E2E environment, or declare the marketplace ready for public launch. An enabled capability still requires its own product, compliance, operational-readiness, and release approval.

## Capability-boundary architecture

A single typed, server-safe capability registry will be the authoritative policy for the MVP-deferred verticals. Each registry entry declares:

- stable capability identifier and owner;
- default state (`disabled`) and a typed environment-backed kill switch;
- public page and API route-prefix policy;
- sitemap/search eligibility;
- analytics state label;
- background-job, notification, and email eligibility; and
- admin-facing lifecycle label (`dormant` or `live`).

The registry is intentionally server-owned. Browser components can consume a read-only presentation helper, but client-side hiding is never an authorization decision. All runtime environment reads continue through the validated environment module.

### Enforcement points

1. **Request edge:** client middleware applies capability policy before ordinary authentication/onboarding routing. Disabled page and API prefixes receive a uniform 404-style response; public and authenticated deep links are treated identically. This avoids both bypasses and advertising the dormant feature.
2. **Application adapters:** route handlers and server actions call a small guard before domain work. This is defense in depth for deployments or internal calls that do not traverse middleware, and produces an explicit typed disabled-capability result instead of reaching persistence.
3. **Discovery:** sitemap and server-side search sources only enumerate live capabilities. The registry becomes the shared predicate, preventing hand-maintained allowlists from drifting.
4. **Async work:** queue producers and processors evaluate the capability before enqueuing or delivering work. Disabled work is suppressed without retries, external email/SMS dispatch, or in-app notification creation, and emits a structured audit/telemetry event containing only capability, source, and suppression reason.
5. **Analytics:** events originating from a dormant capability are tagged with the capability identifier and `capability_state: "disabled"`; they are never emitted as live-feature conversion or engagement events.
6. **Administration:** admin navigation and affected operations display the capability as dormant rather than live. Read-only operational visibility remains available to authorized operators where required for cleanup or investigation; creation, verification, and publicisation mutations are denied by the same policy.

## Kill switch and rollback contract

All deferred capabilities default to disabled in every environment. Enabling one is an explicit, reviewed environment change; disabling it is the immediate rollback path and takes effect on the next deployment/runtime configuration refresh. The release checklist records the capability matrix and the tested rollback command/runbook.

The automated rollback scenario proves that a capability enabled for the test is discoverable only while live, then becomes inaccessible from pages and APIs, excluded from discovery, and suppressed in async delivery after it is disabled. It does not mutate a shared staging tenant: the test uses isolated fixtures and teardown.

## Release-evidence contract

`pnpm run validate` remains a developer convenience that may write formatting. It is explicitly prohibited as release evidence. A new `pnpm run release:verify` command is non-mutating and composes the local CI checks plus focused capability and release-contract tests.

The command produces a deterministic evidence manifest containing the Git SHA, repository tree state, Node/pnpm versions, environment label, UTC start/end times, executed commands, exit result, test-report paths, known exclusions, and SHA-256 digests of included reports. It refuses to label a dirty worktree or an unspecified environment as a release candidate. Its output directory is ignored locally and is only retained by CI.

For staging release candidates, a dedicated GitHub Actions job runs the command with `RELEASE_EVIDENCE_ENVIRONMENT=staging`, uploads the manifest and reports as an artifact with a content digest, and records GitHub Actions provenance/retention metadata. The go/no-go scorecard links the immutable CI run/artifact rather than a mutable local report. GitHub-controlled artifact retention and the run’s commit association supply immutability; no private signing key is introduced into this repository.

## Staging E2E suite

The release workflow exposes a dedicated staging E2E entry point. It has deterministic seeded actors/fixtures, unique run correlation IDs, and cleanup that is safe to retry. The suite covers:

1. homeowner and professional onboarding;
2. verification completion and public trust-state visibility;
3. lead routing and consented masked disclosure;
4. messaging between eligible participants;
5. project-linked review eligibility and duplicate/unauthorised denial;
6. queue failure, recovery, and no duplicate notification delivery;
7. M-Pesa callback replay rejection; and
8. deferred-capability flag rollback.

The suite uses staging-only credentials and test data. A failure blocks a release candidate but does not automatically alter a feature flag or production state. Provider/network dependency failures are reported as an explicit no-go evidence outcome, not retried into a false pass.

## Error handling and auditability

Capability denial returns a stable public 404-style response without leaking the feature’s state. Internal logs, metrics, and release evidence retain the capability identifier, enforcement layer, source, and correlation ID. Async suppression is successful policy enforcement, not a processor error; it is measured separately from failed delivery.

Release-evidence generation fails closed when it cannot determine revision, environment, command result, or report digest. It never includes secrets, raw request payloads, customer data, or provider credentials in manifests or uploaded reports.

## Testing and verification

- Unit tests establish default-disabled policy, typed switch parsing, path/API mapping, and analytics/suppression metadata.
- Middleware and route tests prove deep-link/API denial and rollback behavior.
- Producer/processor tests prove disabled capabilities cannot enqueue or dispatch notification/email work.
- Sitemap/search and admin tests prove dormant content is excluded publicly and accurately marked internally.
- Release-evidence tests validate dirty-tree refusal, required manifest fields, redaction, digest generation, and non-mutating command composition.
- CI validates the manifest before upload and stores it for every staging release candidate.

## Files and boundaries

- `apps/client`: typed capability registry, validated environment contract, middleware, affected route adapters, sitemap/search integrations, analytics helpers, and focused tests.
- `apps/admin`: capability-status presentation and mutation guards using existing `safeAction`, capability resolution, and audit-log boundaries; no direct Prisma in actions.
- `apps/workers`: capability-aware queue producer/processor delivery guards and focused tests; no queue payload schema change unless a source capability is missing and must be added explicitly.
- Root tooling and CI: release-verification/evidence scripts, test reports, GitHub workflow artifact handling, and command documentation.
- Launch documentation/changelogs: scorecard evidence rules, P0 implementation record, root/application changelogs, and relevant operator runbooks.

The normal application layering remains unchanged: thin routes/actions, domain services returning `Result<T, AppError>`, persistence-only repositories, explicit DTOs, and admin `safeAction` mutations with declarative audit logs.
