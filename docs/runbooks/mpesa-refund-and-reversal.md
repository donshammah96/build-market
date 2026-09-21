# M-Pesa Customer Refund & Reversal Runbook

**Service:** `apps/client`, `apps/admin`, `apps/workers`  
**Classification:** Tier 1 Financial Operations  
**Last Updated:** 2026-09-20  
**Authority:** ADR-008, ADR-ADMIN-001, ADR-ADMIN-008, ADR-ADMIN-012, P0-7 Recommendation

---

## 1. Overview & Refund Philosophy

BuildMarket adheres to a strict non-custodial marketplace model. The platform collects only direct platform service fees (subscriptions and lead credits) and never handles client project milestone funds.

For platform service charges, BuildMarket's refund policy prioritizes **same-day customer resolution via direct platform B2C float payout**. The platform does **not** default to slow Safaricom-side C2B reversal requests, which require manual operator intervention at Safaricom and lack SLA guarantees.

---

## 2. Tiered Refund SLAs

| Scenario                                          | Definition & Detection                                                                                | Mechanism                                                                          | SLA                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| **Tier 1: Mechanically Obvious Duplicate Charge** | Two successful STK transactions for the same user ID and plan within a 15-minute window               | Automated detection or single-click admin approval; B2C payout from platform float | **Same Business Day (&lt;24 hours)** |
| **Tier 2: Failed Fulfillment / System Outage**    | Payment settled but lead credits or subscription entitlements failed to attach after retry exhaustion | Automated reconciliation or support ticket; B2C payout from platform float         | **&lt;24 hours**                     |
| **Tier 3: Disputed Charge / Fraud Claim**         | User disputes authorization, claims account takeover, or requests partial refund                      | Manual investigation by Trust &amp; Safety and Finance Operations                  | **72 hours ceiling**                 |

---

## 3. Standard Refund Execution Procedure (B2C Default)

All manual refunds must be processed through the Admin Transactions Dashboard:

1. **Access Control & Session Freshness:**
   - Admin actor must possess `PROCESS_REFUNDS` or `MANAGE_FINANCIALS` capability.
   - Requires Tier 1 session freshness: `maxAgeSeconds: 180`. If recent authentication has expired, re-authentication is enforced (ADR-ADMIN-001).

2. **Locate Transaction:**
   - Navigate to `/admin/transactions`.
   - Query by `transactionId`, `checkoutRequestId`, or `mpesaReceiptNumber`.

3. **Validate Refund Eligibility:**
   - Confirm original transaction status is `COMPLETED`.
   - Confirm no previous refund record exists for this `transactionId` in `MpesaRefundTransaction`.
   - Confirm refund reason is documented (e.g. `DUPLICATE_STK_PUSH`, `SERVICE_CANCELLATION`, `FULFILLMENT_FAILURE`).

4. **Execute B2C Float Refund:**
   - Click **Issue M-Pesa B2C Refund**.
   - Review destination phone number (matches original paying MSISDN).
   - Enter reason note (min 10 characters).
   - Click **Authorize Refund**.
   - Admin action invokes `client.mpesa.b2cPaymentRequest` against platform utility float.

5. **Audit Logging & Verification:**
   - Declarative `admin.auditLog` entry is written atomically before returning success (ADR-ADMIN-008):
     - `operationName: "issue_mpesa_refund"`
     - `targetId: transaction.id`
     - `details: { amount, reasonCode, recipientMsisdnHash, receiptNumber }`
   - Customer receives Safaricom M-Pesa confirmation SMS instantly.

---

## 4. Safaricom C2B Reversal (Fallback Only)

Safaricom-side C2B reversal is reserved exclusively as a last-resort fallback when B2C float payout is technically impossible (e.g. platform float completely exhausted, or specific bank-instructed reversal):

1. **Escalation to Safaricom:**
   - Contact Safaricom Merchant Support at `business.support@safaricom.co.ke` or call `100 / 200`.
   - Provide Organization Paybill Number, `MpesaReceiptNumber`, transaction date, and amount.
2. **Customer Advisory:**
   - Notify customer via `billing@buildmarket.app` providing the Safaricom Reversal Reference Number.
   - Advise of Safaricom's 48–72 hour turnaround window.

---

## 5. Consumer Dispute Escalation Path

If an internal refund or billing inquiry is disputed:

1. **First-Tier Escalation:**
   - Dedicated email: `billing@buildmarket.app`.
   - Support ticket routed directly to Marketplace Operations Lead with 24-hour response target.
2. **Safaricom Customer Recourse:**
   - If user claims non-receipt of verified B2C disbursement, provide the B2C transaction receipt ID for verification at any Safaricom Shop or via Safaricom Customer Care (234).
3. **Regulatory Fallback:**
   - Consumers retain statutory recourse under Kenya's Consumer Protection Act 2012 and the Central Bank of Kenya Consumer Protection Guidelines.
