# ADR-010: Background Job Execution and Worker Daemon Boundary

## Status

Accepted

**Date:** 2026-08-17

## Context

The `apps/client` web application operates under Next.js serverless and Node.js request-response lifecycles. Background jobs—such as data maintenance, cleanup routines, email notification retries, and asynchronous event processing—require durable execution, exponential backoff, rate limiting, and graceful termination traps (`SIGTERM` / `SIGINT`).

Historically, attempting to instantiate inline background consumers (`new Worker(...)`) within Next.js request paths or server actions caused:

1. Zombie Redis connections and socket exhaustion during Next.js Fast Refresh and serverless spin-down.
2. Unreliable job execution if serverless containers terminate before job completion.
3. Violation of layer boundaries (ADR-002) where web routes become tightly coupled to long-running daemon lifecycles.

## Decision

1. **Producer-Only Invariant for `apps/client`**:
   - `apps/client` must exclusively act as a **Queue Producer**.
   - All job scheduling and queue enqueueing must utilize typed helper functions and queue instances exported from `@build/queue-server` (e.g., `addMaintenanceJob`, `addExportJob`, `addNotificationRetryJob`).
   - `new Worker(...)` instantiations are strictly **forbidden** within `apps/client` (including routes, server actions, services, and middleware).

2. **Dedicated Daemon Invariant (`apps/workers`)**:
   - All BullMQ queue consumers and NATS JetStream worker loops run exclusively inside the standalone `apps/workers` daemon.
   - The daemon manages process lifecycles, graceful shutdown timeouts (30s drain), centralized Pino structured logging with `CorrelationIdManager` propagation, and HTTP `/healthz` multi-probe readiness.

3. **Shared Contracts in `@build/queue-server`**:
   - Queue names, job payload schemas, and enqueue helper functions must reside in `@build/queue-server` to decouple web producer applications from daemon consumer implementations.

## Consequences

- **Reliability**: Web traffic scale and serverless auto-scaling do not impact background job processing capacity.
- **Resource Hygiene**: Next.js serverless functions remain lightweight without persistent Redis polling TCP sockets.
- **Observability**: Background job metrics and errors are tracked in dedicated worker containers rather than polluting web request logs.
- **Deployment**: `apps/workers` can be deployed, scaled, and restarted independently of the client web application.
