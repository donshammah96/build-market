# ADR-ADMIN-015: Admin Data Retention, Export, and Tamper-Evident Audit

## Status

Proposed

## Context

`apps/admin` includes GDPR erasure, anonymization, export, asset cleanup, data retention, audit, and encryption modules. ADR-ADMIN-004 defines data classification and handling, while ADR-ADMIN-008 defines the admin audit log contract. The production-readiness audit found that these controls need a stronger production-governance decision for retention schedules, export custody, audit integrity, audit retention, and coverage proof.

Privileged admin workflows must be reconstructable after incidents. Privacy and export workflows must be provably completed or safely retried. Audit logs must be protected against tampering by ordinary application write paths.

## Decision

Admin audit, retention, and export workflows must use a shared governance model:

- Each high-risk action declares audit metadata: operation, actor, target, reason when required, outcome, correlation ID, and data classification.
- Critical mutations fail closed when audit persistence fails unless a narrow ADR-approved exception exists.
- Audit records are immutable through normal application paths.
- Audit integrity is tamper-evident through hash chaining, append-only storage, write-once export, signed batches, or an equivalent integrity mechanism.
- Audit retention, export retention, GDPR erasure logs, anonymization logs, and data-retention job logs have documented retention periods and legal/business rationale.
- Operator exports have custody metadata: requester, purpose, filters, generated object, expiry, download access, deletion status, and audit linkage.
- Export artifacts are encrypted at rest, expire by default, and are cleaned up by an observable job with retry/dead-letter behavior from ADR-ADMIN-012.
- GDPR erasure and anonymization produce durable completion evidence without retaining erased personal data beyond the approved minimum.

A high-risk operation registry must define which operations require reason capture, recent auth, idempotency, audit, export custody, or tamper-evident integrity. CI must fail when a registered high-risk operation lacks required audit metadata.

Audit log reads and exports are themselves high-risk operations and must be audited.

### Rollout Sequence

1. Create a high-risk operation registry shared by `safeAction`, route handlers, tests, and audit coverage reporting.
2. Add audit coverage tests for every high-risk server action and admin route operation.
3. Choose and implement a tamper-evidence mechanism for audit records or audit batches.
4. Add export custody metadata and retention/expiry enforcement for generated admin exports.
5. Update GDPR erasure/anonymization/data-retention jobs to emit completion evidence and telemetry without reintroducing PII.
6. Document retention periods and legal/business rationale in `apps/admin/docs/DATA-RETENTION.md` or equivalent.
7. Add replay/reconciliation runbooks for failed audit, export cleanup, GDPR, and retention workflows.
8. Mark this ADR Accepted only after integrity, retention, export custody, and coverage tests are implemented.

### Not Yet Implemented

- High-risk operation registry with audit coverage enforcement.
- Tamper-evident audit chain or equivalent immutable integrity mechanism.
- Export custody metadata and expiry enforcement tests across all export paths.
- Retention schedule document generated or validated against job configuration.
- Fail-closed audit persistence behavior for all critical mutations.

## Consequences

Admin audit and export records become defensible compliance artifacts rather than best-effort operational logs. Critical mutations may fail when audit infrastructure is degraded; that is intentional for operations whose compliance and incident-response value depends on auditability.

Storage costs may increase for immutable audit batches and completion evidence. Retention schedules must balance legal obligations, privacy minimization, and incident-response needs.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- __tests__/actions/audit-actions.test.ts src/lib/domains/audit src/lib/domains/gdpr
pnpm --filter admin check-security-drift
```

The audit coverage report must deterministically fail when a high-risk operation lacks required audit metadata or when an export path lacks custody/expiry metadata.

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md`
- `apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md`
- `apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md`
- `apps/admin/docs/VERIFICATION.md`
