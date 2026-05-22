# OWASP ASVS Canonical Remediation Plan - `apps/client` (Build Market)

**Document type:** Canonical remediation and verification baseline  
**Standard:** OWASP ASVS 4.0.3  
**Target assurance:** L2 by default, with selected L3 controls for escrow, payout, identity, and compliance flows  
**Effective date:** 2026-03-30  
**Supersedes for remediation tracking:** `docs/OWASP-ASVS-CLIENT-APP-AUDIT.md`  
**Scope:** Supplied audit text, `.agent/API-TO-FRONTEND-ARCHITECTURE.md`, `.github/copilot-instructions.md`, scoped instruction files, and selected `apps/client` runtime implementations where architecture drift materially affects security posture  
**Out of scope:** CDN/WAF/TLS termination, cloud IAM, and Clerk-managed credential storage internals

---

## Canonical Role

This is the source-of-truth remediation document for ASVS-aligned security work in `apps/client`.

- Keep `docs/OWASP-ASVS-CLIENT-APP-AUDIT.md` as historical input evidence.
- Use this document to decide what is closed, what is still open, and what needs machine-enforced follow-through.
- Do not close a security item here on prose alone. A remediation item closes only when code, docs, tests, and enforcement are aligned.

---

## Canonical Remediation Principles

> 1. **Preserve its strongest findings.**
> 2. **Correct the false positives and ASVS control IDs.**
> 3. **Add the missing repo-specific controls in this review.**
> 4. **Treat code-to-doc drift as a tracked remediation stream, not as an afterthought.**
> 5. **Add machine-enforced checks wherever possible, because this repo is already large enough that prose-only security governance will drift.**

These five rules govern every update to this document.

---

## Status Legend

- `Closed`: implemented and verified in code and/or CI.
- `Strengthen`: baseline exists, but control coverage is incomplete.
- `Open`: architecture or implementation requirement is not yet in place.
- `Drift`: architecture says one thing, current code still does another.
- `Planned`: accepted remediation, not yet implemented.

---

## Executive Verdict

The supplied audit is a strong starting point and correctly identifies Build Market as an L2 application with L3 handling for escrow release, payout initiation, and identity-verification transitions.

It was not safe to adopt unchanged as the canonical remediation document. The submitted version had three classes of issues:

- a small number of factual false positives
- several incorrect or incomplete ASVS control mappings
- repo-specific risks that matter in this codebase but were not elevated enough: CSRF, anti-caching, webhook replay suppression, idempotency replay data policy, observability drift, and env-boundary drift

The right move is not to discard the original audit. It is to preserve its strongest findings, correct it, and turn it into an enforceable remediation program. This document does that.

---

## Preserved Findings From The Submitted Audit

These findings were strong in the submitted audit and remain part of the canonical remediation baseline:

| Finding                                                                                | Keep | Canonical Track      |
| -------------------------------------------------------------------------------------- | ---- | -------------------- |
| Explicit trust boundaries are missing                                                  | Yes  | `GAP-001`            |
| `withAuth` fail-closed behavior must be documented and tested                          | Yes  | `GAP-003`            |
| Step-up authentication is required for escrow, payout, and identity-critical mutations | Yes  | `GAP-004`            |
| Session freshness after privilege change is a real risk                                | Yes  | `GAP-006`            |
| IDOR coverage must be systematic, not implied                                          | Yes  | `GAP-007`            |
| Mutation DTOs need allowlist-based mass-assignment protection                          | Yes  | `GAP-008`            |
| User-generated content needs rendering-safety rules                                    | Yes  | `GAP-009`            |
| File uploads need first-class architecture and not route-local folklore                | Yes  | `GAP-010`            |
| `apiError()` needs a safe client-message contract                                      | Yes  | `GAP-011`            |
| Data classification must become a real decision tool                                   | Yes  | `GAP-013`            |
| Per-actor anti-automation and server-side step sequencing are required                 | Yes  | `GAP-015`, `GAP-016` |

---

## Corrections To The Submitted Audit

### False positives and status corrections

| Submitted Item                               | Canonical Status | Correction                                                                                                | Evidence                                                                                                |
| -------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GAP-019` no dependency-vulnerability gate   | `Strengthen`     | Baseline gate already exists; remediation is to strengthen triage, SLAs, scheduled scans, and SBOM output | `.github/workflows/ci.yml`, root `package.json` `deps:audit`                                            |
| `GAP-018` security headers completely absent | `Strengthen`     | Header baseline exists, but coverage is incomplete                                                        | `apps/client/next.config.ts` already sets `X-Content-Type-Options: nosniff` and disables `X-Powered-By` |
| `GAP-002` no CORS rule exists anywhere       | `Strengthen`     | Shared helper exists; remaining gap is canonical policy plus full adoption and tighter enforcement        | `apps/client/app/lib/api/cors.ts`                                                                       |

### ASVS control-ID corrections

| Topic                                           | Submitted Mapping               | Canonical Mapping                                | Note                                                                                        |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Browser storage of sensitive data               | `V8.3.3`, `V8.3.6`              | `V8.2.2`, `V8.2.3`                               | This is browser-side storage and client-side caching policy, not server-side storage policy |
| Anti-caching of sensitive responses             | not explicitly called out       | `V8.2.1`                                         | Must be tracked separately from browser storage                                             |
| CORS allowlist and cross-origin API exposure    | `V14.4.6`                       | `V14.5.3`                                        | Referrer policy and CORS are different controls                                             |
| Referrer policy                                 | bundled into generic header gap | `V14.4.6`                                        | Keep separate from CORS tracking                                                            |
| Uploaded-file download and safe serving headers | over-attributed to `V12.5.1`    | `V14.4.2` plus `V12.5.x` upload-serving controls | File serving policy crosses both HTTP headers and upload handling                           |

---

## Canonical Remediation Backlog

### Architecture and design gaps preserved from the submitted audit

| ID        | Theme                                                   | ASVS                                       | Status       | Primary remediation target                                     |
| --------- | ------------------------------------------------------- | ------------------------------------------ | ------------ | -------------------------------------------------------------- |
| `GAP-001` | Explicit trust boundaries                               | `V1.1.2`, `V1.4.4`                         | `Closed`     | `.agent/API-TO-FRONTEND-ARCHITECTURE.md`                       |
| `GAP-003` | Fail-closed auth resolution                             | `V2.2.1`                                   | `Closed`     | `.github/copilot-instructions.md`, auth boundary tests         |
| `GAP-004` | Step-up auth for sensitive operations                   | `V2.2.5`, `V3.7.1`                         | `Open`       | architecture guide plus route/action critical journeys         |
| `GAP-005` | Cookie security attribute governance                    | `V3.4.1`, `V3.4.2`, `V3.4.3`, `V3.4.5`     | `Open`       | `.github/copilot-instructions.md`, Clerk integration checklist |
| `GAP-006` | Session invalidation / session freshness on role change | `V3.3.3`                                   | `Strengthen` | `ADR-001-auth-model.md`, Clerk metadata update flow            |
| `GAP-007` | Mandatory IDOR policy tests                             | `V4.2.1`, `V4.2.2`                         | `Open`       | policy test standard, route/domain test coverage               |
| `GAP-008` | Mass-assignment allowlisting                            | `V4.2.1`, `V5.1.3`                         | `Closed`     | mutation schemas, DTO contracts, linting                       |
| `GAP-009` | Output encoding and rendering safety                    | `V5.3.3`, `V5.3.4`                         | `Strengthen` | UI architecture rules, rendering linting                       |
| `GAP-010` | File-upload security policy                             | `V12.1.x`, `V12.2.x`, `V12.3.x`, `V12.5.x` | `Closed`     | upload architecture and storage/provider rules                 |
| `GAP-011` | Safe client error messages                              | `V7.4.1`, `V7.4.2`                         | `Closed`     | adapter conventions, static checks                             |
| `GAP-013` | Data classification ADR                                 | `V8.1.1`, `V8.2.1`, `V8.3.x`               | `Open`       | `ADR-006-data-classification.md`                               |
| `GAP-015` | Per-actor anti-automation                               | `V11.1.4`, `V11.1.5`                       | `Open`       | adapter rules, Redis-backed enforcement                        |
| `GAP-016` | Server-side step sequencing                             | `V11.1.6`, `V11.1.7`                       | `Open`       | onboarding and verification domain services                    |
| `GAP-017` | HTTP method semantics                                   | `V13.1.1`, `V13.2.1`                       | `Open`       | route conventions and static detection                         |
| `GAP-018` | Security header coverage                                | `V14.4.1`, `V14.4.6`, `V14.4.7`            | `Strengthen` | `next.config.ts`, header policy ADR                            |
| `GAP-019` | Dependency-vulnerability governance                     | `V14.2.1`                                  | `Strengthen` | CI policy, triage SLA, scheduled scans                         |

### Repo-specific controls that must be added to the canonical review

| ID        | Theme                                                                    | ASVS                                      | Status       | Why it matters here                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADD-001` | CSRF and same-origin mutation policy                                     | `V4.2.2`, `V13.2.3`                       | `Strengthen` | Shared auth and secure-action boundaries now enforce trusted-origin mutation checks, but architecture docs and route-exemption review rules still need to catch up                                                                          |
| `ADD-002` | Anti-caching for authenticated and sensitive responses                   | `V8.2.1`                                  | `Strengthen` | `withAuth` and callback responses now stamp `no-store, private`, but docs and explicit public override governance still need alignment                                                                                                      |
| `ADD-003` | Browser-storage policy covering both `sessionStorage` and `localStorage` | `V8.2.2`, `V8.2.3`                        | `Closed`     | Storage writes now require explicit allowlisting and the strict drift report is zero                                                                                                                                                        |
| `ADD-004` | Webhook replay and duplicate-delivery suppression                        | `V13.2.6`, `V11.1.4`                      | `Strengthen` | Clerk replay suppression, freshness checks, duplicate acknowledgement, and fail-closed production behavior are live; the remaining work is broader callback reuse and architecture codification                                             |
| `ADD-005` | Observability drift: PII in logs                                         | `V7.1.1`, `V7.1.2`, `V7.2.1`, `V7.2.2`    | `Strengthen` | Middleware, uploads, webhook, user-profile/compliance, and shared professional-portal helper paths are cleaned, but broader route-family cleanup still remains                                                                              |
| `ADD-006` | Env-boundary enforcement                                                 | `V14` configuration family                | `Closed`     | Guarded runtime files use the env module and the strict drift report is zero                                                                                                                                                                |
| `ADD-007` | Idempotency replay data-class policy                                     | `V8.3.x`                                  | `Closed`     | Replay persistence is now scope-governed with explicit ADR-006 data-class review and fail-closed unknown scopes                                                                                                                             |
| `ADD-008` | Upload implementation drift against desired production posture           | `V12.1.x`, `V12.2.x`, `V12.5.x`, `V8.2.1` | `Strengthen` | Production now fails closed for unsafe local delivery, has a real S3 path, and enforces worker-only image processing with a production inline-processing invariant; remaining work is architecture codification and deployment verification |
| `ADD-009` | Validation policy must cover server actions, not only routes             | `V13.2.2`, `V7.4.1`, `V7.4.3`             | `Closed`     | Strict drift gates, lint checks, and focused regression suites now enforce the policy baseline                                                                                                                                              |

### Observability Join-Key Update Note (2026-04-01)

As part of `ADD-005` follow-through, uploads adapter `operationName` values were normalized to snake_case to keep joins deterministic across route logs and downstream query tooling.

- `create-upload-asset` -> `create_upload_asset`
- `get-upload-asset-metadata` -> `get_upload_asset_metadata`
- `delete-upload-asset` -> `delete_upload_asset`
- `onboarding-upload` -> `onboarding_upload`

Rollout requirement: update dashboard and SIEM/log-query filters that key on legacy names in the same deployment window to prevent apparent drop-offs in operation-level charts.

### Pass Closure Notes (2026-04-01)

Additional closure updates completed in the same pass:

- Shared adapter context minimization: `withAuth` no longer propagates `userEmail` in `AuthContext`, reducing PII fan-out across route handlers while preserving actor identity and authorization fields (`clerkId`, `dbUserId`, `userRole`, optional `adminRole`).
- Uploads domain startup hardening: `app/lib/domains/uploads/service.ts` now resolves storage providers lazily per call and supports explicit test override injection, removing module-load singleton initialization risk and improving deterministic test setup.
- Canonical env singleton test alignment: middleware resolver regression coverage now overrides `env.services.internalApiSecret` directly, eliminating false assumptions from runtime `process.env` mutation after env singleton initialization.

---

## Code-To-Doc Drift Register

This section is intentionally separate from the architecture backlog. These are current implementation drifts that must be tracked as active remediation streams.

| Drift ID    | Current evidence                                                                                                                                                                  | Risk                                                                                                                    | Canonical remediation stream | Machine-enforced follow-through                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `DRIFT-001` | Middleware plus Tier 1 user/profile/compliance and professional-portal helper routes are remediated, but additional authenticated routes still log `userId` and/or `clerkId`      | Identity leakage into logs and observability backends                                                                   | `ADD-005`                    | lint rule plus CI audit script for banned log fields                   |
| `DRIFT-004` | Production now blocks same-origin/local delivery, supports S3, and blocks inline image processing at boot; dev/test inline upload processing remains an explicit allowlisted mode | deployment or config drift could reintroduce unsafe processing posture if the invariant or queue dependency is bypassed | `ADD-008`                    | production invariant test plus startup guard                           |
| `DRIFT-005` | `app/api/clerk-webhook/route.ts` now formalizes freshness, dedupe, duplicate acknowledgement, and fail-closed prod replay protection, but the pattern is still Clerk-specific     | duplicate event processing and callback abuse                                                                           | `ADD-004`                    | webhook replay tests and durable event-id store check                  |
| `DRIFT-006` | `app/lib/api/cors.ts` is now materially tighter, but policy is still helper-level and dev host allowlisting remains inline                                                        | cross-origin policy can still drift route-by-route without a canonical architecture rule                                | `GAP-002`                    | integration tests for helper adoption plus architecture checklist gate |

`DRIFT-006` is intentionally updated to reflect the current repo state. The shared helper now normalizes env-backed origins, sets `Vary`, returns `403` for disallowed preflights, and shortens preflight caching. The remaining gap is canonical policy plus full adoption and reviewability.

---

## Machine-Enforced Checks Required

The canonical remediation baseline requires machine-enforced checks wherever the repo can support them. Prose-only controls are not enough.

### Static checks and lint rules

| Check ID       | Rule                                                                                                                                    | Target                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `SEC-LINT-001` | Ban direct `process.env` outside approved bootstrap/config modules                                                                      | env-boundary enforcement        |
| `SEC-LINT-002` | Ban `.passthrough()` on mutation-body Zod schemas                                                                                       | mass-assignment prevention      |
| `SEC-LINT-003` | Flag `dangerouslySetInnerHTML` unless a sanitizer annotation and review note are present                                                | rendering safety                |
| `SEC-LINT-004` | Flag `apiError(error.message)`, fallback variants (`??`/`??`), and equivalent `createActionFailure(...)` pass-through patterns          | safe client error responses     |
| `SEC-LINT-005` | Flag server log payload keys such as `userId`, `clerkId`, `userEmail`, `phone`, `nationalId`, and similar identifiers                   | observability data minimization |
| `SEC-LINT-006` | Flag `req.json()` inside exported `GET` route handlers                                                                                  | HTTP method semantics           |
| `SEC-LINT-007` | Flag direct `localStorage`/`sessionStorage` writes in onboarding/profile/payment flows unless a persistence allowlist marker is present | browser-storage policy          |

### CI scripts and drift reports

| Check ID     | Requirement                                                                                             | Target                            |
| ------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `SEC-CI-001` | keep `pnpm audit` as a required gate and add triage SLA reporting                                       | dependency governance             |
| `SEC-CI-002` | add a repository drift report for unresolved direct `process.env` usage                                 | env-boundary remediation          |
| `SEC-CI-003` | add a repository drift report for banned log fields in server code                                      | logging remediation               |
| `SEC-CI-004` | add a repository drift report for same-origin upload defaults and local-provider production risk        | upload hardening                  |
| `SEC-CI-005` | add a repository drift report for `dangerouslySetInnerHTML` and storage persistence sites               | XSS and browser-storage hardening |
| `SEC-CI-006` | add a repository drift report for high-value mutations missing step-up and anti-automation guards       | Tier-3 mutation guardrails        |
| `SEC-CI-007` | add a repository drift report that enforces canonical server-side step ordering on critical transitions | Tier-3 transition sequencing      |

Implementation kickoff status (2026-03-31):

- `SEC-CI-002`, `SEC-CI-003`, and `SEC-CI-005` now have a repository-level report surface through `apps/client/scripts/report-security-drift.mjs` and the CI command `pnpm run client:report-security-drift`.
- The report is currently non-blocking and is used to quantify unresolved drift while Tier 1 closure work is actively in progress.

Implementation update (2026-04-04):

- `SEC-LINT-002`, `SEC-LINT-003`, `SEC-LINT-004`, `SEC-LINT-006`, and `SEC-LINT-007` are now machine-enforced in `apps/client/scripts/check-security-lint.mjs` and are part of the blocking `pnpm run check-security-drift` gate.
- The drift report now also covers `SEC-CI-004` upload production risk invariants (`uploadProductionRisk`) by checking for production local-provider and same-origin guard logic plus regression-test presence.
- The drift report now covers `ADD-009` server-action validation policy drift (`serverActionValidationPolicy`) by flagging Zod `.parse()` usage in `app/actions/**` and `safeParse()` flows that still throw `new Error(...)` in adapter-like action paths.
- Legacy read/action paths (`search`, `professionals`, `stores`) now map domain failures through structured action-failure helpers instead of raw `throw new Error(...)`, reducing regressions that bypass the policy contract.
- `IdempotencyService.complete()` now sanitizes replay payloads before persistence by redacting sensitive key families (for example tokens, secrets, identity contacts, and payment-linked identifiers), and `checkOrCreate()` now rotates expired records before replay so stale completed responses are not served.
- The drift report now also covers `SEC-CI-006` high-value mutation guardrails (`highValueServerActionGuards`) by asserting required `secureAction` options (`recentAuth`, `rateLimit`) on Tier-3 payout and verification-role-transition actions and by asserting route-level `withAuth.recentAuth` plus anti-automation enforcement on escrow mutation endpoints.
- The drift report now covers `SEC-CI-007` critical transition sequencing (`criticalTransitionStepSequencing`) by asserting canonical server-side step order for onboarding and verification-role transition actions plus verification adapters (`professional-portal/documents` and `professional-portal/licenses` mutations).
- CI now runs the drift report in strict mode via `pnpm run client:report-security-drift:strict` (`--fail-on-any`), making non-zero drift categories a blocking gate instead of visibility-only.

Implementation update (2026-04-08):

- Onboarding submit/skip routes and server actions now use a shared fail-closed Clerk transition finalizer, keep idempotent success completion strictly after Clerk metadata confirmation, and return retryable `503` responses when role/onboarding claim finalization cannot be confirmed.
- The onboarding client flow and `/auth-callback` now share a Clerk claim-refresh barrier (`getToken({ skipCache: true })` plus `user.reload()`) before any role-gated dashboard redirect, removing the previous silent dashboard fallback after onboarding success.
- `/api/uploads` is now worker-only in production; queue enqueue failure marks the pending upload failed and returns `503`, while `UPLOAD_PROCESS_INLINE` is limited to explicit dev/test usage through a production boot invariant.
- Remaining legacy safe-error drift in `idea-books`, `notifications`, `professional-portal/calendar`, `properties/shared`, and `actions/finance` now maps through fixed client-safe messages, and `SEC-LINT-004` blocks both direct and fallback-based `error.message` pass-through patterns.

Implementation update (2026-04-09):

- `IdempotencyService` now enforces a scope-aware replay policy registry instead of generic best-effort redaction. Unknown scopes fail closed, completed replay payloads must map to an explicitly registered public-contract surface, and default replay policy is limited to ADR-006 Class C and Class D data unless a scope has an explicit reviewed Class B exception.
- The focused Tier 2 verification baseline is now green with `report-security-drift:strict` at zero and the targeted `api-middleware`, `storage-config`, `add-009-server-action-validation-policy`, and `idempotency.service` suites passing together.

### Test requirements

| Check ID       | Requirement                                                                                                                                         | Target                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `SEC-TEST-001` | every resource-ID domain method gets a policy test proving non-owner access returns `not_found` unless the domain intentionally discloses existence | IDOR prevention             |
| `SEC-TEST-002` | mocked Clerk failures prove `withAuth` fails closed                                                                                                 | auth availability handling  |
| `SEC-TEST-003` | cookie-authenticated mutations reject cross-site requests through Origin validation                                                                 | CSRF                        |
| `SEC-TEST-004` | webhook replay and duplicate delivery tests prove idempotent behavior                                                                               | callback integrity          |
| `SEC-TEST-005` | sensitive/profile/compliance/download routes prove `Cache-Control: no-store, private`                                                               | anti-caching                |
| `SEC-TEST-006` | production storage config tests prove no same-origin public upload serving and no local provider in prod                                            | upload isolation            |
| `SEC-TEST-007` | critical flows with role changes prove Clerk metadata/session freshness before privileged response completion                                       | privilege transition safety |

---

## Prioritized Remediation Sequence

### Tier 0 - Make this document accurate before using it for sign-off

- Close `GAP-019` as a baseline control that already exists in CI.
- Reframe `GAP-018` as partial header coverage, not total absence.
- Reframe `GAP-002` as policy-hardening and adoption coverage, not helper absence.
- Correct browser-storage, CORS, and file-serving ASVS mappings.

### Tier 1 - Ship before escrow, payout, and identity-critical features expand

- `ADD-001` CSRF and same-origin mutation enforcement
- `ADD-002` anti-caching for authenticated and sensitive responses
- `ADD-004` webhook replay and duplicate suppression
- `ADD-005` PII logging remediation
- `ADD-008` production upload isolation and non-same-origin serving
- Current implementation note:
  Shared auth and secure-action CSRF checks, authenticated `no-store` headers, widened Tier 1 log-safety cleanup, no-store webhook responses, a real S3-backed production storage path, and worker-only production image processing are now implemented. Remaining Tier 1 closure work is architecture alignment, broader route-family log cleanup, and deployment-level verification.
- Implementation kickoff (2026-03-31):
  Tier 0 and Tier 1 execution started with repository-level security drift reporting in CI.
- Implementation update (2026-04-04):
  CI now runs `pnpm run client:report-security-drift:strict` (`--fail-on-any`) as a blocking gate, and the report includes upload-production-risk, server-action-validation-policy, and high-value-server-action-guard coverage in addition to env-boundary, log-safety, browser-persistence, rendering-sink, and mutation-surface drift checks.

### Tier 2 - Make the architecture durable

- `GAP-001` explicit trust boundaries
- `GAP-003` fail-closed auth resolution
- `GAP-008` mutation allowlisting
- `GAP-010` file-upload policy
- `GAP-011` safe error-message contract
- `ADD-003` browser-storage policy
- `ADD-006` env-boundary enforcement
- `ADD-007` idempotency replay data-class policy
- `ADD-009` server-action validation policy expansion
- Current implementation note:
  Tier 2 machine-enforced drift is now zero across env-boundary, browser-storage, server-action validation, unsafe client error, mutation passthrough, and related replay-policy categories. The remaining Tier 2 work is status accuracy and ongoing review discipline, not reopening already-green controls.

### Tier 3 - High-assurance financial and verification controls

- `GAP-004` step-up authentication
- `GAP-006` privilege-change session freshness
- `GAP-015` per-actor anti-automation for high-value flows
- `GAP-016` server-side step sequencing

---

## Canonical Document Placement

### Keep and amend

- `ADR-001-auth-model.md`
  - add session freshness and role-transition invalidation requirements
- `ADR-005-cannonical-observability-contract.md`
  - align the stated policy with the logging remediation stream
- `.agent/API-TO-FRONTEND-ARCHITECTURE.md`
  - add trust boundaries, CORS, CSRF, anti-caching, mass assignment, file uploads, callback integrity, and browser-storage allowlists
- `.github/copilot-instructions.md`
  - add fail-closed auth, cookie attribute governance, env-boundary expectations, and explicit logging prohibitions

### Add

- `ADR-006-data-classification.md`
  - include browser-storage eligibility and idempotency replay payload policy
- `ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
  - define canonical role model transitions, admin sub-role capability boundaries, and typed actor context expectations
- `ADR-008-http-surface-security.md`
  - consolidate CORS, CSRF, anti-caching, security headers, and webhook/callback integrity

### Update maintenance and CI guidance

- `.github/instructions/MAINTENANCE.md`
  - reflect that dependency audit is already present
  - add severity triage SLA
  - add scheduled audit expectation
  - add SBOM recommendation

---

## Closure Rule

An item in this document is not `Closed` until all of the following are true:

1. The architecture or ADR language is updated.
2. The runtime implementation matches that language.
3. The relevant tests or CI checks exist and pass.
4. Any drift reports for the affected control go to zero or have an approved exception record.

If one of those is missing, the item remains `Open`, `Strengthen`, or `Drift`.

---

## Staff-Level Recommendation

Do not use `docs/OWASP-ASVS-CLIENT-APP-AUDIT.md` as the remediation source-of-truth.

Use this document as the canonical remediation baseline instead:

1. It preserves the strongest findings from the submitted audit.
2. It corrects the false positives and ASVS control IDs.
3. It adds the repo-specific controls the original review underweighted.
4. It treats implementation drift as a tracked remediation program.
5. It requires machine-enforced checks wherever the repo can support them.

That is the right posture for a growing financial and identity-sensitive application.
