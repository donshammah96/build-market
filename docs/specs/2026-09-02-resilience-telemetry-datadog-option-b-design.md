# Resilience Telemetry and Datadog Logging: Option B Design

**Status:** Approved design
**Date:** 2026-09-02
**Decision owner:** Platform Engineering
**Scope:** `packages/resilience`, `packages/telemetry`, Node application environment templates, and the existing Cloudflare log forwarder configuration.

## Executive decision

Adopt **Option B: application-managed Datadog log shipping** for long-lived Node.js workloads, implemented as the sole structured logger owned by `@build/resilience`. The logger continues to write structured, redacted NDJSON to stdout on every runtime.

For Vercel functions, Option B is not the reliability boundary: stdout remains authoritative and the Datadog Vercel integration with Log Drain must forward it. An in-process HTTP transport cannot guarantee delivery after a serverless invocation ends. For long-lived workers, Option B provides direct, batched delivery with bounded memory and explicit shutdown flushing.

This replaces `@build/telemetry`'s current per-event, fire-and-forget HTTP logger. `@build/telemetry` remains responsible only for OpenTelemetry bootstrap.

## Why this decision

The repository has two different logging implementations:

- `packages/resilience/src/logger.ts` is Pino-backed, supports correlation IDs and active OTel span context, and writes only to stdout.
- `packages/telemetry/src/logger.ts` writes to local console plus a fire-and-forget HTTP request for every event. Its redaction list differs from resilience's list, and its `LoggerConfig`/`Logger` API is incompatible with resilience's API.

The two implementations create divergent PII controls and different delivery semantics. Keeping both is an operational and compliance risk.

The prior audit correctly identified that resilience logs do not reach Datadog through the direct telemetry logger. It needs these corrections:

1. Proposed Datadog variables must use the repository convention: `DD_*`, not `DATADOG_*`.
2. Re-exporting resilience's `createLogger(serviceName)` from telemetry would be an API break: telemetry currently accepts `createLogger({ service, env, apiKey, siteHost })` and exposes a different error method shape. It must be removed through an explicit migration, not disguised as a drop-in re-export.
3. A generic third-party Pino Datadog transport must not be adopted without an ownership, lifecycle, and backpressure review. It is not acceptable to replace one unbounded fire-and-forget HTTP path with another opaque one.
4. Vercel serverless delivery cannot depend on a background batch flush. Datadog's Vercel integration supports Log Drain and should forward the stdout records already emitted by Pino. The direct transport is supplemental there, disabled by default.

Datadog's HTTP Logs API accepts batched JSON logs, limits an uncompressed payload to 5 MB and an array to 1,000 entries, and supports the `DD-API-KEY` header. Pino recommends transports run in worker threads. Those facts support a bounded Pino transport for persistent Node processes, not unawaited per-record `fetch` calls in request lifecycles. See [Datadog Logs API](https://docs.datadoghq.com/api/latest/logs/send-logs/), [Datadog Vercel integration](https://docs.datadoghq.com/integrations/vercel/), and [Pino transports](https://getpino.io/).

## Current-state audit

| Area                                    | Finding                                                                                                                                             | Risk                                                                  | Required disposition                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `resilience/logger.ts`                  | Good Pino foundation, but stdout is its only sink.                                                                                                  | Resilience events are absent from direct Datadog ingestion.           | Retain as the one logger; add controlled Option B sink.                                            |
| `telemetry/logger.ts`                   | Per-line unawaited `fetch`, errors swallowed, divergent redaction.                                                                                  | Log loss at serverless suspension, costs/connection churn, PII drift. | Remove after import inventory proves no live consumers.                                            |
| `resilience/config.ts`                  | Empty strings coerce to `0`; invalid numeric domains are accepted; histogram empty segments become a zero bucket.                                   | Bad production resilience configuration.                              | Fix as an independent reliability gate.                                                            |
| `resilience/cache.ts` and `executor.ts` | SWR boundary is ineffective in orchestration; fallback values can be cached; default cache key collides for parameterized calls.                    | Incorrect/stale or cross-request data returned.                       | Fix before broad rollout.                                                                          |
| `circuit-breaker.ts`                    | Half-open allows unbounded concurrent probe calls.                                                                                                  | Recovery thundering herd and immediate re-open.                       | Add bounded half-open probes.                                                                      |
| `metrics.ts`                            | Histograms are omitted from bulk snapshots and samples are unbounded; no exporter exists.                                                           | Memory growth and misleading observability.                           | Bound/repair locally; defer exporter replacement to OTel Metrics phase.                            |
| environment templates                   | Existing applications use `DD_API_KEY`, `DD_SERVICE`, `DD_ENV`, and mostly `DD_SITE_HOST`; client Vercel template lacks the complete Datadog block. | Inconsistent deploy configuration.                                    | Standardize on `DD_SITE`; retain deprecated read compatibility for `DD_SITE_HOST` for one release. |

## Architecture

```mermaid
flowchart LR
  R[Resilience primitives] --> L[One Pino logger in @build/resilience]
  A[Application adapter logs] --> L
  L --> O[Redacted NDJSON stdout]
  O --> V[Vercel Log Drain]
  V --> D[Datadog Logs]
  L --> B[Option B bounded Datadog transport]
  B --> D
  T[@build/telemetry OTel bootstrap] --> D
```

### Runtime delivery contract

| Runtime                                 | Required log path                       | Option B behavior                                                                                                             | Delivery expectation                                                       |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Vercel Node serverless                  | Pino stdout -> Datadog Vercel Log Drain | Disabled by default. It may be enabled only after proving per-invocation flush behavior; it is never the sole delivery route. | Platform drains provide durable off-process delivery after output capture. |
| `apps/workers` / persistent Node daemon | Pino stdout plus bounded HTTP transport | Enabled with `DD_LOGS_ENABLED=true` and a valid `DD_API_KEY`.                                                                 | Best effort in process; `flush()` on graceful SIGTERM/SIGINT is mandatory. |
| Cloudflare Workers                      | Existing `workers/dd-tail-forwarder`    | Do not import Node/Pino transport. Standardize its bindings separately.                                                       | Tail worker batches and awaits its API request.                            |
| local/test                              | stdout/test destination only            | Disabled unless an explicit integration test injects a fake sink.                                                             | No credentials or network calls.                                           |

## Datadog configuration contract

All Datadog-owned variables use the `DD_*` prefix. Application-neutral logging controls (`LOG_LEVEL`, `LOG_FORMAT`) stay unchanged.

| Variable          | Required                                                                             | Default                   | Rule                                                                  |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------- |
| `DD_API_KEY`      | Yes when direct logs, OTLP authorization, or a runtime's tracing integration uses it | unset                     | Secret; never write it to logs or client bundles.                     |
| `DD_SITE`         | No                                                                                   | `us5.datadoghq.com`       | Canonical Datadog site host without a URL scheme.                     |
| `DD_SERVICE`      | Yes in deployed runtimes                                                             | runtime-specific name     | Stable service identity; matches OTel service naming.                 |
| `DD_ENV`          | Yes in deployed runtimes                                                             | `development` locally     | One of the deployment environment labels approved by operations.      |
| `DD_VERSION`      | Yes in deployed runtimes                                                             | build/revision identifier | Immutable release or commit identity.                                 |
| `DD_LOGS_ENABLED` | No                                                                                   | `false`                   | Direct Option B transport opt-in. It is valid only with `DD_API_KEY`. |

`DD_SITE_HOST` is a deprecated compatibility alias, read only when `DD_SITE` is absent. It is removed after one release with no remaining template, code, or deployment references. `DATADOG_*` variables are not introduced.

Every applicable `.env.example` file must document the same semantics. At minimum this includes `apps/client/.env.example`, `apps/client/.env.vercel.example`, `apps/admin/.env.example`, `apps/workers/.env.example`, `apps/verification-ops/.env.example`, and Cloudflare worker configuration. Service values remain runtime specific.

## Logger and safety contract

1. `@build/resilience` owns the only Node structured logger API.
2. Pino writes redacted NDJSON to stdout in production; local pretty printing remains development-only.
3. A recursive sanitizer and Pino `redact` are both required. The canonical case-insensitive deny-list includes at least `password`, `token`, `accessToken`, `refreshToken`, `authorization`, `secret`, `apiKey`, `creditCard`, `cvv`, `kraPin`, `mpesaRecords`, `tokenHash`, `nationalId`, `clerkId`, `email`, and `phone`.
4. Sanitization is performed before either sink receives a record. Tests must assert that stdout and direct Datadog payloads contain the same redacted record.
5. The logger adds `correlationId`, OTel trace/span context, and Datadog unified tags (`service`, `env`, `version`). It must emit `dd.trace_id` and `dd.span_id` in the representation Datadog uses for log-trace correlation.
6. Log shipping is fail-open: application work cannot fail because Datadog is unavailable. The transport records bounded internal diagnostics to stdout without logging request payloads or secrets.
7. The sink uses a bounded queue, capped batch count/bytes below the Datadog API limits, retry with jitter, maximum retry budget, and a dropped-record counter. It never creates one HTTP request per event.
8. The transport interface exposes `flush(): Promise<void>` and `close(): Promise<void>`. Persistent runtime bootstrap owns signal handling and awaits a bounded close. Route handlers and domain services never await log delivery.

## Package migration contract

`packages/telemetry/src/logger.ts` is removed, along with its `createLogger`, `Logger`, and `LoggerConfig` exports. It must not re-export resilience's API under the old name because the contracts differ.

Before removal, CI performs an import inventory for `@build/telemetry` logger symbols. The only permitted remaining `@build/telemetry` import is `initTracing` and its tracing types. The telemetry package remains a tracing bootstrap package.

## Resilience correctness gates

The following are rollout blockers because they can return incorrect data independently of telemetry:

1. Never cache a fallback result. Add an explicit execution outcome that distinguishes cache hit, fallback, success, timeout, and circuit short-circuit.
2. Require a caller-supplied cache key for any cached parameterized operation. A cache configuration without `cacheKey` is valid only for an explicitly declared unparameterized operation.
3. Make stale-while-revalidate real: the stale threshold is TTL, hard expiry is TTL plus SWR window, and executor orchestration uses the cache API that performs SWR. Preserve the existing resilience pipeline for recomputation.
4. Permit only the configured number of half-open probes (one initially); concurrent callers receive a typed circuit-open result and do not call the dependency.
5. Reject blank numeric environment values and impose positive/integer/range constraints appropriate to retries, circuit thresholds, timeout durations, cache size, and histogram buckets.
6. Bound histogram samples and include histogram aggregates in snapshots. Do not build a bespoke periodic metrics exporter in this change; move metric export to a separately approved OTel Metrics phase.
7. Extend timeout APIs with `AbortSignal` where consumers can honor cancellation. A timeout remains an observation, not proof that a side effect did not occur; payment and booking call sites need idempotency/reconciliation separately.

## Non-goals

- Replacing trace bootstrap or migrating logs and metrics to the OTel Logs/Metrics SDK in this delivery.
- Retrofitting every route's structured application logging contract; ADR-005 remains the governing policy for that work.
- Treating an HTTP transport as exactly-once delivery, a durable queue, or an audit-event store.
- Changing Cloudflare worker runtime architecture.

## Rollout and rollback

1. Ship correctness fixes with unit coverage before enabling new sinks.
2. Ship the consolidated logger with direct logs disabled. Validate stdout field shape and redaction in development and preview.
3. Enable the Vercel Datadog Log Drain and verify logs, traces, `service`, `env`, `version`, and correlation fields in a preview environment.
4. Enable `DD_LOGS_ENABLED=true` only for one non-production persistent worker. Exercise success, transient intake failure, queue saturation, graceful termination, and transport-disabled paths.
5. Promote to production persistent workers after dropped-record and error telemetry remain within the agreed error budget for a full operating window.
6. Remove the direct transport by setting `DD_LOGS_ENABLED=false`; stdout logging remains intact. Re-enable legacy telemetry logging is not a rollback path because it is being retired for reliability and safety reasons.

## Success criteria

- A resilience event can be found in Datadog by `service`, `env`, `version`, `correlationId`, and trace context.
- No known sensitive field appears in stdout or direct intake test payloads, including deeply nested fields.
- Vercel logs arrive through the Datadog Log Drain with the expected service identity.
- Persistent-worker direct delivery batches logs, uses bounded memory, reports drops/failures safely, and flushes on graceful shutdown.
- The telemetry logger has no production importers and is deleted without API ambiguity.
- Regression tests cover every correctness gate listed above.

## Follow-on decision

After this rollout is stable, evaluate OTel Metrics and Logs as a separate architecture proposal. The proposal must prove exporter compatibility with the selected Datadog site, context propagation, metric cardinality controls, lifecycle flush behavior, and migration away from `MetricsCollector` without duplicating metric streams.
