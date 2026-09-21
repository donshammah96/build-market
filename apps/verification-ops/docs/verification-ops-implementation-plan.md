# Implementation Plan — `apps/verification-ops` Hardening

## (supersedes the "Priority order for fixes" section of `verification-ops-staff-audit.md`)

This sequences every finding from the audit — plus the infrastructure/config gaps found while
building the fixes — into concrete, ordered steps. Each step names the actual file(s) to touch.

---

## Phase 0 — Infrastructure & config foundation

Do this first, even before the auth fix in Phase 1 — the auth fix and everything after it needs
a working env-validation module and a real build config to land safely, and right now this app
has neither.

### 0.1 Env validation (`apps/verification-ops/lib/infrastructure/env.ts` — new file)

**Finding:** this app currently has **no env validation at all**. `layout.tsx` calls
`ClerkProvider` directly and `auth.ts`/`page.tsx` call `@build/db`'s `prisma` client directly —
both read `process.env` raw, with no fail-fast check, no clear error message, and no parity with
the `ADR-004` convention `apps/client` already established ("all `process.env` reads ... MUST go
through this module").

Added: `verification-ops-env.ts` (see file), providing `clerk`, `database`, and `app` env groups
plus `validateEnv()`. **Deliberately excludes** a `nats` group — this app has no write path or
event-publishing yet, so requiring `NATS_URL` now would just make local setup harder for a
capability that doesn't exist. Add that group in the same PR that adds
`license.manual_decision_recorded` publishing (Phase 3+ below), not before.

**Also required:** call `validateEnv()` somewhere that actually runs at boot — add to
`instrumentation.ts` (create if it doesn't exist) or the top of `middleware.ts` (0.2), not buried
in a component that only renders on the happy path.

**Follow-up flagged, not blocking:** the validation engine itself (types, `validateEnv`,
`getStringEnv`/etc.) is a near-duplicate of `apps/client`'s. Fine for two apps; extract into
`@build/env-validation` before a third app needs the same pattern, so this doesn't become a third
copy that drifts the way `@build/verification-domain`'s types already drifted from the schema.

### 0.2 Edge middleware (`apps/verification-ops/middleware.ts` — new file)

**Finding (carried over from the audit, §1.5):** no edge-level route protection exists — the
only gate is the page-level `getVerificationUserContext()` call, which means every future route
needs someone to remember to add that check themselves.

Added: `verification-ops-middleware.ts` (see file) — a `clerkMiddleware()` that redirects any
unauthenticated request to `/sign-in` for every route except `/sign-in` itself. This is
explicitly **defense-in-depth**, not a replacement for the Phase 1 auth fix — it only guarantees
"no route in this app is reachable signed-out"; it does not know about roles, `isActive`, or
least-privilege, which is still `getVerificationUserContext()`'s job.

### 0.3 `next.config.ts` fixes

**Finding A:** `@build/enums` is a declared dependency in `package.json` but was missing from
`transpilePackages`. If it ships untranspiled TS source like the other `@build/*` packages, this
either breaks the build or works only by accident.

**Finding B:** zero security headers on an internal tool that handles license evidence and PII —
no `X-Frame-Options`, no `poweredByHeader: false`, nothing.

Fixed in `verification-ops-next.config.ts` (see file): added `@build/enums` to
`transpilePackages`, `poweredByHeader: false`, and a `headers()` block
(`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
a restrictive `Permissions-Policy`, and HSTS). **HSTS `includeSubDomains` needs sign-off from
whoever owns the domain** before this ships — flagged rather than silently enabled with
`preload`, which is hard to reverse.

### 0.4 `package.json` fixes (both packages)

**`apps/verification-ops`:** `"lint": "eslint . --cache"` is declared with **no eslint or eslint
config installed** — this script fails the moment anyone runs it. Patch adds `eslint` and
(placeholder pending confirmation of the actual internal package name) an
`@build/eslint-config`-style dependency, matching whatever `apps/admin` already uses. **Action
item:** confirm the real shared eslint config package name before merging this patch — I don't
have `apps/admin`'s `package.json` to confirm it.

**`@build/verification-domain`:** `main`/`types` point at `./dist/...` while `exports` points at
`./src/index.ts` — two different resolution strategies in one file (see audit §6). Since this
package is pure types with no runtime logic, patch switches it to source-first everywhere and
drops the `dist` build (keeps `tsc --noEmit` as a CI type-check gate instead of an emit step).

### 0.5 `tsconfig.json` fix (`@build/verification-domain`)

Follows directly from 0.4: with no `dist` build anymore, `declaration`/`declarationMap`/
`sourceMap`/`outDir`/`rootDir` are vestigial. Patch replaces them with `noEmit: true` and an
explicit `lib: ["ES2022"]` (this package has no DOM dependency and shouldn't silently inherit
`lib.dom.d.ts` from some ambient default).

**Verification-ops app's own `tsconfig.json`** needs no structural fix — it's a standard Next.js
config — but consider adding `noUncheckedIndexedAccess: true` as a hardening nice-to-have given
how many array/JSON-field accesses this domain involves (`confidenceReasons[i]`,
`evidence.normalizedRecord?.x`); not blocking, worth a follow-up ticket.

---

## Phase 1 — Access control (blocking; do not proceed past this without it)

1. Fix `getVerificationUserContext()` in `auth.ts`:
   - Return `null` when `!user.adminProfile` (currently falls through to a fake `"VIEWER"` role
     and grants `VERIFICATION_READ_ONLY` to any signed-in user — see audit §1.1).
   - Return `null` when `user.adminProfile.isActive === false` (currently never checked — see
     audit §1.2).
   - Replace the implicit fallthrough role mapping with an explicit allow-list keyed by
     `AdminRole`, denying (`null`) anything unmapped instead of defaulting to read access (audit
     §1.3).
   - Add an explicit `AUDITOR → VERIFICATION_COMPLIANCE_OFFICER`-equivalent mapping with read/
     export rights but no decision or four-eyes-approver rights (audit §1.4) — this likely needs
     a `canActAsApprover` capability split out from `canViewUnredactedEvidence` in
     `VerificationUserContext`, since today those two are bundled into one role.
2. Wire `middleware.ts` (Phase 0.2) in as the edge-level backstop for the above.
3. Add unit tests for the permission-mapping logic in `auth.ts` — this is the single
   highest-value place in this app to have tests, given it's the entire authorization surface.

---

## Phase 2 — Domain contract corrections

1. Fix `@build/verification-domain`'s `index.ts`:
   - `RecordManualDecisionCommand.outcome` → `"APPROVE" | "REJECT" | "REQUEST_MORE_INFO"`
     (matches `RegulatorVerificationDecisionOutcome`), add required `highRiskReview: boolean`.
   - `ManualDecisionRecordedEvent` → split `outcome` and `resultingCaseStatus` into separate
     fields rather than one conflated `decision` field (audit §2.2).
   - `VerificationCaseStatus` → add missing `PROCESSING`, `REGULATOR_UNAVAILABLE`,
     `LOW_CONFIDENCE` (audit §2.3).
2. Prisma migration (see `verification-ops-staff-audit.md` §5 for the full diff):
   - `RegulatorVerificationCase.confidenceAlgorithmVersion String?`
   - `RegulatorVerificationCase.confidenceBreakdown Json? @db.JsonB`
   - New `RegulatorVerificationEvidenceView` model (evidence-view audit trail)
   - `SystemSettings.verificationSlaHours Int @default(48)`
   - Compliance sign-off needed on the `ProfessionalLicense → Case → Decision` cascade-delete
     chain before this ships (audit §5 cascade note) — not a schema change per se, a policy
     decision that may become one (`onDelete: Restrict` + archival step).
3. Update `evidence-store.ts`'s `recordVerificationAttempt` to persist
   `confidenceAlgorithmVersion`/`confidenceBreakdown` once the columns exist.

---

## Phase 3 — Dashboard correctness

1. Route `page.tsx`'s case list through the service layer (`listVerificationCases` or an
   equivalent returning `VerificationOpsCaseDTO[]`) instead of a raw, unfiltered
   `prisma.regulatorVerificationCase.findMany` call (audit §3.4).
2. Fix the queue-tab `whereClause` mapping (audit §3.1–§3.3):
   - Include `LOW_CONFIDENCE` and `REGULATOR_UNAVAILABLE` in the default/"Pending" and
     SLA-breach queries — these are currently invisible in every tab.
   - "Escalated" → join `RegulatorVerificationDecision` for
     `highRiskReview: true AND isSecondApprover: false` with no subsequent matching decision,
     not a raw `status = NEEDS_MANUAL_REVIEW` filter.
   - Either drop "Automated Review" as a tab or repoint it at `PROCESSING`, since it currently
     duplicates "Verified".
   - Read the SLA threshold from `SystemSettings.verificationSlaHours` (Phase 2) instead of the
     hardcoded `48 * 60 * 60 * 1000`.
3. Validate `searchParams.authority` and `.page` with `zod` (already a listed dependency, unused)
   before building `whereClause` — invalid input currently throws an unhandled 500 (audit §3.5).
4. Add `id` as a secondary `orderBy` key for stable pagination (audit §3.6).

---

## Phase 4 — Governance-badge honesty

Either implement or visually mark as "Planned" each of: "Four-Eyes Mandatory" (true today at the
backend level, not yet enforced by any UI in this app), "EVIDENCE_VIEWED Active" (false — wire up
writes to the new `RegulatorVerificationEvidenceView` table from Phase 2 when
`getVerificationCaseDetail`-equivalent is called with evidence access), and "Export Ready" (false
— the `Download` button has no handler; either build the minimum export path or remove the
button/badge until it exists).

---

## Sequencing summary

| Phase                         | Blocking on                       | Why first/last                                                                                                   |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0 — Infra/config              | Nothing                           | Needed for safe local dev and CI before touching app logic; also the smallest, lowest-risk changes to land first |
| 1 — Access control            | Phase 0.1 (env), 0.2 (middleware) | Currently any signed-in user can reach this app — nothing else matters until this is closed                      |
| 2 — Domain contracts + schema | Phase 1                           | Decision-recording UI (not yet built) would be built against wrong types without this                            |
| 3 — Dashboard correctness     | Phase 2 (SLA setting, DTO)        | Depends on the schema fields and correct types existing first                                                    |
| 4 — Governance honesty        | Phase 2 (evidence-view table)     | Needs the audit table to exist before the badge can become true                                                  |
