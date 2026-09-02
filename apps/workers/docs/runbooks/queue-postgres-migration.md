# Runbook: BullMQ Redis to PostgreSQL Migration

## Overview

This runbook specifies the operational sequence for canary rollout, soak monitoring, and emergency rollback of BullMQ queues from Redis to PostgreSQL (`bullmq` schema) as specified in `apps/workers/docs/adr/adr-bullmq-nats-queue-split.md`.

---

## 1. Pre-Flight Verification Gate

Before enabling PostgreSQL for any queue:

1. **Verify PostgreSQL Version:**

   ```sql
   SELECT version(); -- Must be >= 14
   ```

2. **Execute Schema Migration Pre-Deploy:**

   ```bash
   pnpm --filter @build/queue-server run migrate
   ```

   _Expected Output:_ `[BullMQ Migration] 'bullmq' schema successfully verified.`

3. **Verify Direct TCP Connection:**
   Ensure `apps/workers` `DATABASE_URL` connects directly to PostgreSQL (not through transaction-mode PgBouncer) so `LISTEN/NOTIFY` session connections function without dropping notifications.

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
  - Zero `503` spikes on `/healthz`.
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

### Tier 3: High-Stakes (Compliance, License, M-Pesa Financials)

- **Queues:** `security-incidents`, `compliance-notifications`, `audit-logs`, `license-verification`, `mpesa-payments`, `mpesa-reconciliation`
- **Environment Variables:**

  ```env
  QUEUE_BACKEND=postgres
  ```

- **Go / No-Go Criteria:**
  - Idempotent settlement on M-Pesa STK callbacks.
  - License verification job processing without dropped claims.

---

## 3. Emergency Rollback Procedure

If unexpected latency, lock contention, or connection drops occur:

1. **Inspect Stranded Jobs:**

   ```bash
   pnpm tsx scripts/reconcile-queue-backend.ts --queue <QUEUE_NAME> --inspect
   ```

2. **Revert Environment Variable:**

   ```env
   QUEUE_BACKEND_<QUEUE_NAME>=redis
   ```

3. **Replay In-Flight / Delayed Jobs to Redis:**

   ```bash
   pnpm tsx scripts/reconcile-queue-backend.ts --queue <QUEUE_NAME> --from postgres --to redis
   ```

4. **Restart Worker Process:**
   Deploy updated environment variables.
