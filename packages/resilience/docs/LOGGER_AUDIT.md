# Build Market — Logging System Audit & Production Hardening

**Scope:** `logger.ts`, `config.ts`, `types.ts` (the app/system logger — not the
`AuditLog`/`AdminAuditLog` Prisma models, which are business-event records and
a separate concern from operational logging).

---

## 1. Summary

The existing code has good bones: `AsyncLocalStorage` for correlation IDs
(the right primitive), a real `Logger` interface instead of `console.log`
sprinkled everywhere, and a `LogContext` type that already blocks `userId`
from being logged at the type level (nice — that's a compile-time guardrail
most teams don't bother with).

The core issue is architectural: **this reimplements a structured logger by
hand on top of `console.log`**, while a separate part of the stack already
uses Pino with `AsyncLocalStorage` correlation IDs and OTel integration. That
means there are, right now, two different logging implementations doing the
same job. That's the thing worth fixing before anything else — every hour
spent hardening the hand-rolled version is an hour spent maintaining a
second logging system.

Everything below assumes the fix is to **consolidate onto Pino** and make
this module a thin, compatible wrapper around it, rather than harden the
custom implementation further.

---

## 2. Findings

| #   | Finding                                                                                                                                                                                             | Severity                                         | Where       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| 1   | Hand-rolled logger duplicates existing Pino infrastructure elsewhere in the codebase                                                                                                                | **High**                                         | `logger.ts` |
| 2   | No redaction layer — `LogContext`'s `[key: string]: unknown` index signature lets any field through, including secrets/tokens/PII that aren't `userId`                                              | **High**                                         | `logger.ts` |
| 3   | `console.log(JSON.stringify(entry))` throws uncaught on circular references (e.g. logging a raw Prisma/Axios object) — one bad log call can crash the process                                       | **High**                                         | `logger.ts` |
| 4   | Env parsing swallows malformed values silently (`RETRY_MAX_ATTEMPTS="five"` → falls back to default, no warning) — a typo in prod config can run undetected indefinitely                            | **Medium**                                       | `config.ts` |
| 5   | `cache.redisEnabled`/`redisNamespace` and `cache.redis.{enabled,namespace}` are parsed from the _same_ env vars twice, independently — a future edit to one and not the other silently desyncs them | **Medium**                                       | `config.ts` |
| 6   | No OpenTelemetry trace/span correlation — a log line and the trace it happened inside can't be joined without matching timestamps by hand                                                           | **Medium**                                       | `logger.ts` |
| 7   | `CorrelationIdManager.clear()` used an empty-string sentinel because the store was typed `AsyncLocalStorage<string>` — a workaround, not a fix                                                      | **Low**                                          | `logger.ts` |
| 8   | `Error.cause` chains (Node ≥16.9) were never serialized — wrapped errors lost their root cause in logs                                                                                              | **Low**                                          | `logger.ts` |
| 9   | No log sampling — every DEBUG/INFO line in a hot path (e.g. a busy BullMQ queue) is written 1:1, with no way to sample down before it hits your bill                                                | **Low** (flag now, fix when volume justifies it) | `logger.ts` |

---

## 3. What changed

- **`logger.ts`** — rewritten as a thin adapter over **Pino**. Same public
  API (`Logger`, `StructuredLogger`, `createLogger`, `getGlobalLogger`,
  `CorrelationIdManager`), so nothing calling this module needs to change.
  Internals now give you:
  - Field-level **redaction** (`context.password`, `context.token`,
    `context.kraPin`, `context.mpesaRecords`, etc.) — extend the
    `REDACT_PATHS` list as new sensitive fields show up, don't rely on call
    sites to self-censor.
  - Safe handling of circular references (Pino uses `fast-safe-stringify`
    internally — a bad object no longer takes down the process).
  - `Error.cause` chain serialization via Pino's `err` serializer.
  - Optional OpenTelemetry trace/span correlation, injected via a `mixin()`
    — every log line gets `traceId`/`spanId` for free when it's emitted
    inside an active span, with zero cost when `@opentelemetry/api` isn't
    installed or there's no active span.
  - `pino-pretty` transport in dev, raw NDJSON to stdout in prod (no
    transform overhead where it matters).
- **`config.ts`** — env parsing moved to **zod**. Malformed env vars now
  throw a clear error at boot (`Invalid environment configuration for
resilience module: ... RETRY_MAX_ATTEMPTS: Expected number, received nan`)
  instead of silently defaulting. `redis` config is now parsed once and the
  flat mirror fields are derived from it, not re-parsed.
- **`types.ts`** — documented that `traceId`/`spanId` are injected
  automatically and shouldn't be set manually from call sites.

### Dependencies to add

```bash
npm install pino zod
npm install -D pino-pretty
npm install @opentelemetry/api   # optional — already likely present given your OTel setup
```

### Not changed (by design)

- The `LogContext` compile-time block on `userId` — that's already the
  right pattern, kept as-is.
- The `Logger` interface signature — kept identical on purpose so this is a
  drop-in swap, not a breaking migration across the monorepo.

---

## 4. Accessing logs in development vs. production

**Development:** logs print to your terminal via `pino-pretty` —
colorized, human-readable, one line per log plus an indented context block.
No setup needed; this is automatic based on `NODE_ENV`.

**Production**, given your stack (Vercel for the web app, AWS/EKS for NATS
workers, OTel already wired in), you have two log-producing surfaces that
need to land in one place:

1. **Vercel functions** — every `console.log`/stdout write from a Vercel
   function is captured automatically and visible in the **Runtime Logs**
   tab of your project dashboard in real time. Since this logger emits
   NDJSON in prod, Vercel's log viewer will show structured fields, not just
   a text blob. For anything beyond ad-hoc debugging (retention, alerting,
   querying across deploys), set up a **Log Drain** to ship these
   off-platform — Vercel supports drains to most log backends.

2. **AWS (EKS workers, NATS consumers)** — stdout from containers goes to
   **CloudWatch Logs** by default on EKS (via the Fluent Bit/CloudWatch
   agent most cluster setups already run). You can query it directly in
   CloudWatch Logs Insights, e.g.:

   ```text
   fields @timestamp, level, msg, correlationId, traceId
   | filter level = "error"
   | sort @timestamp desc
   ```

3. **Unifying both** — since you already run OpenTelemetry, the highest-
   leverage move is adding a **logs pipeline to your OTel Collector**
   (`filelog`/`stdout` receiver on the AWS side, an OTLP log exporter from
   Vercel isn't natively supported so that side stays on Log Drains) feeding
   a single backend that also holds your traces — **Grafana Cloud (Loki +
   Tempo)**, **Axiom**, or **Better Stack** are the common choices at your
   stage; all three have generous free/cheap tiers and native log↔trace
   correlation once `traceId` is a field on every log line (which it now
   is, via the mixin above). That gets you: search logs by `correlationId`
   or `traceId`, jump from a trace span straight to its logs, and one
   retention/alerting policy instead of two.

**Alerting:** once logs are centralized, add an alert rule on `level: error`
or `level: fatal` counts (Grafana/Axiom/Better Stack all support this) —
right now an ERROR log is only as loud as whoever happens to be watching
the terminal.

---

## 5. Suggested next steps (not implemented here — flagging for when volume justifies the effort)

1. **Log sampling** for high-volume DEBUG/INFO paths (Pino supports this
   natively via `pino-sampling` or a custom transport) once you have real
   traffic and a bill to manage.
2. **Correlation ID propagation across process boundaries** — this fixes
   in-process correlation; carrying the same ID into a BullMQ job payload or
   a NATS message header (and calling `CorrelationIdManager.set()` on the
   consumer side) is a separate, deliberate wiring step at each queue/topic
   boundary.
3. Wire `process.on('uncaughtException')` / `unhandledRejection` to
   `logger.fatal()` so process-crashing errors are guaranteed to be logged
   before exit, not just whatever happened to be in flight.
