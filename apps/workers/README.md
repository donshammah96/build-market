# app/workers

Standalone BullMQ + NATS JetStream background worker daemon for Build Market. Extracted out of the Next.js apps because Vercel's serverless runtime terminates the event loop on response completion — a hard incompatibility with long-running queue consumers.

> **Status: implemented daemon, not launch-certified.** The daemon has concrete maintenance and in-app notification processors plus export, incident, compliance notification, newsletter, upload, verification, and M-Pesa processors. Processing remains at-least-once and the documented effects are intentionally narrower than complete privacy erasure, anonymization, object-store deletion, or provider confirmation where the processor does not perform those actions. See the [queue recovery runbook](docs/QUEUE_RECOVERY_RUNBOOK.md) and [current status](docs/STATUS.md).

## Architecture

```text
apps/workers/
  src/
    index.ts                          # daemon entrypoint: boot, wire workers, graceful shutdown
    env.ts                            # fail-closed Zod env validation
    health.ts                         # /healthz HTTP probe
    processors/
      maintenance.processor.ts        # maintenance-jobs queue handler
      notification.processor.ts       # notification-retries queue handler
  Dockerfile                          # multi-stage turbo-pruned build
  package.json
```

This app is a **pure consumer**. Queue definitions, job payload schemas, and producer factories (`addMaintenanceJob`, `addNotificationRetryJob`, etc.) live in `@build/queue-server` and are shared with `apps/client` / `apps/admin`, which remain thin enqueue-only adapters. `apps/workers` never imports from `apps/client` or `apps/admin`.

### Queues handled

| Queue                  | Processor                     | Job types                                                                                                                                                                                                     |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maintenance-jobs`     | `processMaintenanceJob`       | `cleanup-expired-exports`, `data-retention-enforcement`, `anonymization-batch`, `asset-cleanup`, `onboarding-upload-cleanup`, `newsletter-sweep`, `license-expiry`, `gdpr-erasure`, `archive-settled-records` |
| `notification-retries` | `processNotificationRetryJob` | notification delivery retry                                                                                                                                                                                   |

Additional BullMQ consumers handle `gdpr-data-export`, `security-incidents`, `compliance-notifications`, `newsletter-confirmation-email`, `newsletter-esp-sync`, `uploads-image-processing`, `license-verification`, `mpesa-payments`, and `mpesa-reconciliation`. The daemon also owns the NATS durable consumers `notification-retry-worker-group` and `license-auto-verify-group`.

Operational ownership, safe recovery, and business-effect verification for each queue/consumer are defined in the [queue recovery runbook](docs/QUEUE_RECOVERY_RUNBOOK.md). Do not use a generic restart or a completed job state as proof of a successful privacy, regulatory, or financial outcome.

## Prerequisites

- Node.js 24.x
- pnpm (version pinned in root `package.json`'s `packageManager` field — must match the Dockerfile's `corepack prepare` version exactly)
- Docker + Docker Compose, for local infra

## Local Development

### 1. Start local infrastructure

From the monorepo root:

```bash
pnpm docker:up      # starts postgres, redis, nats via docker-compose.yml
```

This provisions:

- **PostgreSQL 16** on `5432`
- **Redis 7** on `6379`, with `--maxmemory-policy noeviction` (required — BullMQ must never silently lose queue data to eviction; see [Redis eviction policy](#redis-eviction-policy) below)
- **NATS** on `4222` (client) / `8222` (monitoring), JetStream enabled (`-js`)

Stop everything with `pnpm docker:down`.

### 2. Configure environment

Copy the relevant values from root `.env.example` into `apps/workers/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildmarket?schema=public
REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
NODE_ENV=development
```

See [Environment Variables](#environment-variables) for the full reference.

### 3. Run the daemon

```bash
pnpm --filter workers dev      # tsx watch, restarts on file change
```

The daemon validates its environment on boot and exits immediately (code 1) if anything required is missing or malformed — check the console for a formatted list of validation errors.

## Environment Variables

| Variable                  | Required              | Default                 | Notes                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                | No                    | `development`           | `development` \| `test` \| `production`                                                                                                                                                                                                                            |
| `DATABASE_URL`            | **Yes**               | —                       | Postgres connection string                                                                                                                                                                                                                                         |
| `DIRECT_URL`              | No                    | —                       | Prisma direct connection (migrations, connection-pooler bypass)                                                                                                                                                                                                    |
| `REDIS_URL`               | **Yes**               | —                       | Must be a TCP `redis://`/`rediss://` endpoint — BullMQ requires raw TCP via `ioredis`, not Upstash's REST client                                                                                                                                                   |
| `NATS_URL`                | **Yes in production** | `nats://localhost:4222` | ⚠️ The localhost default is a dev convenience only. Do not rely on it in staging/production — an unset var will silently point at a nonexistent local NATS inside the container and fail without crashing the process. Set explicitly everywhere except local dev. |
| `DB_POOL_MAX`             | No                    | `5`                     | Bounded 1–20. Multiply by replica count and add to what `apps/client`/`apps/admin` already hold against Postgres — check against your provider's `max_connections` or pooler limit.                                                                                |
| `HEALTH_PORT`             | No                    | `8080`                  | Port for the `/healthz` probe                                                                                                                                                                                                                                      |
| `DISABLE_BACKGROUND_JOBS` | No                    | `false`                 | Maintenance-mode kill switch — boots the daemon and health server without starting any BullMQ workers or the NATS consumer                                                                                                                                         |
| `LOG_LEVEL`               | No                    | `info`                  | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`                                                                                                                                                                                                       |

Validation is fail-closed: any missing or malformed required variable halts boot before any Redis/NATS socket is opened.

### Redis eviction policy

Local Redis is configured with `noeviction` directly in `docker-compose.yml`. This does **not** carry over to the managed Upstash instance used in staging/production — Upstash doesn't expose `maxmemory-policy` via `CONFIG SET`. Instead, confirm the **Eviction** toggle is disabled in the Upstash console (Database → Configuration → Eviction). It's disabled by default; only an issue if someone has explicitly enabled it, in which case Upstash uses a random-eviction policy rather than LRU, which can silently drop BullMQ queue keys under memory pressure.

## Scripts

| Command                                                | Purpose                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| `pnpm dev`                                             | Run with hot reload (`tsx watch`)              |
| `pnpm build`                                           | Compile TypeScript to `dist/`                  |
| `pnpm start`                                           | Run the compiled daemon (`node dist/index.js`) |
| `pnpm check-types`                                     | `tsc --noEmit`                                 |
| `pnpm lint` / `pnpm lint:fix`                          | ESLint                                         |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest                                         |

## Health Check

`GET /`, `/healthz`, `/health`, or `/ping` on `HEALTH_PORT`:

| Status | Meaning                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | The process is live and the aggregate readiness check reports Redis, PostgreSQL where a PostgreSQL queue backend is active, all started BullMQ workers, and required NATS consumers as healthy. |
| `503`  | The daemon is shutting down, a required dependency is unavailable, or a health probe threw. The JSON body identifies the known dependency states when available.                                |
| `404`  | Any other path.                                                                                                                                                                                 |

**Liveness is not readiness.** A reachable HTTP process is a liveness signal. A `200` is an aggregate dependency/readiness signal, not proof that a particular queue processed a recent job successfully. A queue-specific incident requires the procedure and post-recovery evidence in the [queue recovery runbook](docs/QUEUE_RECOVERY_RUNBOOK.md).

**Disabled mode:** with `DISABLE_BACKGROUND_JOBS=true`, worker and NATS checks intentionally report ready because no consumers are expected to be running. This mode is a deliberate maintenance/containment state and must not be used as evidence that background processing is available.

## Graceful Shutdown

On `SIGTERM` / `SIGINT`:

1. Mark `isShuttingDown = true` (health endpoint starts returning 503)
2. Disconnect the NATS JetStream consumer
3. Close all BullMQ workers, draining active jobs
4. Disconnect Redis
5. Exit `0`

A 30-second watchdog forces `exit(1)` if the sequence hasn't completed in time.

## Docker

### Build

```bash
# from repo root — the build context must be the monorepo root,
# since the Dockerfile runs `turbo prune workers --docker` against the full tree
docker build -f apps/workers/Dockerfile -t build-market-workers .

# For Apple Silicon / ARM64 hosts targeting AMD64 staging/production:
docker buildx build --platform linux/amd64 -f apps/workers/Dockerfile -t build-market-workers .
```

### Run with Local Docker Compose Stack

To run the complete local environment end-to-end (PostgreSQL, Redis, NATS, and the worker container):

```bash
docker compose --profile workers up --build
```

### Run

```bash
docker run --env-file apps/workers/.env -p 8080:8080 build-market-workers
```

### Verify graceful shutdown

```bash
docker run -d --name workers-test --env-file apps/workers/.env build-market-workers
docker stop workers-test   # sends SIGTERM; observe drain + clean exit in logs
```

## Deployment

The worker daemon is **not deployed to Vercel** — see [Vercel vs. Render](#vercel-vs-render) below. It's deployed as a container to Render. See the deployment runbook (or ask in #platform) for current staging/production service URLs and env group names.

## Known Limitations

- **Maintenance effects are deliberately narrow.** The processor makes the database changes documented in the [queue recovery runbook](docs/QUEUE_RECOVERY_RUNBOOK.md). Several job names are broader than their implementation: marking an export or asset record does not delete its object-store data; scheduling/deactivating a user is not complete erasure; profile-field anonymization does not prove cross-system deletion.
- **At-least-once delivery remains a production risk.** BullMQ can invoke a job more than once. Operators must verify idempotency and downstream effects before retrying privacy, financial, regulatory, or provider-backed jobs; M-Pesa replays require finance approval and reconciliation evidence.
- **Health is aggregate, not an outcome audit.** The health endpoint checks Redis, PostgreSQL where applicable, BullMQ worker run-state, and NATS connectivity. It does not inspect queue depth, dead-letter state, processor latency, storage state, regulator state, or a completed business outcome.

## Vercel vs. Render

**Not on Vercel.** BullMQ workers are long-running processes; Vercel's serverless functions terminate the event loop on response completion, which drops in-flight jobs and stalls locks — this is the entire reason this app exists as a separate deployable. Vercel remains correct for `apps/client` / `apps/admin` / `apps/verification-ops`.

**On Render**, as a container:

- **Dockerfile Path:** `apps/workers/Dockerfile`
- **Docker Build Context Directory:** repo root (`.`) — required, since the pruner stage needs the full monorepo tree for `turbo prune workers --docker`
- **Service type:** Private Service (not Background Worker) — recommended specifically because a Private Service gets Render's own HTTP-based health-check-and-restart behavior and an internal `*.onrender.com` URL, which is what actually makes the `/healthz` endpoint useful. Background Worker services have no ports and no HTTP health checks at all — Render only restarts them on process crash/exit code, and the health server would be unreachable dead code in that configuration.
- **Port binding:** Render injects its own `PORT` env var for Private/Web services — bind the health server to `process.env.PORT ?? process.env.HEALTH_PORT ?? 8080` rather than `HEALTH_PORT` alone, and set the Health Check Path to `/healthz` in the service settings.
- **Build Filters:** include `apps/workers/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json` — scopes autodeploys to changes that actually affect this service, while still redeploying when a shared package it depends on changes.
- **Env vars:** set via a Render Environment Group shared across staging/production where values are common, with per-service overrides for anything environment-specific (`DATABASE_URL`, `REDIS_URL`, `NATS_URL` will differ staging vs. prod).
