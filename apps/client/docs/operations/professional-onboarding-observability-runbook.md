# Professional Onboarding Observability & Regulator Verification — Runbook

Owner: Platform/Backend · Scope: `professional_funnel.*` events, `RegulatorVerificationGateway`,
the license-verification BullMQ queue, and the manual operator workflow.

## 1. What this system does

A professional submits license details during onboarding. `professional.onboarding_submitted`
enqueues one `license-verification` job per license (deduped by authority + license number +
professional ID). A worker calls `RegulatorVerificationGateway.verify()`, which either:

- **Auto-verifies** (high-confidence match against a live regulator API), or
- **Routes to manual review** (low confidence, explicit rejection, unsupported authority, or
  regulator outage).

Every attempt — auto or manual — is persisted to `RegulatorVerificationCase` with its evidence
snapshot, confidence reasons, and retry state. Manual decisions are recorded in
`RegulatorVerificationDecision` and mirrored into `AdminAuditLog`.

## 2. Dashboards

Build these against the `professional_funnel_events_total` OTel counter
(`OtelProfessionalFunnelSink`, attributes: `event`, `status`, `errorCode`, `source`) and the
`RegulatorVerificationCase` table, following the same Grafana/dashboard conventions as
`nats_client_*` (see `MONITORING.md`).

| Panel                    | Query shape                                                                           | Why it matters                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Funnel conversion        | `professional_funnel_events_total` grouped by `event`, windowed                       | Where onboarding drops off (CTA → sign-up → wizard → submit → verified)  |
| Upload failure rate      | `uploadFailed / (uploadSucceeded + uploadFailed)`                                     | Storage/malware-scan pipeline health                                     |
| Auto-verify rate         | `RegulatorVerificationCase` count by `status`, grouped by `authority`                 | Whether auto-verification is actually reducing manual load per authority |
| Manual review backlog    | count of `NEEDS_MANUAL_REVIEW` / `LOW_CONFIDENCE` cases, age bucketed                 | Operator staffing / SLA risk                                             |
| Dead-letter queue        | count of `status = DEAD_LETTER`, by `authority`                                       | Attempt-budget exhaustion — needs manual intervention, see §5            |
| Regulator adapter health | `RATE_LIMITED` / `SERVER_ERROR` / `AUTH` error rate per authority (from adapter logs) | Distinguishes "authority is down" from "our credentials broke"           |

## 3. Alerts

| Alert                     | Condition                                                                    | Severity | Action                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulator auth failure    | Any `AUTH`-classified adapter error                                          | Page     | Credentials/signing broke — not user-fixable by retrying. Check `REGULATOR_<AUTHORITY>_*` env vars and the regulator's portal for credential expiry. |
| Dead-letter spike         | `RegulatorVerificationCase.status = DEAD_LETTER` count > threshold in 15 min | Page     | See §5 dead-letter recovery.                                                                                                                         |
| Manual review backlog age | Oldest `NEEDS_MANUAL_REVIEW` case > 24h                                      | Ticket   | Staffing/SLA issue for the operator queue, not an engineering incident.                                                                              |
| Submit failure rate       | `submitFailed / submitSucceeded` > 5% over 1h                                | Ticket   | Usually a Clerk sync or validation regression — check `submitFailed` `errorCode` breakdown.                                                          |
| Regulator outage          | `REGULATOR_UNAVAILABLE` rate for one authority > threshold                   | Ticket   | Confirm with the regulator's own status page before assuming our adapter is broken.                                                                  |

## 4. Incident remediation

**A regulator's API is down (`REGULATOR_UNAVAILABLE`, `retryable: true`):**
The queue already retries with exponential backoff — no action needed unless the outage
outlasts the attempt budget (5 attempts), in which case affected cases land in `DEAD_LETTER`
(§5). No need to manually flip `enableAutoVerify<AUTHORITY>` off unless the outage is prolonged
enough that you'd rather route everything straight to manual review in the meantime.

**Auth failures against a regulator (`AUTH`):**
This is not a regulator outage — it means our credentials or request signing broke. Retrying
will not help (the adapter deliberately marks this `retryable: false`). Rotate/verify
`REGULATOR_<AUTHORITY>_API_KEY` / `REGULATOR_<AUTHORITY>_SIGNING_SECRET` and re-deploy.

**Malformed response from a regulator (`MALFORMED_RESPONSE`):**
The regulator changed their API contract, or the placeholder default mapper
(`default-response-mapper.ts`) doesn't match their actual shape. Needs an adapter code change,
not a retry or a config change.

## 5. Dead-letter recovery

1. Query `RegulatorVerificationCase` where `status = 'DEAD_LETTER'`.
2. Read `deadLetterReason` to understand why the attempt budget was exhausted.
3. If the root cause is fixed (credentials rotated, regulator back up, adapter patched), requeue
   by re-publishing `professional.onboarding_submitted` for the affected professional/license, or
   directly re-enqueue via `enqueueLicenseVerification()` with the same request — the dedupe key
   is stable so this is safe to call again once BullMQ's job for that key has actually failed out
   (not while it's still waiting/active).
4. If root cause can't be resolved quickly, route the case to manual review instead of leaving it
   dead-lettered indefinitely — an operator can approve/reject directly via `recordManualDecision`.

## 6. Manual verification operator workflow

- List/detail: `listVerificationCases`, `getVerificationCaseDetail` (redacts `evidence.rawRecord`
  for any admin role other than `SUPER_ADMIN` — see `evidence-store.ts`).
- Every decision requires a `reasonCode` — there is no reason-less approve/reject path.
- **High-risk decisions** (overriding a regulator rejection, or approving below the confidence
  threshold) require **two different admins** to submit the same outcome before the case status
  changes. The first high-risk decision is recorded but leaves the case `NEEDS_MANUAL_REVIEW`
  until a second, different admin agrees (`recordManualDecision` → `requiresSecondApprover`).
- Every decision is immutable (insert-only) and mirrored into `AdminAuditLog` under action
  `REGULATOR_VERIFICATION_MANUAL_DECISION`.
- **Not yet built:** the actual admin-facing UI for this workflow. The backend service layer
  above is ready to build a page against; no frontend exists yet (see PROGRESS-SUMMARY.md).

## 7. Evidence retention

`enforceEvidenceRetention(prisma, { retentionDays })` strips `evidence.rawRecord` (the
unredacted regulator payload) from cases older than the retention window while preserving the
normalized record, confidence, and full decision trail. Run this on the same schedule as the
existing `DATA_RETENTION_ENFORCED` job.

## 8. Known gaps / follow-ups

- **Resolved:** Per-authority contracts (`contract.ts`), path builders (`path.ts`), test fixtures (`exact_match`, `not_found`, `suspended`, `malformed`), contract versioning in evidence snapshots, and static CI drift checks (`check-regulator-contract-drift.mjs`) have been implemented for all 7 statutory regulators (`NCA`, `EPRA`, `BORAQS`, `EBK`, `EARB`, `VRB`, `ISK`). Per-authority production flag flips (`enableAutoVerify<AUTHORITY>`) remain gated by the 2–4 week shadow-mode validation period.
- **Resolved:** All 7 statutory flags (`enableAutoVerifyNCA`, `enableAutoVerifyEPRA`, `enableAutoVerifyBORAQS`, `enableAutoVerifyEBK`, `enableAutoVerifyEARB`, `enableAutoVerifyVRB`, `enableAutoVerifyISK`) now exist in Prisma `SystemSettings`, `apps/admin`, and `buildProductionAdapterMap`.
- **Resolved:** Client-side funnel tracking events (`landingCtaClicked` through `submitFailed`, `pendingVerificationViewed`) are fully wired across `OnboardingView` role cards, `ProfessionalForm` wizard steps and submission handlers, and `DocumentsStep` file upload handlers via `useProfessionalFunnelTracking()`.
- **Resolved:** The manual verification operator UI is built at `apps/admin/src/app/(dashboard)/verifications/regulator/page.tsx` with `RegulatorVerificationQueue`, `RegulatorVerificationDetailDialog`, and server actions supporting evidence redaction, duplicate license detection, and multi-approver high-risk decisions.
