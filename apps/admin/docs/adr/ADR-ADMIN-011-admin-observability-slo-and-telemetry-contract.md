# ADR-ADMIN-011: Admin Observability SLO and Telemetry Contract

## Status

Proposed

## Context

ADR-ADMIN-003 defines structured admin logging, PII exclusion, stable `operationName` values, and adapter-layer logging. The production-readiness audit found that `apps/admin` still needs an operations-level contract for service-level objectives, metrics, trace/log correlation, dashboards, alerts, and runbooks.

The admin app already contains observability surfaces such as `src/lib/infrastructure/logger.ts`, `src/lib/infrastructure/correlation.ts`, `src/lib/infrastructure/otel.ts`, `src/instrumentation.ts`, and operation-name conventions. Those surfaces are necessary but not sufficient for production: security and compliance incidents require deterministic detection, triage, and escalation.

This ADR extends ADR-ADMIN-003 from structured logging into an SLO-backed telemetry contract aligned with OpenTelemetry semantic conventions and OWASP logging/monitoring expectations.

## Decision

`apps/admin` must define service-level indicators and service-level objectives for the following production workflows:

- Admin route availability and latency.
- Server action success, domain-error, validation-error, forbidden, unauthorized, rate-limited, stale-session, and internal-error outcomes.
- High-risk mutation audit write success.
- Auth/session resolution success and denial rates.
- Queue lag, job duration, retry count, dead-letter count, and poison-message count.
- Export generation, GDPR erasure/anonymization, data retention, asset cleanup, and compliance queue health.

Telemetry must use OpenTelemetry-compatible resource attributes, including `service.name`, `service.version`, `deployment.environment`, and stable operation names. Logs, metrics, and traces must share `correlationId`/trace context wherever the runtime can propagate it.

The admin telemetry contract must define:

- Metric names, units, labels, and cardinality limits.
- Dashboard panels for P0/P1 workflows.
- Alert thresholds and escalation owner for each P0/P1 workflow.
- Runbook links for each alert.
- PII redaction requirements matching ADR-ADMIN-003.
- Sampling policy for traces and retention policy for logs/metrics/traces.

Adapter layers may emit routine operation telemetry. Services and repositories must not emit routine request outcome logs, but they may expose domain metrics through explicit instrumentation helpers when needed for queue/job internals.

### Rollout Sequence

1. Inventory existing `operationName` values in actions, routes, jobs, and queue workers.
2. Add a telemetry contract document or generated registry that maps each operation to SLI/SLO, labels, dashboard, alert, and owner.
3. Add metrics helpers for action outcomes, route outcomes, queue/job health, audit write outcomes, and export/GDPR lifecycle events.
4. Wire OpenTelemetry resource attributes from the stricter env governance contract in ADR-ADMIN-013.
5. Add staging smoke tests that assert telemetry emission for one route, one action, and one job/queue path.
6. Add dashboard and alert links to `apps/admin/docs/VERIFICATION.md` and relevant runbooks.
7. Mark this ADR Accepted only after telemetry is emitted, dashboards exist, and alert/runbook ownership is documented.

### Not Yet Implemented

- SLO registry for admin operations.
- Metrics helpers and queue/job health metrics across all P0/P1 workflows.
- Dashboard and alert definitions.
- Staging telemetry smoke tests.

## Consequences

Observability becomes part of the admin release contract, not a best-effort logging implementation. Feature teams adding admin operations must provide telemetry metadata alongside authorization, validation, and audit metadata.

Cardinality must be controlled aggressively. Admin role, operation name, outcome, route class, job name, and queue name are acceptable labels. Raw user identifiers, emails, target names, request bodies, and unbounded IDs are not acceptable metric labels or log fields.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- __tests__/observability
pnpm --filter admin report-security-drift:strict
```

For staging/prod smoke verification, run the documented telemetry smoke command added to `apps/admin/docs/VERIFICATION.md` and confirm route/action/job events appear in the configured telemetry backend with shared correlation or trace context.

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md`
- `apps/admin/docs/VERIFICATION.md`
- OpenTelemetry Semantic Conventions: <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- OWASP Top 10: <https://owasp.org/Top10/>
