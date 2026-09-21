# P0-7: Financial Custody Prohibition & Payments Operating Record

**Document Status:** Approved Baseline  
**Governing Statute:** Central Bank of Kenya (CBK) National Payment System Act (Cap 491C) & Retail Transfer Regulations 2014  
**Evidence Date:** 2026-09-20  
**Owner:** Finance, Legal & Platform Engineering  
**Next Review:** 2026-12-20  
**Authority:** ADR-008, ADR-ADMIN-012, P0-7 Recommendation

---

## 1. Executive Summary & Statutory Stance

The P0-7 recommendation in [`docs/MVP_LAUNCH_AUDIT_AND_HARDENING.md`](../MVP_LAUNCH_AUDIT_AND_HARDENING.md) establishes that financial custody and customer funds safeguarding must remain strictly out of scope for the BuildMarket marketplace MVP.

Under Kenya's **National Payment System (NPS) Act (Cap 491C)** and the **National Payment System (Electronic Retail Transfers) Regulations 2014**, any entity that holds, pools, safeguards, or provides escrow for funds in retail transactions is classified as a Payment Service Provider (PSP) or custodial trust institution. Such classification triggers:

1. Mandatory CBK licensing and authorization prior to commencing operations.
2. Mandatory core capital reserves and statutory deposits.
3. Separation of customer funds into statutory trust accounts held at licensed commercial banks.
4. Regular regulatory examination, audit, and CBK reporting.

**Architectural Determination:**
BuildMarket operates exclusively as a **non-custodial marketplace**. All client-to-contractor milestone disbursements, materials procurement, and building project payments remain direct, peer-to-peer off-platform settlements. BuildMarket never holds, safeguards, or pools customer milestone funds.

---

## 2. Regulatory Boundary Analysis (Counsel Q&A Record)

To ensure comprehensive statutory compliance, legal counsel was tasked with addressing two distinct regulatory questions under Cap 491C:

### Question A: Platform Subscription & Credit Billing

_Is BuildMarket's collection of its own subscription fees and lead credits via Safaricom Daraja M-Pesa STK Push compliant with Cap 491C without requiring a PSP license?_

**Counsel Conclusion:**
Yes. BuildMarket's collection of subscription fees (Pro tier membership) and optional digital credits (lead intake) constitutes ordinary merchant settlement for first-party software-as-a-service (SaaS) and marketplace tools. BuildMarket operates as the direct payee/merchant of record under a standard commercial merchant paybill agreement with Safaricom. This does not constitute operating a payment system or money remittance service under Cap 491C.

### Question B: Peer-to-Peer Facilitation Bright Line

_What is the statutory bright line regarding homeowner payments to building contractors?_

**Counsel Conclusion & Standing Invariant:**

- **Permissible:** Providing structured milestone contract templates, stage sign-off checklists, and record-keeping features where parties confirm that milestone disbursements were made directly.
- **Strictly Prohibited (Standing Invariant):** The platform must **never display, embed, or route a contractor's personal M-Pesa till, paybill number, or bank account through the platform's checkout or payment infrastructure** (e.g. "click here to pay your contractor via M-Pesa"). Routing or facilitating financial transfers between two independent third parties triggers classification as a payment facilitation intermediary or retail money transfer service under Cap 491C, exposing the platform to severe regulatory penalties.

---

## 3. Marketing & Public Surface Copy Audit

A comprehensive audit was conducted across all client application surfaces to eliminate legacy "escrow", "custodial wallet", and "bank-grade security" claims that could mislead consumers or create regulatory exposure.

### Audit Actions Taken:

1. **Homeowner Sign-up (`apps/client/app/sign-up/[[...sign-up]]/page.tsx`):**
   - Replaced `"Protect your milestone funds with bank-grade escrow"` with `"Track project stages with transparent milestone sign-offs"`.
   - Replaced `"Protected Milestone Escrow"` title with `"Milestone Stage Tracking"`.
2. **Professional Sign-up (`apps/client/app/professional/sign-up/[[...sign-up]]/page.tsx`):**
   - Replaced `"verified milestone escrows"` with `"structured milestone contracts"`.
   - Replaced `"Protected Milestone Escrow"` title with `"Milestone Contract Tracking"`.
3. **Professional Landing Page (`apps/client/app/professional/page.tsx`):**
   - Replaced `"Escrow milestone protection"` with `"Milestone stage sign-offs"`.
   - Replaced `"and escrow payments inside one centralized platform"` with `"and verified payment milestones inside one centralized platform"`.
   - Replaced `"milestone escrow tracking"` with `"milestone progress tracking"`.
4. **Professional UI Component (`Professionals.tsx`):**
   - Replaced `"protect your milestone earnings with escrow"` with `"secure your milestone earnings with clear stage approvals"`.
5. **Dashboard Mock Component (`MockDashboardUi.tsx`):**
   - Replaced status badge `"Milestone Escrow"` with `"Milestone Recorded"`.
6. **Entitlements Type System (`packages/entitlements/src/types.ts`):**
   - Updated `platformFeeDiscountPct` docstring to `"Platform transaction fee reduction percentage"`.

### Automated CI Regression Guard:

Implemented [`apps/client/__tests__/legal/no-escrow-marketing-copy.test.ts`](../../../apps/client/__tests__/legal/no-escrow-marketing-copy.test.ts):

- Scans all public marketing, onboarding, and component source files (346 tests).
- Banned terms: `/escrow/i`, `/bank-grade escrow/i`, `/custodial wallet/i`, `/safeguarded funds/i`, `/secure hold/i`, `/we hold your funds/i`.
- Explicitly excludes `/legal/**` so legitimate statutory disclaimers (e.g. _"Build Market does not hold funds in escrow"_) are permitted and not false-positive flagged.
- Status: **346 tests passing in CI**.

---

## 4. Founding Professional Program Governance & Commercial Terms

To eliminate payment activation as a Day-1 launch blocker and seed verified supply, the Founding Professional Program grants complimentary access under explicit, transparent commercial terms.

### Commercial Policy Specification:

Published at [`apps/client/app/legal/founding-pro-terms/page.tsx`](../../../apps/client/app/legal/founding-pro-terms/page.tsx):

- **Comped Duration:** 180 days (6 months) from the date of approved statutory verification.
- **Commercial Valuation:** Stated value of KES 3,500/month (cumulative commercial value of KES 21,000). Zero monetary consideration required.
- **Notice Cadence:** Automated reminders sent via SMS and Email at Day −30, Day −14, Day −7, and Day −1 prior to expiry.
- **No-Surprise Conversion Invariant:** Upon `foundingProUntil` passing without action, the account gracefully degrades to the limited Free tier. The platform **never initiates an automated M-Pesa STK push, phone debit, or unauthorized billing**. Moving to paid Pro requires affirmative initiation and PIN entry by the user.
- **Post-Comp Privilege:** Lifetime 15% discount on all subsequent Pro subscription renewals.
- **Involuntary Removal Clause:** Comped access is immediately terminable without indemnity if credentials (NCA, BORAQS, EBK) are revoked, falsified, or if the member violates platform trust and safety policies.

### Internal Cohort Cap & Anti-Abuse Controls:

- **Ceiling:** Capped at the first 250 professionals who complete statutory verification during the Nairobi/Kiambu pilot intake.
- **Verification-Gated:** Eligibility attaches upon verified accreditation approval in `apps/verification-ops`, not on signup timestamp, preventing slot hoarding by unverified or spam accounts.
- **Unpublished Scarcity:** The cap number is maintained as an internal operational ceiling, avoiding aggressive marketing countdown hooks that undermine consumer trust.
- **Audit Logging:** Every Founding Pro grant, extension, or administrative override generates an append-only `AdminAuditLog` entry with cryptographic hash chaining (ADR-ADMIN-008).

---

## 5. Operational Readiness for Paid M-Pesa Activation

Paid M-Pesa rails are decoupled from Day-1 launch and gated behind verified operational runbooks and controls:

1. **Billing Kill-Switch (`billing_enabled`):**
   - Configured in `@build/capabilities` and `env.features.billingEnabled`.
   - Gated in `apps/client/app/api/v1/subscriptions/checkout/route.ts`.
   - When disabled, returns `503 Service Unavailable` with message: `"Paid subscription checkout is currently paused."`
2. **Webhook Idempotency & Replay Protection:**
   - Implemented in `apps/client/app/api/webhooks/mpesa/stk-callback/route.ts`.
   - Asserts that replayed callbacks for completed transactions or already-processed callback events return HTTP 202 without duplicate entitlement grants or background job enqueues.
   - Tested in `apps/client/__tests__/webhooks/mpesa-idempotency.test.ts` (3 tests passing).
3. **Operational Runbooks:**
   - [`docs/runbooks/mpesa-production-activation.md`](../runbooks/mpesa-production-activation.md): Complete credentials verification, edge SSL, IP whitelisting, eTIMS digital tax invoicing prerequisite, and cutover drill.
   - [`docs/runbooks/mpesa-refund-and-reversal.md`](../runbooks/mpesa-refund-and-reversal.md): Default B2C float payout procedure, tiered SLAs (&lt;24h for duplicate charges, 72h ceiling for disputes), Safaricom escalation, and consumer recourse paths.
   - [`docs/runbooks/mpesa-reconciliation.md`](../runbooks/mpesa-reconciliation.md): Automated worker lease reconciliation and stale claim resolution.

---

## 6. Launch Gating Conclusion

BuildMarket satisfies all statutory and operational criteria for non-custodial marketplace operation:

- **Platform Custody:** Formally excluded; zero custodial funds held.
- **Marketing Claims:** Purged and guarded by automated CI checks.
- **Founding Pro Terms:** Published, transparent, and non-predatory.
- **Paid M-Pesa Rails:** Fully gated behind production credential sign-offs, eTIMS integration, and the `billing_enabled` kill-switch.
