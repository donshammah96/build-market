# ADR-ADMIN-013: Admin Environment and Secret Governance

Status: Proposed
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Proposed

## Context

ADR-ADMIN-006 requires admin code to access environment variables through the validated admin environment boundary. The production-readiness audit found that the boundary exists, but the schema remains too permissive for production because many secrets and endpoints are optional even when auth, database, queues, storage, encryption, notifications, telemetry, or privacy workflows are production-critical.

`NODE_ENV` is not expressive enough to distinguish local development, ephemeral preview, staging, production, and static-build behavior. Production hardening requires deployment profiles, feature-to-secret dependency validation, generated documentation, and drift checks that prevent runtime-only discovery of missing secrets.

## Decision

`apps/admin` must use a deployment-profile environment contract in addition to `NODE_ENV`:

- `ADMIN_DEPLOYMENT_PROFILE=local|test|preview|staging|production`.
- `production` requires all dependencies needed for auth, database, queue, storage, encryption, privacy, notifications, and observability unless a documented feature is disabled by an approved production flag.
- `staging` mirrors production requirements except credentials may point to non-production services.
- `preview` may allow safe degradations, but each degradation must be explicit and documented.
- `local` and `test` may use local/in-memory substitutes only when those substitutes cannot affect production data.

Environment validation must be capability-aware. Required variables are grouped by capability:

- Base app identity and URLs.
- Clerk/auth and satellite-domain settings.
- Database and migration/runtime URLs.
- Queue provider and provider credentials.
- Object storage for exports/assets.
- Encryption keys and key-version metadata.
- GDPR/privacy contacts, retention schedules, and batch sizes.
- Notification providers.
- NATS/Redis/BullMQ integration settings.
- OpenTelemetry and log/metric resource attributes.

Feature flags must imply dependencies. If a feature flag enables exports, GDPR jobs, compliance queues, license verification, notification retries, or structured telemetry, the schema must require the corresponding provider variables for staging and production.

Secrets must not be exposed through `NEXT_PUBLIC_*` unless they are intentionally public browser configuration. Any new public env variable must state why browser exposure is safe.

The env schema, `.env.example`, deployment documentation, and CI checks must share a source of truth. Manual docs are acceptable only if drift tooling proves they match the schema.

### Rollout Sequence

1. Add `ADMIN_DEPLOYMENT_PROFILE` to `adminEnvSchema`, `.env.example`, and test fixtures.
2. Refactor environment validation into capability groups with production/staging requirements.
3. Encode feature-flag-to-dependency refinements.
4. Generate or validate `apps/admin/docs/ENVIRONMENT.md` from the schema.
5. Extend `scripts/check-env-contract.mjs` to compare schema, `.env.example`, and generated docs.
6. Update deployment and verification docs with profile-specific expectations.
7. Mark this ADR Accepted only after production profile parsing fails closed for missing critical dependencies.

### Not Yet Implemented

- `ADMIN_DEPLOYMENT_PROFILE`.
- Capability-grouped production env requirements.
- Feature-flag dependency refinements.
- Generated or schema-validated `ENVIRONMENT.md`.
- CI enforcement for schema/docs/example drift beyond the current baseline.

## Consequences

Production and staging boot become stricter. Misconfigured deployments fail during validation rather than during privileged workflows. Preview and local setup require more explicit configuration, but safe degradations become visible and reviewable.

This ADR may require coordination with hosting, secrets management, CI, and any deployment automation that currently sets only `NODE_ENV`.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- __tests__/config/env-and-layout.test.tsx
pnpm --filter admin check-env-contract
pnpm --filter admin build
```

Add deterministic tests for production, staging, preview, local, and test profiles. Production-profile tests must assert failure when auth, database, queue, storage, encryption, privacy, notification, or observability dependencies are absent.

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md`
- `apps/admin/docs/ROLLBACK-CONTRACTS.md`
- `apps/admin/docs/VERIFICATION.md`
