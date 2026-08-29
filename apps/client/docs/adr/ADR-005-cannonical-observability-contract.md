# ADR-005: Canonical Observability Contract

## Status

Accepted

## Context

`apps/client` route handlers emit log events today, but without a defined field contract. The result is three concrete problems:

**Uncorrelatable failures.** When a user reports an error, finding the corresponding server log requires matching approximate timestamps against unstructured message strings. `correlationId` exists as a primitive in `initializeCorrelationId()` but is not consistently forwarded to log events.

**No role-disaggregated signal.** Auth and authorization failures are logged as unstructured strings. There is no way to detect that `forbidden` errors are spiking for `homeowner` actors but not `professional` actors — which would be the first observable signal of a role-gating regression — without manually parsing log messages.

**PII leakage risk.** Without an explicit boundary, engineers making ad-hoc logging decisions log whatever is convenient: user IDs, email addresses, request body content. There is no architectural rule preventing this, and no review signal that would catch it.

These are not logging style problems. They are architectural gaps because they make specific categories of production failure undetectable and because they create uncontrolled compliance surface.

## Decision

Establish a canonical observability contract for `apps/client` with four binding components.

### 1. Structured Log Field Contract

Every log event emitted from the adapter layer must carry this minimum field set. Fields are non-negotiable for production log events. Optional fields may be omitted when genuinely not applicable.

**Required fields:**

| Field           | Type                                                                                      | Description                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `correlationId` | `string`                                                                                  | From `initializeCorrelationId(req)`. Threads through the full request lifecycle. Must be included in API response headers for client-side error reporting. |
| `operationName` | `string`                                                                                  | Stable `<verb>_<resource>` identifier. See §3.                                                                                                             |
| `actorRole`     | `UserRole`                                                                                | The actor's role enum value. Safe to log; contains no identifying information.                                                                             |
| `outcome`       | `"success" \| "domain_error" \| "validation_error" \| "rate_limited" \| "internal_error"` | The request's terminal outcome.                                                                                                                            |
| `httpStatus`    | `number`                                                                                  | The HTTP status code actually returned.                                                                                                                    |
| `durationMs`    | `number`                                                                                  | Wall-clock milliseconds from request receipt to response.                                                                                                  |

**Optional fields (include when meaningful):**

| Field            | Type        | Description                                                                                                      |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `domainError`    | `string`    | The `DomainError` union value when `outcome` is `domain_error`. E.g. `"forbidden"`, `"not_found"`, `"conflict"`. |
| `actorAdminRole` | `AdminRole` | Optional enum for admin-gated operations. Safe to log; supports anomaly detection on admin capability misuse.    |
| `resourceType`   | `string`    | The resource kind. E.g. `"project"`, `"property"`.                                                               |
| `resourceId`     | `string`    | UUID-keyed resource identifier. Safe for non-PII resource IDs only.                                              |

### 2. PII Exclusion Rules

These are hard rules. No exception is acceptable without explicit data-handling sign-off.

- **Never log:** `userId`, `clerkId`, `userEmail`, `phone`, `nationalId`, `idNumber`, or any field that identifies a natural person.
- **Never log:** request body values. Log the names of fields that failed Zod validation, not their values.
- **Never log:** response body content. Log the DTO type name and the outcome, not the payload.
- **Safe to log:** `actorRole` (enum, no identity). `resourceId` for UUID-keyed resources. `correlationId` (system-generated, no identity).
- **Safe to log:** `actorAdminRole` for admin-gated operations. This is a capability enum value, not identity.
- **Not safe to log:** `resourceId` for resources keyed on user-controlled slugs, display names, or any user-provided string.

**Rationale.** PII in logs creates compliance surface that outlives debugging value. Structured role and outcome fields provide the operational signal needed without exposing identity. A `forbidden` spike for `homeowner` actors is detectable from `actorRole` alone.

### 3. `operationName` Convention

`operationName` is the join key between application code and the observability platform. It must be:

- **Stable.** Renaming an `operationName` silently breaks any dashboard query or alert rule that references it.
- **Globally unique within `apps/client`.** Format: `<verb>_<resource>`. Examples: `create_project`, `update_property`, `send_message`, `delete_portfolio_item`, `submit_professional_onboarding`.
- **Defined at the slice level.** New operations must be documented in the domain's contracts file or domain README with a comment marking them as observable operation names.
- **Treated as a public name for breaking-change purposes.** A rename requires a coordinated dashboard update in the same deploy window and a changelog entry.

The `operationName` field is already present on `getResilientExecutor().execute()`. The contract extends this to require it in every log event from the adapter layer as well.

### 4. Layer Logging Responsibilities

**Adapter layer (routes, server actions)** is responsible for:

- Emitting one structured log event per request at the point of response.
- Setting log level: `warn` for expected domain errors (`forbidden`, `not_found`, `conflict`); `error` for infrastructure failures and unexpected throws; `info` for successful operations on critical flows.

**Resilience executor** handles retry and circuit-breaker event logging internally. Routes must not re-implement this.

**Domain services** must not call `getClientLogger()`. They return `Result<T, DomainError>`. The adapter receiving the result logs. Logging inside a domain service couples a pure business layer to an infrastructure dependency and produces duplicate events.

**Repositories** do not log. Persistence errors propagate as thrown exceptions caught by the resilience executor.

**Browser-side code** (hooks, facades, components) does not emit server-structured log events. Client-side errors are captured by the existing error-boundary and Sentry integration. The structured log contract applies only to the server-side adapter layer.

### 5. Alignment With The Canonical Remediation Stream

This ADR is the architecture policy source for `ADD-005` and `DRIFT-001` in `AUDIT-OWASP-ASVS-CLIENT-ARCHITECTURE.md`.

- Blocking gates must enforce log-safety invariants through `pnpm run check-log-safety` and `pnpm run client:report-security-drift:strict`.
- Non-zero `logSafety` or `logSafetySpreadReview` drift categories are release blockers until resolved or explicitly approved via remediation review.
- Any change to allowed or prohibited log fields in this ADR must ship in the same change window as matching scanner/test updates under `apps/client/scripts/**`.

### What this ADR does not decide

- **Observability platform choice.** Datadog, Grafana Loki, CloudWatch Logs Insights, or any other backend. The structured field contract is platform-agnostic.
- **Alert thresholds.** What constitutes an acceptable `forbidden` rate or p95 latency for a specific operation is operational configuration, not architecture. Thresholds belong in the platform config and change without a code review or ADR.
- **Dashboard layout.** The four required metric surfaces (auth redirect rate, auth fallback rate, action error class distribution, p95 latency of critical operations) are defined in `API-TO-FRONTEND-ARCHITECTURE.md` Section 5.6. Their visual arrangement is operational.

## Consequences

### Positive

- Production failures in auth, authorization, and latency become detectable from structured signal rather than from user reports.
- PII exclusion rules are architectural, not a code-review afterthought. Engineers know at implementation time what cannot go in a log event.
- `operationName` as a stable join key makes metrics reliable. A dashboard that worked last month still works after a refactor, unless an `operationName` was deliberately renamed with a coordinated update.
- Domain services stay pure. Moving logging responsibility to the adapter layer keeps the domain layer free of infrastructure dependencies.

### Negative

- Retrofitting the structured contract onto existing routes requires a pass over all existing adapter-layer log calls. This is a migration, not a rewrite — each route's error branch needs the new fields added.
- `operationName` stability is a discipline constraint. Engineers must recognize that renaming a string constant in a route file has an observability consequence.

## Migration Notes

1. Add the structured log helper (a thin wrapper over `getClientLogger()` that enforces the required fields at the type level) to `app/lib/infrastructure/` before migrating existing routes. This makes the contract machine-checkable rather than convention-based.
2. Migrate route handlers in the same priority order as the domain migration queue: professionals → calendar → idea books → notifications → seller dashboard → reviews. Routes for already-migrated slices should be retrofitted in parallel.
3. Add the PII exclusion rules to the code review checklist and to the ESLint config as a custom rule if a programmatic check is feasible (e.g., blocking `logger.*({ ...ctx, userId })` patterns).
4. Define the four required metric surfaces in the observability platform after the first batch of routes emits structured events. Do not configure metrics against unstructured logs — wait for the contract to be in place.
5. Add `operationName` values to slice domain READMEs as they are introduced. The inventory does not need to be retroactive on day one, but every new operation after this ADR is accepted must be documented.
