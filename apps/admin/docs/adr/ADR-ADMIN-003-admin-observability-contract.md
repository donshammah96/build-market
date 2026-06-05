# ADR-ADMIN-003: Admin Observability Contract

## Status

Accepted

## Context

Admin currently uses client-oriented logging helpers and `console.*` calls. Phase 0 found 104 console calls in action/lib surfaces and PII-bearing log contexts.

## Decision

Admin adapter layers emit structured events with at least `correlationId`, `operationName`, `adminRole`, `outcome`, `httpStatus` where applicable, and `durationMs`.

Never log `userId`, `clerkId`, `userEmail`, `email`, `phone`, `nationalId`, request bodies, or response bodies. `adminRole` is safe to log because it is a capability enum rather than an identity.

`operationName` is a stable join key in `<verb>_<resource>` form. Renames require coordinated documentation and dashboard updates. Services and repositories do not log routine operation outcomes; adapter layers do.

## Alternatives Considered

**Per-request structured middleware logging:** A Next.js middleware that attaches a correlation ID and logs all inbound/outbound edges was considered. Rejected because admin actions are Next.js server actions — not HTTP route handlers — and middleware does not intercept them. A middleware-only strategy would produce logs for page navigations but miss the majority of admin mutations.

**Third-party APM agent (Sentry, Datadog):** Instrumenting with an APM SDK would provide distributed tracing without custom code. Rejected for the initial implementation because it introduces a runtime dependency into every action and the PII-exclusion constraints require custom scrubbing anyway. A future phase may layer APM on top of the structured log stream.

**Console.log with structured arguments:** `console.log(JSON.stringify({ ... }))` provides structured output with no dependencies. Retained as the fallback when the `ADMIN_V2_STRUCTURED_LOGGING` flag is disabled. When the flag is enabled, the logger writes directly to `process.stdout` so log aggregators parse newline-delimited JSON without shell quoting artifacts.

## Consequences

Existing client logger usage and console logging become migration targets. Drift tooling must flag PII keys and unstructured console calls in admin server surfaces.

## Verification

`admin:report-security-drift:strict` reports zero unsafe log calls and PII log keys before the observability phase closes.

## Revision History

| Date       | Author        | Change                                                                       |
| ---------- | ------------- | ---------------------------------------------------------------------------- |
| 2026-06-04 | Phase 7 impl  | Initial acceptance. Branch: `feat/admin-overhaul/observability`.             |
| 2026-06-04 | Phase 12 impl | Zero drift findings confirmed; PII runtime scrub added to structured logger. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).                 |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-005-cannonical-observability-contract.md`
