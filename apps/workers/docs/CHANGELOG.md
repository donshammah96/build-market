# apps/workers Changelog

All notable changes to the `workers` application will be documented in this file.

## [Unreleased]

### Added — Initial Standalone Worker Application & Daemon Bootstrap

- **Standalone Worker Daemon (`apps/workers/package.json`, `apps/workers/src/index.ts`)**:
  - Initialized dedicated Node.js 24 ESM background worker daemon to isolate long-running BullMQ consumers out of Next.js serverless execution contexts.
  - Implemented centralized worker lifecycle management orchestrating `maintenance-jobs` (GDPR cleanup, data retention, anonymization batching, asset cleanup, newsletter sweep) and `notification-retries` queues.
  - Structured all worker job executions within `CorrelationIdManager.run()` context for end-to-end distributed tracing and Pino log correlation with automatic PII redaction.
  - Integrated graceful shutdown signal handling for `SIGTERM` and `SIGINT` with a 30-second job draining window and clean connection teardown (BullMQ, Redis, NATS).
- **Fail-Closed Environment Validation (`apps/workers/src/env.ts`)**:
  - Implemented synchronous Zod-backed environment validation executing immediately on process boot.
  - Enforces required `DATABASE_URL`, `REDIS_URL`, `NATS_URL`, and pool constraints (`DB_POOL_MAX`) before initializing any network sockets, terminating with exit code 1 if invalid.
- **Lightweight Orchestrator Health Probe (`apps/workers/src/health.ts`)**:
  - Implemented lightweight HTTP server listening on `PORT 8080` exposing `/healthz` and `/health`.
  - Probes live Redis responsiveness via `redis.ping()` and reports 200 OK or 503 Service Unavailable during startup/teardown.
- **Multi-Stage OCI Containerization (`apps/workers/Dockerfile`)**:
  - Implemented multi-stage Docker build utilizing Turborepo 2.x positional prune syntax (`turbo prune workers --docker`).
  - Configured non-root execution (`USER node`) on `node:24-alpine` base image.
  - Integrated Docker `HEALTHCHECK` probing `http://localhost:8080/healthz`.
  - Zero build-time secrets; all credentials injected via runtime environment variables.
- **NATS JetStream Durable Consumer Integration (`apps/workers/src/index.ts`)**:
  - Bound retry subscriber to static durable consumer name `notification-retry-worker-group` on NATS JetStream stream, preventing orphan consumer accumulation across container redeployments.
- **Modular Job Processors (`apps/workers/src/processors/`)**:
  - Extracted `processMaintenanceJob` (`maintenance.processor.ts`) and `processNotificationRetryJob` (`notification.processor.ts`) into modular processors executing inside `CorrelationIdManager` context.
- **Unit Test Suite & Tooling (`apps/workers/vitest.config.ts`, `apps/workers/eslint.config.mjs`, `apps/workers/__tests__/`)**:
  - Configured Vitest test runner with Node environment and v8 coverage reporters.
  - Implemented ESLint configuration extending `@build/eslint-config/base` with strict `no-restricted-syntax` preventing direct `process.env` access outside `src/env.ts`.
  - Added unit test suites verifying fail-closed environment validation (`__tests__/env.test.ts`), HTTP `/healthz` liveness/readiness probe states (`__tests__/health.test.ts`), and background job processing (`__tests__/processors.test.ts`).
