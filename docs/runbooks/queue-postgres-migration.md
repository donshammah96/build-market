# Runbook: BullMQ Redis to PostgreSQL Migration

## Overview

This runbook specifies the operational sequence for canary rollout, soak monitoring, and emergency rollback of BullMQ queues from Redis to PostgreSQL (`bullmq` schema) as specified in `apps/workers/docs/adr/adr-bullmq-nats-queue-split.md`.

---

## 1. Pre-Flight Verification Gate & Render Wiring

Before enabling PostgreSQL for any queue:

1. **Verify PostgreSQL Version:**

   ```sql
   SELECT version(); -- Must be >= 14
   ```

2. **Schema Migration Execution on Render:**
   - **Docker Deployments (Current)**: The container entrypoint (`apps/workers/Dockerfile` $\rightarrow$ `node dist/index.js`) automatically executes `migrateBullMqSchema()` in-process on boot before initializing workers. If migration fails, it terminates with `process.exit(1)`, prompting Render's zero-downtime deploy to preserve the existing instance. No Start Command configuration is needed.
   - **Native Node Deployments (Optional)**: If using Render's native Node runtime, chain into Settings $\rightarrow$ Start Command:

     ```bash
     pnpm --filter @build/queue-server run migrate && pnpm --filter workers start
     ```

   _Note:_ `migrate.ts` automatically executes as a safe no-op when all queues resolve to `redis`. It creates and verifies the `bullmq` schema namespace when any queue is set to `postgres`.

3. **Verify Direct TCP Connection & Pool Budget:**
   Ensure `DATABASE_URL` connects directly to PostgreSQL (not through transaction-mode PgBouncer) so `LISTEN/NOTIFY` session connections function without dropping notifications.
   Ensure connection pool limits (`QUEUE_POOL_MAX` or `QUEUE_POOL_MAX_<QUEUE_NAME>`) are configured within database `max_connections` bounds.

---

## 2. Canary Rollout Sequence (3 Tiers)

### Tier 1: Low-Stakes Canary (Maintenance & Notification Retries)

- **Queues:** `maintenance-jobs`, `notification-retries`
- **Environment Variables:**

  ```env
  QUEUE_BACKEND_MAINTENANCE_JOBS=postgres
  QUEUE_BACKEND_NOTIFICATION_RETRIES=postgres
  ```

- **Soak Duration:** 48 Hours.
- **Go / No-Go Criteria:**
  - Zero `503` spikes on `/healthz` or `/`.
  - Claim latency $< 100\text{ms}$.
  - Failed job rate $< 0.1\%$.

### Tier 2: Medium-Stakes (Newsletter, Export, Uploads)

- **Queues:** `newsletter-confirmation-email`, `newsletter-esp-sync`, `gdpr-data-export`, `uploads-image-processing`
- **Environment Variables:**

  ```env
  QUEUE_BACKEND_NEWSLETTER_CONFIRMATION_EMAIL=postgres
  QUEUE_BACKEND_NEWSLETTER_ESP_SYNC=postgres
  QUEUE_BACKEND_GDPR_DATA_EXPORT=postgres
  QUEUE_BACKEND_UPLOADS_IMAGE_PROCESSING=postgres
  ```

- **Soak Duration:** 48 Hours.
- **Go / No-Go Criteria:**
  - Export zip generation and image processing complete with expected I/O throughput.
  - No connection pool saturation warnings in worker logs.
  - Zero `503` spikes on `/healthz`.
  - Failed job rate $< 0.1\%$.

### Tier 3: High-Stakes (Compliance, License, M-Pesa Financials)

- **Queues:** `security-incidents`, `compliance-notifications`, `audit-logs`, `license-verification`, `mpesa-payments`, `mpesa-reconciliation`
- **Environment Variables:**

  ```env
  QUEUE_BACKEND_SECURITY_INCIDENTS=postgres
  QUEUE_BACKEND_COMPLIANCE_NOTIFICATIONS=postgres
  QUEUE_BACKEND_AUDIT_LOGS=postgres
  QUEUE_BACKEND_LICENSE_VERIFICATION=postgres
  QUEUE_BACKEND_MPESA_PAYMENTS=postgres
  QUEUE_BACKEND_MPESA_RECONCILIATION=postgres
  ```

- **Soak Duration:** 72 Hours.
- **Go / No-Go Criteria:**
  - Zero `503` spikes on `/healthz` or `/`.
  - Claim latency $< 100\text{ms}$.
  - Failed job rate $< 0.01\%$.
  - Idempotent settlement on M-Pesa STK callbacks.
  - License verification job processing without dropped claims.
  - Only after all 11 queues soak cleanly for 72h, optionally set `QUEUE_BACKEND=postgres` as a global default.

---

## 3. Emergency Rollback Procedure

If unexpected latency, lock contention, or connection drops occur:

1. **Pause Workers for Affected Queue:**
   Scale down workers or set `DISABLE_BACKGROUND_JOBS=true` temporarily to prevent in-flight race conditions during migration reconciliation.

2. **Inspect Stranded Jobs:**

   ```bash
   pnpm tsx scripts/reconcile-queue-backend.ts --queue <QUEUE_NAME> --inspect
   ```

3. **Replay In-Flight / Delayed Jobs to Redis:**

   ```bash
   pnpm tsx scripts/reconcile-queue-backend.ts --queue <QUEUE_NAME> --from postgres --to redis
   ```

4. **Revert Environment Variable:**

   ```env
   QUEUE_BACKEND_<QUEUE_NAME>=redis
   ```

5. **Restart Worker Process:**
   Deploy updated environment variables and verify `/healthz` reports 200 OK.
