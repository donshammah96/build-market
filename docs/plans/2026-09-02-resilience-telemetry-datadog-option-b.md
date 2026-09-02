# Resilience Telemetry and Datadog Option B Implementation Plan

**Goal:** Make `@build/resilience` the single Node structured logger; deliver resilient logs to Datadog through a bounded Option B transport for persistent workers while preserving stdout/Datadog Log Drain as the Vercel serverless delivery path.

**Design:** [Option B design](../specs/2026-09-02-resilience-telemetry-datadog-option-b-design.md)

**Architecture & Tier Alignment:**

- Target packages: `packages/resilience`, `packages/telemetry`
- Runtime integration: `apps/workers`, `apps/client`, `apps/admin`, `apps/verification-ops`, `workers/dd-tail-forwarder`
- Client policy: ADR-004 (environment boundary), ADR-005 (canonical observability), ADR-006 (data classification)
- Admin policy: ADR-ADMIN-003 (observability), ADR-ADMIN-006 (environment boundary)
- No route, domain-service, repository, DTO, Prisma, or admin mutation boundary changes are authorized by this plan. `apps/client` and `apps/admin` only receive configuration/instrumentation changes.

## User Review Required

This plan deliberately breaks the private `@build/telemetry` logging API: `createLogger`, `Logger`, and `LoggerConfig` are deleted rather than re-exporting the incompatible resilience API. Before implementation, confirm the repository-wide import inventory has no consumer outside this workspace that requires a coordinated migration.

`DD_API_KEY` is a secret and `DD_LOGS_ENABLED` controls paid external ingestion. Operations must approve the production service/environment/version naming and Datadog retention/alert policy before the production enablement task. The transport is best-effort, not an audit log or a durable queue.

## Invariants

1. Production Pino logs always emit redacted NDJSON to stdout.
2. Vercel logging reaches Datadog through the Vercel Log Drain; an in-process transport is never its only delivery path.
3. Direct Datadog delivery is disabled unless both `DD_LOGS_ENABLED=true` and `DD_API_KEY` are present.
4. `DD_SITE` is canonical. `DD_SITE_HOST` is a temporary read-only fallback for one release; no template writes it after this work.
5. The same sanitized record reaches stdout and the direct sink. Neither contains known sensitive data, even when nested.
6. Shipping failures cannot alter application results. Memory, batches, retries, and shutdown time are bounded.
7. Fallback results never enter cache, cache keys cannot collide across parameterized inputs, and half-open circuits never fan out unbounded probes.

## Delivery order

1. Test and correct the resilience semantics first.
2. Establish the Datadog configuration contract and bounded transport.
3. Wire only persistent Node workers to direct delivery and graceful flush.
4. Retire the telemetry logger after the import gate passes.
5. Configure/verify platform drains and promote progressively.

## Proposed Changes

### 1. Establish the resilience configuration and outcome contracts

#### [MODIFY] `packages/resilience/src/types.ts`

- **Interfaces consumed:** Existing `CacheConfig`, `ResilienceOptions`, and `OperationResult<T>`.
- **Interfaces produced:** A typed cache identity and terminal execution state usable by cache, executor, metrics, and callers.

- [ ] **Step 1: Write failing contract tests**

  Create `packages/resilience/src/__tests__/config.test.ts` and extend the new executor tests to assert:

  - blank `RETRY_MAX_ATTEMPTS` is rejected or treated as unset according to the chosen explicit schema behavior; it must never become `0`;
  - non-positive retry/circuit values and malformed/empty histogram segments fail with the variable name;
  - `DD_LOGS_ENABLED=true` without `DD_API_KEY` fails fast;
  - `DD_SITE` wins over `DD_SITE_HOST`, and `DD_SITE_HOST` is accepted only as a compatibility fallback;
  - an execution result distinguishes `success`, `cache_hit`, `fallback`, `timeout`, and `circuit_open` without inferring state from booleans.

- [ ] **Step 2: Verify RED**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/config.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL because the schema accepts blank numeric values and no Datadog or outcome contract exists.

- [ ] **Step 3: Add the minimum explicit types**

  In `types.ts`, add:

  ```ts
  export type ResilienceOutcome =
    | "success"
    | "cache_hit"
    | "fallback"
    | "timeout"
    | "circuit_open";

  export interface ResilienceOptions<T = unknown> {
    // Existing options, with fallback typed to the executed value.
    fallback?: () => Promise<T>;
    cacheKey?: string;
  }

  export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    outcome: ResilienceOutcome;
    fromCache?: boolean;
    fromFallback?: boolean;
    attempts: number;
    duration: number;
  }
  ```

  Preserve `fromCache`/`fromFallback` for compatibility, but derive them solely from `outcome`. Require `cacheKey` whenever `cache` is enabled; calls with a constant operation must pass a deliberate constant key, such as `"global"`.

- [ ] **Step 4: Harden `packages/resilience/src/config.ts`**

  - Replace `z.coerce.number()` preprocessing with a helper that turns trimmed `""` into `undefined` before coercion.
  - Apply `int().positive()` to retry attempts, cache size, circuit thresholds, and duration-like integer fields; apply non-negative bounds only where zero is meaningful.
  - Reject any empty `METRICS_HISTOGRAM_BUCKETS` segment, require finite positive ascending bucket values, and report the full variable name.
  - Add `DD_API_KEY`, `DD_SITE`, deprecated `DD_SITE_HOST`, `DD_SERVICE`, `DD_ENV`, `DD_VERSION`, and `DD_LOGS_ENABLED` to the schema and `ResilienceEnvConfig.logging.datadog`.
  - Resolve `site` as `DD_SITE ?? DD_SITE_HOST ?? "us5.datadoghq.com"`; resolve service/environment/version from `DD_*` with safe local defaults; reject direct logging without an API key.
  - Make `setConfig()` merge onto `getConfig()` rather than reparsing `process.env`, so sequential test overrides compose.

- [ ] **Step 5: Verify GREEN**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/config.test.ts --pool=threads --maxWorkers=1`

  Expected: PASS with all invalid configuration cases failing deterministically and all `DD_*` precedence cases passing.

- [ ] **Step 6: Typecheck checkpoint**

  Run: `pnpm -C packages/resilience run check-types`

  Expected: PASS.

### 2. Correct cache, executor, retry, circuit-breaker, timeout, and metric semantics

#### [MODIFY] `packages/resilience/src/cache.ts`, `executor.ts`, `circuit-breaker.ts`, `retry.ts`, `timeout.ts`, `metrics.ts`

- **Interfaces consumed:** The explicit `cacheKey`, `ResilienceOutcome`, `AbortSignal`, cache, circuit, retry, and metric contracts from task 1.
- **Interfaces produced:** Correct cache/SWR behavior, bounded recovery probes/samples, and truthful execution state.

- [ ] **Step 1: Write the failing behavior tests**

  Add `executor.test.ts`, `circuit-breaker.test.ts`, `retry.test.ts`, `timeout.test.ts`, and `metrics.test.ts` under `packages/resilience/src/__tests__/`; extend `cache.test.ts`. Use fake timers for time boundaries and deferred promises for concurrency. Cover all of the following:

  - a fallback result is returned with `outcome: "fallback"` and is not cached;
  - two parameterized calls with the same operation name but different `cacheKey` values do not share values, and cache-enabled execution without `cacheKey` rejects before invoking the operation;
  - an entry is fresh before TTL, stale during `[TTL, TTL + SWR)`, returns stale while exactly one background revalidation runs, and recomputes after hard expiry;
  - concurrent callers in half-open allow one probe and all other callers receive `CircuitBreakerOpenError` without invoking the dependency;
  - `withRetry` rejects invalid `maxAttempts` before executing and always provides an `Error` as `RetryError.lastError`;
  - timeout calls pass an abort signal, trigger abort at deadline, clear timers on synchronous throws, and preserve the original error when the operation fails first;
  - histogram storage retains at most the selected cap, and `getMetrics()` includes an aggregate record for every histogram key.

- [ ] **Step 2: Verify RED**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/cache.test.ts src/__tests__/executor.test.ts src/__tests__/circuit-breaker.test.ts src/__tests__/retry.test.ts src/__tests__/timeout.test.ts src/__tests__/metrics.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL on the current default cache key, cached fallback, unreachable SWR flow, unlimited half-open calls, invalid retry handling, non-abortable timeout, and omitted/unbounded histogram behavior.

- [ ] **Step 3: Implement minimal cache and executor behavior**

  - Change `ResilientCache.getOrCompute()` to calculate `staleAt = timestamp + ttl` and hard expiry at `timestamp + ttl + staleWhileRevalidate`.
  - Ensure the LRU lifetime uses the same hard-expiry boundary.
  - Refactor `ResilientExecutor.execute()` to use `getOrCompute()` only for the successful pipeline result. The computation callback must execute timeout/retry/circuit logic and must not wrap the fallback path; fallback runs after a failed compute and bypasses cache writes.
  - Use `options.cacheKey` as the only cache key. Remove `${operationName}:default`.
  - Set `outcome`, `attempts`, and duration on every return/error branch. A circuit short-circuit has `attempts: 0`.

- [ ] **Step 4: Implement bounded recovery and validation behavior**

  - Add `halfOpenInFlight` (or a configurable `halfOpenMaxProbes` defaulting to one) to `CircuitBreaker`; set it atomically before awaiting the probe and clear it in `finally`.
  - Validate retry configuration before the attempt loop; use exact `error.name`/`error.code` matching for configured identifiers. Keep message matching only as an explicit documented legacy option if existing callers require it.
  - Change `withTimeout` to call `operation(signal: AbortSignal)` and compose a timeout controller with an optional caller signal. Update the wrapper and every compiler error site in the workspace.
  - Cap per-key histogram samples with a named constant, include a histogram aggregate in `getMetrics()`, and preserve metrics tags in the aggregate.

- [ ] **Step 5: Verify GREEN**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/cache.test.ts src/__tests__/executor.test.ts src/__tests__/circuit-breaker.test.ts src/__tests__/retry.test.ts src/__tests__/timeout.test.ts src/__tests__/metrics.test.ts --pool=threads --maxWorkers=1`

  Expected: PASS with no unhandled rejection from SWR revalidation failures.

- [ ] **Step 6: Update client callers and tests for explicit cache identity**

  Inventory every `getResilientExecutor().execute()` call under `apps/client` and `apps/admin`. For each cache-enabled call, add a deterministic, non-PII cache key based on the operation inputs or explicitly disable caching. Do not hash or log raw user identifiers to create this key.

  Run: `rg -n 'cache:\s*(true|\{)' apps/client apps/admin`

  Expected: Every match has `cacheKey` or has been changed to `cache: false`; no default cache key remains.

- [ ] **Step 7: Typecheck checkpoint**

  Run: `pnpm -C packages/resilience run check-types; pnpm --filter client run check-types; pnpm --filter admin run check-types`

  Expected: PASS. Fix contract changes at callers; do not weaken types with `any`.

### 3. Add the owned bounded Datadog Pino transport

#### [NEW] `packages/resilience/src/datadog-transport.ts`, `packages/resilience/src/datadog-pino-target.ts`, `packages/resilience/src/__tests__/datadog-transport.test.ts`

#### [MODIFY] `packages/resilience/src/logger.ts`, `packages/resilience/src/index.ts`, `packages/resilience/package.json`

- **Interfaces consumed:** `ResilienceEnvConfig.logging.datadog`, Pino transport/destination contract, native `fetch`, and the Datadog Logs API.
- **Interfaces produced:** `flushResilienceLogs(): Promise<void>`, `closeResilienceLogs(): Promise<void>`, and a Pino target whose exported factory consumes redacted NDJSON records.

- [ ] **Step 1: Write failing transport tests**

  Test the transport core with injected clock and HTTP client; do not contact Datadog. Assert:

  - disabled configuration produces no direct HTTP call;
  - records are serialized as a JSON array and posted to `https://http-intake.logs.<DD_SITE>/api/v2/logs` with `DD-API-KEY`;
  - direct payloads include `service`, `ddsource: "nodejs"`, `ddtags` containing `env`, `service`, and `version`, and `dd.trace_id`/`dd.span_id` when present;
  - a batch cannot exceed the configured record cap, byte cap, 1,000 records, or 5 MB uncompressed;
  - overflow drops the newest record (or the documented selected policy), increments a bounded diagnostic counter, and never throws from `write`;
  - retriable 429/5xx/network failures use capped jittered retry; permanent 4xx failures do not spin; `flush()` resolves after success, retry budget exhaustion, or deadline;
  - a sensitive nested object is redacted identically in stdout capture and the HTTP request body;
  - `close()` refuses subsequent writes and drains only within its deadline.

- [ ] **Step 2: Verify RED**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/datadog-transport.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL because no transport or lifecycle API exists.

- [ ] **Step 3: Build the core transport with explicit bounds**

  In `datadog-transport.ts`, implement a testable `DatadogBatchSink` with:

  ```ts
  export interface DatadogLogSink {
    write(record: Record<string, unknown>): void;
    flush(deadlineMs?: number): Promise<void>;
    close(deadlineMs?: number): Promise<void>;
  }
  ```

  Use fixed exported defaults for maximum queued records, maximum batch records, maximum serialized batch bytes, flush interval, retry count, and close deadline. Keep every value beneath Datadog's documented 1,000-record/5-MB limits. It must parse a Pino line once, enrich a copy with unified service tags, and hold no `LogContext` object after serialization.

- [ ] **Step 4: Adapt the core to Pino correctly**

  In `datadog-pino-target.ts`, export the Pino transport factory expected by the installed Pino major version. The target accepts newline-delimited records from Pino, invokes `DatadogBatchSink.write`, and closes on stream shutdown. Build it into package output and reference the compiled module from `logger.ts`; do not reference TypeScript source at runtime.

  In `logger.ts`:

  - replace the single pretty/JSON branch with a multi-target configuration: stdout is always one target; direct Datadog is added only when `DD_LOGS_ENABLED` is valid;
  - centralize the recursive sanitizer before transport fan-out and retain Pino `redact` as defense in depth;
  - extend trace context to emit both internal `traceId`/`spanId` and Datadog correlation fields without converting 128-bit trace IDs to lossy JavaScript numbers;
  - preserve `setTestDestination()` as a synchronous local-only test path;
  - own transport lifecycle internally and export `flushResilienceLogs`/`closeResilienceLogs` from `logger.ts` and `index.ts`.

  Do not add a generic external `pino-datadog-*` dependency.

- [ ] **Step 5: Verify GREEN and build packaging**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/logger.test.ts src/__tests__/datadog-transport.test.ts --pool=threads --maxWorkers=1; pnpm -C packages/resilience run build`

  Expected: PASS; the compiled package resolves its Pino target and has no network calls in standard logger tests.

- [ ] **Step 6: Security and performance regression check**

  Add a test with nested objects, arrays, circular objects, and Error causes. Capture both sinks and assert no values for `password`, `token`, `authorization`, `secret`, `apiKey`, `kraPin`, `mpesaRecords`, `tokenHash`, `nationalId`, `clerkId`, `email`, or `phone` survive.

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/logger.test.ts src/__tests__/datadog-transport.test.ts --pool=threads --maxWorkers=1`

  Expected: PASS with Pino-safe serialization and redaction in both outputs.

### 4. Wire persistent workers to the transport and use one Datadog environment contract

#### [MODIFY] `apps/workers/src/env.ts`, `apps/workers/src/index.ts`, `apps/workers/src/tracer.ts`, `apps/workers/.env.example`, `apps/workers/__tests__/env.test.ts`, `apps/workers/__tests__/tracer.test.ts`

- **Interfaces consumed:** Validated `WorkerEnv`, `closeResilienceLogs`, `initTracer`, OTel shutdown.
- **Interfaces produced:** A daemon lifecycle that validates `DD_*` configuration before instrumentation and flushes direct logs before process exit.

- [ ] **Step 1: Write failing worker tests**

  Assert that `DD_SITE` overrides the legacy alias, `DD_LOGS_ENABLED` requires `DD_API_KEY`, and tracer initialization uses canonical `DD_SITE`. Add a mocked `closeResilienceLogs` shutdown-order test that verifies it is awaited after the final shutdown log and before `process.exit`.

- [ ] **Step 2: Verify RED**

  Run: `pnpm -C apps/workers exec vitest run __tests__/env.test.ts __tests__/tracer.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL because worker schema/templates retain `DD_SITE_HOST` as primary and shutdown has no logger close step.

- [ ] **Step 3: Implement worker integration**

  - Add `DD_LOGS_ENABLED` and canonical `DD_SITE` to the worker Zod schema; retain `DD_SITE_HOST` as optional legacy input only.
  - Remove the early raw `dd-trace` initialization in `apps/workers/src/index.ts`. Validate first, then call `initTracer(env)` so `DD_*` parsing and precedence have one source of truth.
  - In `initTracer`, prefer `DD_SITE` and retain alias fallback only.
  - Update graceful shutdown to write the completion log, await `closeResilienceLogs()` with a deadline shorter than the existing 30-second hard timeout, then invoke `shutdownOtel()` and exit. On timeout/error, log only safe transport diagnostics and continue shutdown.
  - Update the template with `DD_SITE`, `DD_SERVICE`, `DD_ENV`, `DD_VERSION`, and `DD_LOGS_ENABLED=false`. Never place a real `DD_API_KEY` in an example file.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm -C apps/workers exec vitest run __tests__/env.test.ts __tests__/tracer.test.ts --pool=threads --maxWorkers=1; pnpm -C apps/workers run check-types`

  Expected: PASS.

### 5. Standardize application and Cloudflare configuration without changing their runtime delivery model

#### [MODIFY] `apps/client/app/lib/infrastructure/env.ts`, `apps/client/.env.example`, `apps/client/.env.vercel.example`, `apps/client/__tests__/lib/env.validation.test.ts`

#### [MODIFY] `apps/admin/src/lib/infrastructure/env-schema.ts`, `apps/admin/src/lib/infrastructure/env-wrapper.ts`, `apps/admin/.env.example`

#### [MODIFY] `apps/verification-ops/lib/infrastructure/env.ts`, `apps/verification-ops/.env.example`

#### [MODIFY] `workers/dd-tail-forwarder/src/index.ts`, `workers/dd-tail-forwarder/wrangler.toml`, `workers/dd-tail-forwarder/__tests__/tail-forwarder.test.ts`

- **Interfaces consumed:** Each application's canonical environment boundary; Cloudflare `Env` bindings.
- **Interfaces produced:** Consistent `DD_*` examples and precedence rules, with no browser exposure of Datadog credentials.

- [ ] **Step 1: Write failing environment/forwarder tests**

  - Client/admin/verification environment tests must accept canonical `DD_SITE`, use `DD_SITE_HOST` only as fallback, and recognize `DD_LOGS_ENABLED` as server-only.
  - Cloudflare tail-forwarder tests must accept `DD_SITE`, prefer it, and still accept `DD_SITE_HOST` for the compatibility release.
  - Add a source-level guard that rejects `DATADOG_` variables and `DD_SITE_HOST` in all `.env.example` and `wrangler.toml` template paths after migration.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter client test -- __tests__/lib/env.validation.test.ts; pnpm -C workers/dd-tail-forwarder exec vitest run __tests__/tail-forwarder.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL because templates and forwarder still expose `DD_SITE_HOST` as primary and the logging opt-in is absent.

- [ ] **Step 3: Implement canonical configuration**

  - Add `DD_SITE`, `DD_VERSION`, and `DD_LOGS_ENABLED` to each server-side environment inventory/schema; `DD_LOGS_ENABLED` defaults to false and is never `NEXT_PUBLIC_*`.
  - Resolve site as `DD_SITE` first, then legacy `DD_SITE_HOST`, then `us5.datadoghq.com`. Surface this resolved value only in server-side observability config.
  - Rewrite every listed `.env.example` block to document only `DD_SITE`, and add the complete common metadata fields with the appropriate runtime-specific `DD_SERVICE` default.
  - Add the same canonical binding to `workers/dd-tail-forwarder`, migrate its TOML variables to `DD_SITE`, and keep its existing awaited batch request behavior unchanged.
  - Do not enable direct Option B delivery in client/admin/verification serverless functions. Configure their production projects for the Datadog Vercel integration and Log Drain outside application code.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm --filter client test -- __tests__/lib/env.validation.test.ts; pnpm -C workers/dd-tail-forwarder exec vitest run __tests__/tail-forwarder.test.ts --pool=threads --maxWorkers=1; rg -n 'DATADOG_|DD_SITE_HOST' apps/*/.env.example apps/client/.env.vercel.example workers/dd-tail-forwarder/wrangler.toml`

  Expected: tests PASS; the `rg` command returns no template hits. Compatibility aliases may remain only in server implementation code and alias-specific tests.

### 6. Retire the telemetry logger with an import gate

#### [DELETE] `packages/telemetry/src/logger.ts`, `packages/telemetry/src/__tests__/logger.test.ts`

#### [MODIFY] `packages/telemetry/src/index.ts`, `packages/telemetry/package.json`, repository changelog/release notes

- **Interfaces consumed:** Repository-wide `@build/telemetry` import inventory.
- **Interfaces produced:** Telemetry package exports only tracing bootstrap and tracing types.

- [ ] **Step 1: Establish the import gate**

  Run: `rg -n 'createLogger|LoggerConfig|Logger' packages apps --glob '*.{ts,tsx}' | rg '@build/telemetry|packages/telemetry'`

  Expected: Only the telemetry logger source/tests may initially appear. Investigate every result before deletion; external consumers require a versioned migration announcement.

- [ ] **Step 2: Write/adjust export tests**

  Add `packages/telemetry/src/__tests__/index.test.ts` that imports `initTracing` and `InitTracingOptions`; it must not expose the legacy logger exports. This test protects against accidentally recreating a second logger.

- [ ] **Step 3: Verify RED**

  Run: `pnpm -C packages/telemetry exec vitest run src/__tests__/index.test.ts --pool=threads --maxWorkers=1`

  Expected: FAIL while the legacy logger remains exported.

- [ ] **Step 4: Delete and document**

  Remove the logger module and its tests, remove logger exports from `index.ts`, and update the package description/changelog to state that `@build/telemetry` only initializes OTel. Do not add a compatibility re-export.

- [ ] **Step 5: Verify GREEN**

  Run: `pnpm -C packages/telemetry test; pnpm -C packages/telemetry run check-types; rg -n '@build/telemetry' packages apps --glob '*.{ts,tsx}'`

  Expected: telemetry tests and typecheck PASS; remaining imports use only `initTracing`/its types.

### 7. Validate release behavior and operational rollout

#### [NEW] `packages/resilience/src/__tests__/datadog-transport.integration.test.ts` (local HTTP server only)

#### [MODIFY] `packages/resilience/README.md`, `packages/telemetry/README.md` or package documentation, `docs/CHANGELOG.md`

- **Interfaces consumed:** Built resilience package, local HTTP server, preview Datadog/Vercel integrations.
- **Interfaces produced:** Evidence for direct-worker delivery, serverless drain delivery, redaction, correlation, and rollback readiness.

- [ ] **Step 1: Write local end-to-end test**

  Start a local Node HTTP server in the test, point the sink to it via injected site/base URL only in test configuration, emit Pino log records inside a correlation scope, await `flushResilienceLogs()`, and assert one batched request with redacted payload, `service`, `env`, `version`, `correlationId`, and trace fields. Add a 503-first-response scenario proving bounded retry without failing the application log call.

- [ ] **Step 2: Verify RED then GREEN**

  Run: `pnpm -C packages/resilience exec vitest run src/__tests__/datadog-transport.integration.test.ts --pool=threads --maxWorkers=1`

  Expected before implementation: FAIL; after implementation: PASS with no external network dependency.

- [ ] **Step 3: Run package and application verification**

  Run:

  ```text
  pnpm -C packages/resilience test
  pnpm -C packages/resilience run check-types
  pnpm -C packages/telemetry test
  pnpm -C packages/telemetry run check-types
  pnpm -C apps/workers exec vitest run __tests__/env.test.ts __tests__/tracer.test.ts --pool=threads --maxWorkers=1
  pnpm --filter client test -- __tests__/lib/env.validation.test.ts
  pnpm --filter admin run check-types
  pnpm run client:report-security-drift:strict
  ```

  Expected: Every command passes; no direct `process.env` access is introduced into client non-bootstrap code.

- [ ] **Step 4: Preview validation**

  - Enable the Datadog Vercel integration, Log Drain, and Trace Drain for a preview project. Confirm Vercel stdout Pino events arrive with expected `service`, `env`, `version`, `correlationId`, and trace correlation.
  - Deploy one non-production persistent worker with `DD_LOGS_ENABLED=true`. Produce a controlled resilience retry, circuit-open, cache stale/revalidation, and transport retry event. Verify direct intake batching, drop counter behavior, and graceful SIGTERM flush.
  - Verify that `DD_API_KEY`, sensitive input values, and raw job payloads are absent in stdout and Datadog.

- [ ] **Step 5: Production promotion and rollback rehearsal**

  - Create Datadog monitors for direct transport drop count, delivery failure count, queue saturation, and resilience circuit-open/retry volume; set thresholds with operations.
  - Enable direct logs for one production persistent worker service only. Observe for a full operating window before enabling other persistent services.
  - Rehearse rollback by setting `DD_LOGS_ENABLED=false`; confirm stdout and Vercel drains continue without source changes. Record the outcome in `docs/CHANGELOG.md`.

## Verification Plan

### Automated

- `pnpm -C packages/resilience test`
- `pnpm -C packages/resilience run check-types`
- `pnpm -C packages/telemetry test`
- `pnpm -C packages/telemetry run check-types`
- `pnpm -C apps/workers exec vitest run __tests__/env.test.ts __tests__/tracer.test.ts --pool=threads --maxWorkers=1`
- `pnpm --filter client test -- __tests__/lib/env.validation.test.ts`
- `pnpm --filter admin run check-types`
- `pnpm run client:report-security-drift:strict`
- `git diff --check`

### Manual / platform

- Datadog Vercel integration: Log Drain and Trace Drain enabled for preview before production.
- Datadog Log Explorer: query by `service`, `env`, `version`, `correlationId`, and trace identifiers.
- Persistent worker: force a graceful SIGTERM with queued logs and verify bounded drain completion.
- Security: inspect stdout and Datadog payloads for recursive redaction and absence of `DD_API_KEY`.

## Commit checkpoints

1. `test(resilience): lock down resilience correctness contracts`
2. `feat(resilience): add bounded Datadog Pino transport`
3. `feat(workers): flush resilience logs on graceful shutdown`
4. `chore(env): standardize Datadog configuration on DD_SITE`
5. `refactor(telemetry): retire legacy direct logger`
6. `docs(observability): record Option B rollout evidence`
