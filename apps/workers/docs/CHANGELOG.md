# apps/workers Changelog

All notable changes to the `workers` application will be documented in this file.

## [Unreleased]

### Added — Initial Standalone Worker Application & Daemon Bootstrap

- **Standalone Worker Daemon (`apps/workers/package.json`, `apps/workers/src/index.ts`)**:
  - Initialized dedicated Node.js 24 ESM background worker daemon to isolate long-running BullMQ consumers out of Next.js serverless execution contexts.
  - Implemented centralized worker lifecycle management orchestrating `maintenance-jobs` (GDPR cleanup, data retention, anonymization batching, asset cleanup, newsletter sweep, license expiry, archival) and `notification-retries` queues.
  - Structured all worker job executions within `CorrelationIdManager.run()` context for end-to-end distributed tracing and Pino log correlation with automatic PII redaction.
  - Integrated graceful shutdown signal handling for `SIGTERM` and `SIGINT` with a 30-second job draining window and clean connection teardown (BullMQ, Redis, NATS) while keeping the `/healthz` probe alive reporting 503 until full drain.
  - Registered global uncaught exception and unhandled rejection handlers terminating cleanly for orchestrator restart.
- **Fail-Closed Environment Validation (`apps/workers/src/env.ts`)**:
  - Implemented synchronous Zod-backed environment validation executing immediately on process boot.
  - Enforces required `DATABASE_URL` (with `postgresql://`/`postgres://` scheme validation), `REDIS_URL` (with `redis://`/`rediss://` scheme validation), pool constraints (`DB_POOL_MAX`), and production fail-closed requirement for `NATS_URL`.
- **Multi-Component Orchestrator Health Probe (`apps/workers/src/health.ts`)**:
  - Implemented lightweight HTTP server listening on `PORT 8080` exposing `/healthz` and `/health`.
  - Probes live Redis responsiveness via `redis.ping()`, verifies all BullMQ `Worker` instances are actively running (`activeWorkers.every(w => w.isRunning())`), and verifies NATS JetStream consumer connectivity before returning 200 OK (or 503 Degraded/Shutting Down).
- **Multi-Stage OCI Containerization & Hardening (`apps/workers/Dockerfile`, `.dockerignore`)**:
  - Implemented multi-stage Docker build utilizing Turborepo 2.x positional prune syntax (`turbo prune workers --docker`).
  - Added `dumb-init` as PID 1 entrypoint for proper UNIX signal forwarding.
  - Added `pnpm prune --prod` builder step and root `.dockerignore` for minimal runner image footprint and reduced attack surface.
  - Target pinned `linux-musl-openssl-3.0.x` in Prisma schema `binaryTargets` for compatibility with Alpine Linux musl libc.
  - Configured non-root execution (`USER node`) on `node:24-alpine` base image.
  - Integrated Docker `HEALTHCHECK` probing `http://localhost:8080/healthz`.
- **NATS JetStream Durable Consumer Integration (`apps/workers/src/index.ts`)**:
  - Bound retry subscriber to static durable consumer name `notification-retry-worker-group` on NATS JetStream stream, preventing orphan consumer accumulation across container redeployments.
- **Database-Backed Job Processors (`apps/workers/src/processors/`)**:
  - Implemented `processMaintenanceJob` (`maintenance.processor.ts`) with `@build/db` Prisma operations for:
    - `cleanup-expired-exports`: Marks expired data exports as `EXPIRED`.
    - `data-retention-enforcement`: Flags inactive users exceeding data retention policy.
    - `anonymization-batch`: Anonymizes deactivated user records past grace period.
    - `asset-cleanup`: Soft-deletes expired temporary uploads and assets.
    - `onboarding-upload-cleanup`: Transitions expired unconsumed staged uploads to `EXPIRED`.
    - `newsletter-sweep`: Purges unconfirmed newsletter signups older than 48 hours.
    - `license-expiry`: Transitions expired verified licenses to `EXPIRED`.
    - `gdpr-erasure`: Processes scheduled user deactivations.
    - `archive-settled-records`: Archives settled transactions older than 180 days to archive tables in atomic transactions.
  - Implemented `processNotificationRetryJob` (`notification.processor.ts`) delivering in-app notifications and updating failed notification records.
- **Unit Test Suite & Tooling (`apps/workers/vitest.config.ts`, `apps/workers/eslint.config.mjs`, `apps/workers/__tests__/`)**:
  - Configured Vitest test runner with Node environment and v8 coverage reporters.
  - Implemented ESLint configuration extending `@build/eslint-config/base` with strict `no-restricted-syntax` preventing direct `process.env` access outside `src/env.ts`.
  - Added unit test suites verifying fail-closed environment validation (`__tests__/env.test.ts`), multi-component HTTP `/healthz` probe states (`__tests__/health.test.ts`), and database-backed job processors (`__tests__/processors.test.ts`).
