# apps/workers Changelog

All notable changes to the `workers` application will be documented in this file.

## [Unreleased]

### Added — Cross-Network NATS JetStream HA Clustering & Render Worker Auth

- **AKS Multi-Node Cluster Configuration (`packages/nats/nats-values.yaml`)**:
  - Configured 3-node HA NATS cluster (`replicas: 3`, `name: buildmarket-nats`) with isolated intra-cluster routing on port `6222` and persistent storage (10Gi `managed-csi` PVC) for JetStream durability.
  - Configured Azure LoadBalancer service exposing client port `4222` with TCP idle timeout annotations and token-based client authentication.
  - Updated deployment runbook (`packages/nats/docs/deploy-monitoring-runbook.md`) covering cluster deployment, TLS/token secrets, and Render worker connectivity.
- **Render Private Network & Standalone NATS (`packages/nats/nats-server.conf`, `packages/nats/Dockerfile`)**:
  - Configured standalone NATS JetStream container with client TCP port `4222` for high-throughput, low-latency inter-service communication across Render's internal private network.
  - Configured HTTP monitoring port `8222` (`/healthz`, `/varz`) for Render Web Service health checks.
  - Enabled token authentication with secret key authorization.
- **Worker Environment & Consumer Auth Wiring (`apps/workers/src/env.ts`, `apps/workers/src/index.ts`, `apps/workers/.env.example`)**:
  - Added `NATS_TOKEN` validation to `workerEnvSchema` and updated `validateWorkerEnv()` test suite to support `nats://`, `tls://`, `ws://`, and `wss://` URI schemes.
  - Wired `token: env.NATS_TOKEN` into `createConsumer()` for both `notification-retry-worker-group` and `license-auto-verify-group` JetStream consumer groups.
- **Pinned Build Container Tooling (`apps/workers/Dockerfile`)**:
  - Pinned global `prisma@7.10.0` CLI in the builder stage to match the lockfile `@prisma/client@7.10.0` runtime version, preventing client generation drift warnings.

### Added — Image Upload Processing Pipeline, Fail-Closed Virus Scanning & Shared `@build/media`

- **Shared Media Package (`packages/media`, exported as `@build/media`)**:
  - Extracted shared media package providing unified `processImage()`, `createSafeSharp()`, `generateBlurHash()`, `isValidImage()`, `getImageDimensions()`, and `createAvatar()`.
  - Implemented decompression-bomb protection (`limitInputPixels: 268_402_689`, `failOn: "error"`), format allowlisting (`jpeg`, `png`, `webp`, `avif`, `heif`, `heic`, `gif`), and PNG palette optimization.
  - Implemented vendor-agnostic `VirusScanner` interface with `MockVirusScanner`, `CloudmersiveVirusScanner`, and startup registration registry.
- **Fail-Closed Malware & Virus Scanning in Worker (`apps/workers/src/processors/upload.processor.ts`)**:
  - Wired fail-closed virus scanning into `processImageUploadJob` prior to any S3/R2 storage write or database persistence.
  - Configured `CLOUDMERSIVE_API_KEY`, `CLOUDMERSIVE_BASE_URL`, and `ALLOW_MOCK_VIRUS_SCANNER` schema validation in `src/env.ts`.
  - EICAR and infected buffers are rejected with status `FAILED` and logged with correlation IDs without persisting untrusted binaries.
- **Production Image Optimization & Variant Generation (`apps/workers/src/processors/upload.processor.ts`)**:
  - Wired `@build/media` `processImage()` to optimize primary images and generate thumbnails (`uploads/{userId}/{uploadId}/thumb-{name}`).
  - Persisted `thumbnailUrl`, `blurHash`, `width`, `height`, and optimized size to `Asset` records with deterministic upsert for retry safety.
  - Integrated `WORKER_IMAGE_PROCESSING_ENABLED` emergency rollback switch.
- **Offline Legacy Asset Backfill Script (`apps/workers/src/scripts/backfill-image-assets.ts`)**:
  - Added standalone idempotent backfill utility scanning unoptimized `Asset` rows (`thumbnailUrl IS NULL`), processing through `@build/media`, uploading thumbnail variants, and updating database records.
  - Added `"backfill:images"` script to `apps/workers/package.json`.
- **Client App Consolidation (`apps/client`)**:
  - Consolidated `apps/client` onto `@build/media` and removed duplicate local `image-processing.ts`.

### Added — Datadog APM Tracer Integration (`dd-trace`)

- **Datadog APM Tracer Integration (`pnpm-workspace.yaml`, `apps/workers/package.json`, `apps/workers/src/tracer.ts`)**:
  - Added `dd-trace` (^5.50.0) dependency to root `pnpm-workspace.yaml` workspace catalog and wired `"dd-trace": "catalog:"` to `apps/workers/package.json`.
  - Configured `allowBuilds` for `@datadog/native-appsec`, `@datadog/native-iast-taint-tracking`, and `@datadog/native-metrics` in `pnpm-workspace.yaml`.
  - Implemented `initTracer()` singleton in [tracer.ts](file:///c:/Users/User/build-market/apps/workers/src/tracer.ts) with automatic log injection, runtime metrics, service/env/version/agent-host parameter propagation, and test/disabled bypass logic.
  - Wired `initTracer(env)` into early startup in [index.ts](file:///c:/Users/User/build-market/apps/workers/src/index.ts) alongside OpenTelemetry.
  - Added `DD_SERVICE`, `DD_VERSION`, `DD_AGENT_HOST`, and `DD_TRACE_ENABLED` schema validation in [env.ts](file:///c:/Users/User/build-market/apps/workers/src/env.ts) and documented them in [.env.example](file:///c:/Users/User/build-market/apps/workers/.env.example).
  - Added comprehensive test coverage in [tracer.test.ts](file:///c:/Users/User/build-market/apps/workers/__tests__/tracer.test.ts).

### Fixed — Container Prisma Client Generation & Orchestrator Deployments

- **Isolated Production Prisma Client Generation (`apps/workers/Dockerfile`)**:
  - Fixed runtime `SyntaxError: The requested module '@prisma/client' does not provide an export named 'PrismaClient'` during container execution on cloud orchestrators (Render/Docker).
  - Executed `prisma generate` directly inside `/prod/workers` with the schema staged locally (`./prisma/schema.prisma`), forcing Prisma to resolve the target `node_modules/@prisma/client` within pnpm's deployed production virtual store rather than traversing to `/app/packages/db`, ensuring the production image contains the compiled `linux-musl-openssl-3.0.x` Alpine engine and valid ESM exports.

### Added — OpenTelemetry Datadog APM Pipeline & Processor Extensions

- **OpenTelemetry & Datadog OTLP Instrumentation (`apps/workers/src/otel.ts`, `apps/workers/src/env.ts`, `apps/workers/src/index.ts`)**:
  - Implemented OpenTelemetry NodeSDK bootstrapping connecting traces and metrics directly to Datadog's OTLP intake endpoint (`https://otlp-intake.us5.datadoghq.com/v1/traces`).
  - Added support for `OTEL_EXPORTER_OTLP_HEADERS`, `DD_API_KEY`, `DD_SITE_HOST` (defaulting to `us5.datadoghq.com`), and `deployment.environment` tagging (`production` vs `staging`).
  - Integrated eager `initOtel(env)` startup before BullMQ workers and NATS consumer socket connections, and wired `shutdownOtel()` into the graceful shutdown sequence.
- **Expanded BullMQ & NATS JetStream Processors (`apps/workers/src/index.ts`)**:
  - Registered `newsletter-confirmation-email` worker (`processConfirmationEmailJob`) sending double opt-in emails via `@build/mail-server`/Resend.
  - Registered `newsletter-esp-sync` worker (`processEspSyncJob`) synchronizing subscriber state with external ESPs.
  - Registered `uploads-image-processing` worker (`processImageUploadJob`) handling image transformation and S3/R2 storage uploads.
  - Registered `license-verification` worker (`processLicenseVerificationJob`) and dedicated durable NATS JetStream consumer `license-auto-verify-group` for `license.auto_verify_requested` events.

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
  - Implemented `processDataExportJob` (`export.processor.ts`) processing `gdpr-data-export` jobs: streaming user profile/projects/orders data into ZIP archives (`archiver`), uploading to S3/R2 storage with presigned URLs, updating database records, and sending completion emails.
  - Implemented `processIncidentJob` (`incident.processor.ts`) processing `security-incidents` jobs: executing emergency protocols, notifying ODPC regulatory contacts, fan-out user notifications, and DPO escalation alerts.
  - Implemented `processComplianceNotificationJob` (`compliance-notification.processor.ts`) processing `compliance-notifications` jobs: executing chunked batch user delivery via email/SMS with rate limiting and database audit logging.
  - Implemented `processConfirmationEmailJob` & `processEspSyncJob` (`newsletter.processor.ts`) processing `newsletter-confirmation-email` (double opt-in sending via `@build/mail-server`/Resend) and `newsletter-esp-sync` (ESP audience synchronization).
  - Implemented `processImageUploadJob` (`upload.processor.ts`) processing `uploads-image-processing` (image resizing, S3/R2 object storage upload, and asset record creation).
  - Implemented `processLicenseVerificationJob` (`license-verification.processor.ts`) processing `license-verification` jobs and NATS JetStream `license.auto_verify_requested` events with authority auto-verification branching and manual review triage.
- **Architectural Decision Records Alignment (`apps/client/docs/adr/ADR-010-...`, `apps/admin/docs/adr/ADR-ADMIN-016-...`)**:
  - Authored client ADR-010 and admin ADR-ADMIN-016 formalizing the queue producer vs daemon consumer runtime boundary, forbidding inline `new Worker(...)` instantiations in Next.js web runtimes.
- **Unit Test Suite & Tooling (`apps/workers/vitest.config.ts`, `apps/workers/eslint.config.mjs`, `apps/workers/__tests__/`)**:
  - Configured Vitest test runner with Node environment and v8 coverage reporters.
  - Implemented ESLint configuration extending `@build/eslint-config/base` with strict `no-restricted-syntax` preventing direct `process.env` access outside `src/env.ts`.
  - Added unit test suites verifying fail-closed environment validation (`__tests__/env.test.ts`), multi-component HTTP `/healthz` probe states (`__tests__/health.test.ts`), and database-backed job processors (`__tests__/processors.test.ts`) (100% passing across 23 tests).
