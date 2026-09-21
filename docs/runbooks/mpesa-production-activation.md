# M-Pesa Daraja Production Activation & Cutover Runbook

**Service:** `apps/client`, `apps/workers`, `@build/mpesa`  
**Classification:** Tier 1 Financial Operations & Launch Gating  
**Last Updated:** 2026-09-20  
**Authority:** ADR-008, ADR-ADMIN-012, P0-7 Recommendation

---

## 1. Scope & Pre-Activation Gating

This runbook defines the mandatory verification gates, infrastructure checks, and cutover procedures required before activating paid M-Pesa transactions (subscription renewals and lead-credit purchases) in production.

> [!IMPORTANT]
> **Day-1 Launch State:** BuildMarket launches with **zero payment dependencies**. The Founding Professional Program grants 180-day 100% comped access to onboarding professionals. Paid M-Pesa checkout remains strictly disabled via the `FEATURE_BILLING_ENABLED=false` kill-switch until every gate in this runbook is satisfied and signed off.

---

## 2. Pre-Activation Checklist (Hard Gates)

Every gate below must have signed verification evidence prior to flipping `FEATURE_BILLING_ENABLED=true`:

| Gate                                     | Requirement                                                                                               | Verification Procedure                                                                  | Sign-off Owner        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------- |
| **Gate 1: Legal & CBK Boundary**         | Written legal counsel confirmation regarding Cap 491C merchant collection vs P2P facilitation bright line | Check `docs/launch/evidence/P0-7_FINANCIAL_CUSTODY_AND_PAYMENTS_RECORD.md` §1           | Legal Counsel         |
| **Gate 2: Production Credentials**       | Safaricom Daraja Production Paybill/Shortcode & Passkey issued to Build Market Technologies Ltd           | Verify production Consumer Key, Secret, and Passkey loaded into AWS SSM / Doppler       | Finance / DevOps      |
| **Gate 3: Edge Callback & TLS**          | Public callback URL `https://buildmarket.app/api/webhooks/mpesa/stk-callback` reachable with valid TLS    | Run synthetic webhook POST check verifying 202 status and valid SSL cert chain          | Platform Engineering  |
| **Gate 4: Replay & Idempotency Drill**   | Duplicate `CheckoutRequestID` callbacks verified as idempotent no-ops                                     | Verify passing Vitest suite `mpesa-idempotency.test.ts` and staging Cypress drill       | Platform Engineering  |
| **Gate 5: Float & B2C Refund Readiness** | Dedicated B2C float funded with minimum KES 50,000 reserve for customer reversals                         | Verify Safaricom Org Balance via Daraja B2C balance enquiry API                         | Finance Operations    |
| **Gate 6: Tax & Invoicing (KRA eTIMS)**  | eTIMS digital signature & automated fiscal invoicing configured for paid subscriptions                    | Confirm eTIMS VSCU/OSCU API integration endpoint produces compliant KRA fiscal invoices | Finance Operations    |
| **Gate 7: Operational Runbooks**         | Support staff trained on reconciliation and tiered refund procedures                                      | Review `mpesa-refund-and-reversal.md` and `mpesa-reconciliation.md`                     | Customer Support Lead |

---

## 3. Canary Verification Procedure (Zero-Volume Test)

Before routing public user payments:

1. **Staging Synthetic Drill:**
   Execute Cypress test-control suite:

   ```bash
   pnpm test:staging:mpesa-replay
   ```

   Confirm that synthetic callbacks settle ledger rows atomically with zero duplicate credits.

2. **Internal Production Canary Transaction:**
   - Configure internal engineer phone number for a 1-KES test subscription.
   - Set `FEATURE_BILLING_ENABLED=true` temporarily for the canary user ID.
   - Initiate STK push via `/api/v1/subscriptions/checkout`.
   - Confirm Daraja push arrives on handset with correct Paybill name `"BUILD MARKET TECHNOLOGIES"`.
   - Authorize transaction via M-Pesa PIN.
   - Verify webhook arrival at `/api/webhooks/mpesa/stk-callback` within &lt;5 seconds.
   - Confirm transaction status updates to `COMPLETED` and receipt number is recorded.
   - Verify immediate B2C refund of KES 1 back to the engineer handset.

---

## 4. Operational Kill-Switch Protocol

If any anomaly occurs post-activation (e.g. duplicate callback storm, Daraja API latency &gt; 15s, reconciliation mismatch):

1. **Immediate Flip:**
   Update runtime environment variable without redeployment:

   ```bash
   # Via AWS SSM / Vercel / Cloudflare Environment:
   FEATURE_BILLING_ENABLED=false
   ```

2. **Behavior Under Kill-Switch:**
   - All `/api/v1/subscriptions/checkout` calls immediately return `HTTP 503 Service Unavailable` with message: `"Paid subscription checkout is currently paused."`
   - Active user sessions, portfolio browsing, lead routing, and comped Founding Pro entitlements remain 100% operational.
   - Inbound webhook processing continues to settle in-flight transactions without disruption.
