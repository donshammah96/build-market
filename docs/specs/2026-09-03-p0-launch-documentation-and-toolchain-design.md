# P0 Launch Documentation and Toolchain Hardening Design

**Status:** Proposed for implementation
**Decision date:** 2026-09-03
**Owner:** Platform Engineering
**Next review:** 2026-12-03

## Goal

Resolve P0-1 through P0-4 from `docs/MVP_LAUNCH_AUDIT_AND_HARDENING.md` by making architectural authority, worker operations, launch-readiness evidence, and the Node.js runtime contract accurate, discoverable, and CI-enforced.

## Scope and non-goals

This change covers documentation and release-governance controls only. It does not alter marketplace feature behavior, queue processing behavior, persistence, deployment credentials, or public availability of any vertical.

The source of truth for implementation behavior remains the code and accepted ADRs. Documentation must describe implemented behavior precisely, including explicit exclusions where an underlying processor does less than a complete privacy or deletion operation.

## Architecture and governance contract

1. The ADR index is the complete set of files in `apps/client/docs/adr/` through `ADR-010` and `apps/admin/docs/adr/` through `ADR-ADMIN-016`.
2. Every ADR declares the same metadata fields near its title: `Status`, `Owner`, and `Next review`. Existing accepted decisions retain their decision content; the added metadata does not rewrite their rationale.
3. Repository and application architecture documentation links to the complete indexes rather than an obsolete upper bound.
4. Launch decision criteria in the audit and canonical go/no-go page name the ADRs and operational controls that evidence each criterion.
5. A deterministic repository check validates the above contract and is executed in pull-request and branch CI.

## Worker operational contract

`apps/workers/README.md` will describe the deployed daemon as it exists today:

- `/healthz` and its aliases report a combined dependency/readiness result for Redis, PostgreSQL, BullMQ worker state, and NATS connectivity; shutdown is reported separately.
- Liveness is process reachability, readiness is the aggregate dependency result, and the endpoint is not a proof that a specific job type has recently completed successfully.
- Each maintenance job is documented with its exact database or storage effect. A status update, scheduling action, or record cleanup must not be described as complete erasure, anonymization, or asset destruction unless the processor performs that effect.
- Each MVP-critical BullMQ/NATS queue has a named operational owner, a detection signal, a safe pause/recovery sequence, and a post-recovery verification step. The procedure is documented without embedding environment-specific secrets or URLs.

## Canonical readiness evidence

Create one current-status document for each deployable application: client, admin, verification operations, and workers. The documents contain a fixed evidence header:

- status and exact scope;
- evidence date and immutable Git SHA;
- tested environment;
- non-mutating command(s), result, and report location where applicable;
- named accountable owner;
- known exclusions; and
- next review date.

Progress summaries, implementation plans, and autopsies retain historical value but are labeled/archive-referenced as historical records. They cannot claim current launch readiness. The canonical status documents link to the relevant current records and the launch go/no-go scorecard.

## Runtime contract

Node.js 24 is the single supported runtime. It is already the prevailing application and root requirement, so the change converges all repository guidance and enforcement to Node 24 rather than creating a compatibility matrix. The implementation updates `.nvmrc`, package `engines`, container base images, workflow setup actions, and relevant READMEs. CI rejects a divergent Node 20 reference in active runtime configuration while allowing historical/archive references that are explicitly non-current.

## Enforcement and tests

A new Node-based governance checker, with fixture-driven tests, validates:

1. every current client/admin ADR has required metadata and is listed in the authoritative indexes;
2. every canonical application status page has the required evidence fields;
3. the current launch scorecard names ADR/control evidence for every criterion;
4. active runtime configuration is Node 24; and
5. current worker documentation describes the actual health contract and queue runbook link.

The checker emits actionable file-and-rule failures and returns non-zero on any violation. It is added to root scripts and the existing CI validation job. Its tests cover both valid repositories and each invalid-rule category, so the CI check itself is protected from silent weakening.

## Files and boundaries

- Governance docs: `README.md`, `.agent/DOCUMENT-HIERARCHY.md`, `.agent/ADMIN-ARCHITECTURE.md`, the app READMEs, ADR documents, launch audit/recommendations, and application/root changelogs.
- Operational docs: `apps/workers/README.md` plus a dedicated queue recovery runbook under `docs/operations/`.
- Current status docs: `apps/*/docs/STATUS.md` and status links from existing historical progress/autopsy documents.
- Toolchain and CI: `.nvmrc`, package manifests where engines diverge, active Dockerfiles/workflows, root scripts, and the new checker/test files.

No route, server action, domain service, repository, DTO, Prisma schema, or queue payload contract is changed.

## Verification

The implementation is test-driven: each new governance rule is introduced with a failing fixture test before the checker implementation. The full proof consists of the focused checker test suite, the checker against the real repository, relevant worker unit tests, workspace typechecks for touched code, and the non-mutating local CI command documented by the root package.
