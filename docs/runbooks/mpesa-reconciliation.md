# M-Pesa Reconciliation & Stale Claims Runbook

**Service:** `apps/workers` (`mpesa-reconciliation` queue)  
**Classification:** Tier 1 Financial Resilience  
**Last Updated:** 2026-08-31

## Overview

The M-Pesa reconciliation worker periodically queries Safaricom Daraja for transactions that remain in the `PROCESSING` state (e.g. due to dropped callbacks or network partitions). It claims eligible rows using a distributed lease protocol (`reconciliationClaimId`, `reconciliationClaimedAt`), queries Safaricom using `MpesaClient.queryStkPush`, and executes atomic settlement.

## Operational Alerts & Thresholds

| Alert                                 | Condition                                         | Action                                                                                |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `MpesaReconciliationLag`              | Oldest pending payment age > 30 minutes           | Check worker health (`/healthz`), Redis connectivity, and Daraja status               |
| `MpesaReconciliationRetriesExhausted` | `reconciliationAttempts >= 10`                    | Transaction moved to `FAILED` with `EXHAUSTED` code. Investigate in admin dashboard   |
| `MpesaDuplicateReceiptCollision`      | Receipt number matched to a different transaction | **P0 Security/Fraud Incident**: Lock professional payout/wallet and inspect audit log |
| `MpesaProvider429RateLimit`           | Safaricom HTTP 429 spike                          | Worker automatically applies exponential backoff; check concurrent request limits     |

## Manual Requery Procedure

If an authenticated user reports a payment delay:

1. Operations / Finance Admin navigates to the Admin Transactions Dashboard (`VIEW_FINANCIALS`).
2. Search by transaction ID, masked phone search hash, or checkout request ID.
3. Click **Requery Transaction** (`RECONCILE_PAYMENTS` capability required, 180s recent auth enforced).
4. An immediate BullMQ job is enqueued to `mpesa-reconciliation`. The worker queries Daraja and settles within seconds.
5. Verify audit log entry for `requery_mpesa_transaction`.

## Incident Troubleshooting

1. **Stale Lease Recovery:**
   If a worker pod crashes mid-query, the lease expires after 120 seconds. The next sweep automatically reclaims the record.
2. **Provider Down / 5xx:**
   The processor catches provider errors, schedules exponential backoff (`Math.pow(2, attempts) * 30` seconds), and preserves terminal integrity.
