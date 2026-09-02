# ADR-ADMIN-014: Admin Incident Response and Break-Glass Access

Status: Proposed
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Proposed

## Context

`apps/admin` controls privileged user, content, verification, audit, export, GDPR, and operational workflows. ADR-ADMIN-001 defines authentication and authorization, and ADR-ADMIN-008 defines audit logging. The production-readiness audit found no dedicated production contract for incident response, emergency access, support escalation, or break-glass controls.

Production incidents may include auth-provider outages, accidental admin lockout, compromised admin accounts, failed audit writes, GDPR/export job failures, suspicious high-risk mutations, or deployment regressions. Staff-level readiness requires the system to define how operators regain control without creating invisible privileged access.

## Decision

`apps/admin` must have an incident-response and break-glass contract before broad production rollout.

Break-glass access must be:

- Disabled by default.
- Separate from local `DEV_ADMIN_BYPASS`; development bypass is never a production emergency mechanism.
- Time-boxed with an explicit expiry.
- Approved by at least two authorized people or an equivalent incident-management workflow.
- Scoped to the minimum role/capabilities required.
- Protected by recent authentication or equivalent strong re-authentication.
- Fully audited with actor, approver, reason, scope, start time, expiry, correlation ID, and outcome.
- Alerted when enabled, used, extended, or expired.

Incident response must define severity levels, owners, communication channels, triage steps, rollback options, and evidence preservation for:

- Unauthorized or suspicious admin access.
- Broken access-control regression.
- Audit logging failure.
- GDPR/export/data-retention workflow failure.
- Queue/dead-letter growth.
- Auth-provider or Clerk satellite-domain outage.
- Database/storage/notification provider outage.
- Security-header/CSP rollout regression.
- Secret exposure or key-rotation incident.

Any emergency mutation performed during an incident must still pass through a controlled action or route boundary. Direct database changes are allowed only when explicitly documented in the incident runbook, approved, logged externally, and reconciled back into audit history.

### Rollout Sequence

1. Create `apps/admin/docs/INCIDENT-RESPONSE.md` with severity matrix, owners, channels, runbooks, and evidence requirements.
2. Define a break-glass data model or external control-plane integration for approval, expiry, scope, and audit metadata.
3. Add authorization-policy support for break-glass scopes without bypassing capability checks globally.
4. Add audit and alert events for break-glass lifecycle events.
5. Add tests proving `DEV_ADMIN_BYPASS` cannot operate in production and break-glass access expires/fails closed.
6. Run a tabletop exercise for admin lockout, audit-write failure, and GDPR job failure.
7. Mark this ADR Accepted only after runbooks, tests, audit coverage, and alerting exist.

### Not Yet Implemented

- Production break-glass mechanism.
- Incident-response runbook for admin-specific incidents.
- Break-glass approval, expiry, audit, and alerting tests.
- Tabletop exercise evidence.

## Consequences

Emergency access becomes auditable and bounded rather than an implicit environment toggle or manual database intervention. The implementation adds operational overhead, but it prevents emergency procedures from weakening the normal security model.

The admin team must maintain owner/approver lists and review break-glass events after each use.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- __tests__/security
pnpm --filter admin check-security-drift
```

Incident-response readiness also requires a non-code verification artifact: record the date, participants, scenario, findings, and follow-up actions from each tabletop exercise in `apps/admin/docs/VERIFICATION.md` or a linked incident-readiness log.

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md`
- `apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md`
- `apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md`
- CISA Secure by Design: <https://www.cisa.gov/securebydesign>
