# Staff-Level Audit — `apps/verification-ops` & `@build/verification-domain`

**Scope:** `package.json` / `tsconfig.json` / `next.config.ts` / `layout.tsx` / `page.tsx` / `auth.ts`
(verification-ops app), `package.json` / `tsconfig.json` / `index.ts` (`@build/verification-domain`),
cross-checked against the actual `schema.prisma` (not assumed from the Phase 8 doc).

This audit is organized by severity, not by file, because the most important findings cut across
files (a type in the domain package that doesn't match the real Prisma enum; an auth function
that doesn't check a real column that exists in the schema). Each finding says what's wrong, why
it matters, and what to do — schema changes are called out explicitly and gathered into one
migration proposal at the end.

---

## 🔴 Critical — Access control is default-allow, not default-deny

This is the top-priority fix. Everything else in this doc is secondary until this is closed,
because right now the app grants verification access to people who should have none at all.

### 1.1 Any authenticated `User` gets `VERIFICATION_READ_ONLY` — not just admins

```typescript
// auth.ts
const adminRole = user.adminProfile?.role ?? "VIEWER";
let verificationRole: VerificationRolePermission = "VERIFICATION_READ_ONLY";
if (adminRole === "SUPER_ADMIN") { ... }
// ... no branch matches "VIEWER", so it silently falls through to READ_ONLY
```

If `user.adminProfile` is `null` — i.e. the signed-in person is a **client or professional**,
not an admin at all — this function still returns a valid `VerificationUserContext` with
`verificationRole: "VERIFICATION_READ_ONLY"`. `getVerificationUserContext()` should return `null`
(deny) for anyone without an `AdminProfile`, full stop. Compare this against
`page.tsx`'s handling — `redirect("/sign-in")` only fires when `userContext` is `null`, so this
bug means **any logged-in marketplace user who reaches this app's URL gets into the dashboard**,
sees the case queues, authority names, license numbers, and (partial) professional IDs.

**Fix:**

```typescript
if (!user.adminProfile) {
  return null; // no admin profile at all => no verification access, period
}
```

### 1.2 `AdminProfile.isActive` is never checked

The schema has `AdminProfile.isActive Boolean @default(true)` specifically to support
deactivating an admin's access without deleting their history — and `auth.ts` never reads it.
An offboarded staff member (or one suspended pending an investigation) keeps full role-based
verification access indefinitely, including — if they were `SUPER_ADMIN` — unredacted evidence
access and export rights.

**Fix:** treat `isActive: false` the same as "no admin profile" — deny outright:

```typescript
if (!user.adminProfile || !user.adminProfile.isActive) {
  return null;
}
```

### 1.3 Least privilege isn't actually applied across unrelated admin roles

Every `AdminRole` that isn't explicitly matched (`CONTENT_MODERATOR`, `SUPPORT_AGENT`,
`FINANCE_MANAGER`) falls through to `VERIFICATION_READ_ONLY` by default. These roles have no
legitimate reason to see regulator verification cases — a finance manager processing refunds
doesn't need visibility into license evidence. "Default read access for any admin" is the wrong
posture for a compliance surface; it should be **default-deny, explicit-grant**.

**Fix:** invert the logic to an explicit allow-list, deny everything else:

```typescript
const ROLE_MAP: Partial<Record<AdminRole, VerificationRolePermission>> = {
  SUPER_ADMIN: "VERIFICATION_COMPLIANCE_OFFICER",
  OPS_ADMIN: "VERIFICATION_SENIOR_REVIEWER",
  VERIFICATION_ADMIN: "VERIFICATION_REVIEWER",
  AUDITOR: "VERIFICATION_COMPLIANCE_OFFICER", // read + export, no decision rights — see 1.4
};

const verificationRole = ROLE_MAP[adminRole];
if (!verificationRole) {
  return null; // CONTENT_MODERATOR, SUPPORT_AGENT, FINANCE_MANAGER, or anything unmapped => no access
}
```

### 1.4 `AUDITOR` isn't mapped at all — and probably needs the opposite of what falling-through gives it

The schema's own comment on `AuditorRole` is explicit: `AUDITOR // Read-only access for KRA/
compliance checks`. Under the current logic it falls through to plain `VERIFICATION_READ_ONLY`,
which — per `canViewUnredactedEvidence`/`canExportPackets` — **denies** it unredacted evidence
and decision-packet export. That's very likely backwards for a KRA/compliance audit role: they
need to _see_ full evidence and _export_ packets, but should **not** be able to record decisions
or act as a four-eyes approver. This needs a fifth permission tier, not a reuse of an existing
one — `VERIFICATION_COMPLIANCE_OFFICER` today implies both "sees everything" and "is a valid
senior approver," which conflates two different concerns (evidence access vs. decision
authority). Recommend splitting:

- Add a `canActAsApprover` capability distinct from `canViewUnredactedEvidence`, so `AUDITOR` can
  get full read/export without being eligible as a four-eyes second approver.

### 1.5 No edge-level route protection — the page-level check is the only gate

Nothing here shows a `middleware.ts`. Relying solely on `getVerificationUserContext()` inside the
page component means every new route added later needs someone to remember to call it — there's
no structural backstop. Add a Clerk `clerkMiddleware()` at the app root that at minimum requires
an authenticated session before any route in this app resolves, as defense-in-depth on top of
(not instead of) the fixes above.

---

## 🟠 High — Domain contracts don't match the real schema

These are correctness bugs, not just style: code written against `@build/verification-domain`'s
types will not actually align with what `RegulatorVerificationCase`/`Decision` can store or what
the Prisma enums allow.

### 2.1 `RecordManualDecisionCommand.outcome` uses the wrong enum entirely

```typescript
// index.ts (@build/verification-domain)
export type RecordManualDecisionCommand = {
  ...
  outcome: "MANUALLY_VERIFIED" | "MANUALLY_REJECTED" | "NEEDS_CORRECTION";
  ...
};
```

Checked against the schema:

- The actual decision outcome enum is `RegulatorVerificationDecisionOutcome { APPROVE, REJECT,
REQUEST_MORE_INFO }` — a _verb_ (what the operator decided), not a _resulting status_.
- `MANUALLY_VERIFIED` / `MANUALLY_REJECTED` are `RegulatorVerificationCaseStatus` values — the
  _case's resulting state_, derived from an outcome, not the outcome itself.
- `NEEDS_CORRECTION` is neither of those — it's a `VerificationStatus` value that lives on
  **`ProfessionalLicense.status`**, a third, unrelated model.

This command type has silently merged three different enums from three different models into
one incorrect union. Any code written against this type will not compile against the real
`recordManualDecision(db, params: RecordManualDecisionParams)` signature, whose `outcome` field
is typed as `RegulatorVerificationDecisionOutcome`.

**Fix:**

```typescript
export type RecordManualDecisionCommand = {
  caseId: string;
  adminId: string;
  adminRole: string;
  outcome: "APPROVE" | "REJECT" | "REQUEST_MORE_INFO"; // matches RegulatorVerificationDecisionOutcome
  reasonCode: VerificationReasonCode | string;
  notes?: string;
  highRiskReview: boolean; // required — recordManualDecision has no default for this, it's how four-eyes gets triggered at all
  requestId?: string;
  ipAddress?: string;
};
```

Note `highRiskReview` was missing from the command entirely — without it, nothing in the new app
could ever trigger the four-eyes flow, since `recordManualDecision`'s `isSecondApprover`
computation depends on it being passed explicitly per call, not inferred.

### 2.2 `ManualDecisionRecordedEvent.decision` has the same problem

```typescript
decision: "MANUALLY_VERIFIED" | "MANUALLY_REJECTED" | "NEEDS_CORRECTION";
```

Same fix — this should carry the actual `RegulatorVerificationDecisionOutcome` value. If
downstream consumers (e.g. applicant notification) need to know the _resulting case status_ too
(since `REQUEST_MORE_INFO` doesn't map 1:1 to a final status, and a high-risk `APPROVE` might
still leave the case `NEEDS_MANUAL_REVIEW` pending a second approver), publish both fields
explicitly rather than conflating them:

```typescript
export type ManualDecisionRecordedEvent = {
  subject: "license.manual_decision_recorded";
  msgId: string;
  caseId: string;
  licenseId: string;
  professionalId: string;
  authority: VerificationStatutoryAuthority;
  licenseNumber: string;
  outcome: "APPROVE" | "REJECT" | "REQUEST_MORE_INFO";
  resultingCaseStatus: VerificationCaseStatus; // may be unchanged if requiresSecondApprover
  requiresSecondApprover: boolean;
  reasonCode: string;
  operatorId: string;
  timestamp: string;
};
```

### 2.3 `VerificationCaseStatus` is missing three real enum values

```typescript
export type VerificationCaseStatus =
  | "QUEUED"
  | "AUTO_VERIFIED"
  | "AUTO_REJECTED"
  | "NEEDS_MANUAL_REVIEW"
  | "MANUALLY_VERIFIED"
  | "MANUALLY_REJECTED"
  | "DEAD_LETTER";
```

The real `RegulatorVerificationCaseStatus` enum also has `PROCESSING`, `REGULATOR_UNAVAILABLE`,
and `LOW_CONFIDENCE`. A type missing three legitimate runtime values isn't just incomplete — it's
actively unsound: any exhaustive `switch` over this type in the UI will compile cleanly while
silently mishandling three states a real case can actually be in (this is exactly what happened
in `page.tsx` — see §3.1).

**Fix:** add all three values so the type actually matches the enum it's meant to mirror. Longer
term, consider generating this type from the Prisma schema (`prisma-generator` or a small
codegen script) rather than hand-maintaining a parallel copy — this drift is exactly the failure
mode hand-copied enums produce.

### 2.4 DTO fields with no backing column: `confidenceAlgorithmVersion`, `confidenceBreakdown`

`VerificationOpsCaseDTO` requires `confidenceAlgorithmVersion: string` and optionally
`confidenceBreakdown?: ConfidenceBreakdownEntry[]`. Neither has a column on
`RegulatorVerificationCase` today — only `confidence Float?` and `confidenceReasons Json?`
exist. This isn't wrong to want (it's exactly what the confidence-scoring rework needs to persist
for audit purposes), but the DTO is currently promising data that doesn't exist. See the schema
migration in §5.

---

## 🟡 Medium — `page.tsx` queue logic has real correctness bugs

Verified by walking each tab's `whereClause` against all nine actual `RegulatorVerificationCaseStatus`
values.

### 3.1 Two pairs of tabs silently show overlapping/duplicate data

- **"Escalated"** and **"Needs Changes"** both resolve to `status: "NEEDS_MANUAL_REVIEW"` — they
  render the identical result set. "Escalated" should mean _this case already has a first
  high-risk decision recorded and is waiting on a second, different approver_ — i.e. a case with
  a `RegulatorVerificationDecision` row where `highRiskReview: true AND isSecondApprover: false`
  and no subsequent matching-outcome decision from a different admin. That requires a join/
  subquery against `RegulatorVerificationDecision`, not a case-status filter.
- **"Automated Review"** and **"Verified"** both resolve to (subsets including)
  `status: "AUTO_VERIFIED"` — same overlap problem. "Automated Review" as a concept is likely not
  a real operator-facing queue at all (auto-verification is sub-second; there's nothing to
  triage) — recommend dropping this tab, or if it's meant to show _cases currently being scored_,
  filter on `PROCESSING` instead.

### 3.2 `LOW_CONFIDENCE` and `REGULATOR_UNAVAILABLE` appear in **no tab at all**

This is the most operationally serious bug here. Walk all seven tabs' `whereClause.status`
values — none of them include `LOW_CONFIDENCE` or `REGULATOR_UNAVAILABLE`. Any case sitting in
either of those states is **invisible in this dashboard**, in every tab, permanently (until it's
somehow transitioned out by a mechanism not shown here). These are exactly the states the
existing runbook's "Manual review backlog" alert is about — the dashboard meant to surface that
backlog doesn't actually show two of the four states that backlog alert cares about.

**Fix:** "Pending" (or a renamed "Needs Manual Review" tab) should include
`{ in: ["QUEUED", "PROCESSING", "NEEDS_MANUAL_REVIEW", "LOW_CONFIDENCE", "REGULATOR_UNAVAILABLE"] }`
at minimum, and the SLA-breach filter (§3.3) needs the same correction.

### 3.3 SLA-breach filter inherits the same blind spot, and the threshold is hardcoded

```typescript
const slaThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
...
whereClause.status = { in: ["QUEUED", "NEEDS_MANUAL_REVIEW"] };
```

Same missing-states problem as §3.2, plus `48` hours is a magic number baked into the page
component. This should read from `SystemSettings` (see §5) so ops can tune it without a
deploy, and it should match whatever the runbook's actual alert threshold is — right now there's
no way to know if these two "48 hours" (the alert config and this page) are even the same number.

### 3.4 The page bypasses both the service layer and the domain DTO entirely

`page.tsx` calls `prisma.regulatorVerificationCase.findMany` directly, with no `select` (pulling
full `evidence`/`confidenceReasons` JSON blobs for a list view, against the documented intent in
`operator-service.ts` that the triage list "stays cheap"), and maps raw Prisma fields
(`item.professionalId`, `item.createdAt`) instead of the `VerificationOpsCaseDTO` shape the
domain package defines (`professionalName`, `submittedAt`, `confidenceAlgorithmVersion`,
`confidenceBreakdown` — none of which appear in the rendered table). Two consequences:

- The nicely-designed shared domain package is currently decorative — nothing in this app
  actually produces or consumes a `VerificationOpsCaseDTO`.
- No role-based redaction is applied at all (`userContext.verificationRole` is read for the
  export-button gate, but never passed into the query or into any evidence-redaction call) —
  even though this page doesn't render evidence today, the query itself pulls it unfiltered,
  which is the kind of thing that gets copy-pasted into a future page that _does_ render it,
  without anyone re-adding the redaction step.

**Fix:** route this list through `listVerificationCases`/an equivalent that returns
`VerificationOpsCaseDTO[]`, with `select` scoped to list-view fields, and thread
`userContext.verificationRole` through so the query (or the mapping to DTO) can apply redaction
consistently in one place, not per-caller.

### 3.5 Unvalidated query params — `authority`, `page`

- `params.authority` is passed straight into `whereClause.authority` with no check against
  `LicenseAuthority`'s actual values — an invalid value throws an unhandled Prisma error (500),
  not a friendly validation message. `zod` is already a listed dependency of this app and unused
  for this.
- `parseInt(params.page || "1", 10)` on a non-numeric string produces `NaN`, which flows into
  `skip: NaN` and throws at the Prisma layer.

**Fix:** validate both with a small `zod` schema before building `whereClause`, defaulting/
clamping on failure instead of letting Prisma throw.

### 3.6 No pagination tiebreaker

`orderBy: { createdAt: "asc" }` alone can skip or duplicate rows across pages when multiple cases
share a timestamp (plausible during a bulk-onboarding wave). Add `id` as a secondary sort key:
`orderBy: [{ createdAt: "asc" }, { id: "asc" }]`.

---

## 🟡 Medium — Governance claims aren't backed by working code yet

The dashboard's metric cards assert **"Four-Eyes Mandatory,"** **"EVIDENCE_VIEWED Active,"** and
**"Export Ready"** as static badges. Checked against the actual code in this change set:

- No decision-recording UI/route exists yet (consistent with "read-only during shadow mode" —
  fine for now), so "Four-Eyes Mandatory" describes a capability of the _backend_
  (`recordManualDecision`), not anything this app currently enforces.
- No `EVIDENCE_VIEWED` audit event is ever written anywhere in this code — the type exists in
  the domain package, nothing calls it.
- The export `<Download>` button has no `onClick`/handler — "Export Ready" is not true.

This isn't a huge technical risk by itself, but it's a real one for a compliance product
specifically: a reviewer or auditor reading this dashboard has no way to tell that these badges
are describing intended, not implemented, behavior. Recommend either wiring the minimum real
implementation behind each badge before shipping (evidence-view logging is cheap — see §5), or
visually marking unimplemented items as "Planned" until they're real.

---

## 🟢 Low — Packaging inconsistency

`@build/verification-domain`'s `package.json` has conflicting resolution strategies:

```jsonc
"main": "./dist/index.js",       // points at built output
"types": "./dist/index.d.ts",    // points at built output
"exports": {
  ".": { "types": "./src/index.ts", "default": "./src/index.ts" } // points at raw TS source
}
```

Modern resolvers (bundlers, Node ESM) prefer `exports` over `main`/`types`, so in practice
consumers get raw TypeScript source via `default`, while `main`/`types` describe a `dist/` build
that `exports` never actually routes to. This works today because `next.config.ts` lists this
package in `transpilePackages`, so Next.js compiles the source directly — but it's inconsistent
for any future consumer that isn't Next.js/webpack-based (a plain Node script, a different
build tool). Pick one strategy: if source-first + `transpilePackages` is the intended pattern
(matching how other `@build/*` packages in this monorepo likely work), drop the vestigial
`dist`-pointing `main`/`types`/`build` script, or keep them but make `exports` route to `dist`
too and rely on each consumer app declaring `transpilePackages`/its own build step consistently.

---

## Schema changes (proposed migration)

```prisma
model RegulatorVerificationCase {
  // ...existing fields...

  // NEW: persist which confidence-scoring algorithm version produced this
  // row's confidence/status, so a later algorithm change doesn't make
  // historical AUTO_VERIFIED decisions uninterpretable.
  confidenceAlgorithmVersion String?

  // NEW: structured per-rule scoring detail (weight/fraction/contribution/
  // reason per rule) for the operator UI and for auditing individual
  // AUTO_VERIFIED decisions - confidenceReasons alone (string[]) doesn't
  // carry enough detail to reconstruct why a score landed where it did.
  confidenceBreakdown Json? @db.JsonB
}

// NEW: dedicated, append-only audit trail for evidence *views*, not just
// decisions. ProfessionalLicense.accessLog (Json?) already exists for a
// similar purpose but is a mutable JSON blob on a single row - not
// queryable/joinable for compliance reporting and not enforceably
// append-only. This gives evidence-view auditing the same durability and
// query-ability RegulatorVerificationDecision already gives decisions.
model RegulatorVerificationEvidenceView {
  id     String                    @id @default(uuid())
  caseId String
  case   RegulatorVerificationCase @relation(fields: [caseId], references: [id], onDelete: Restrict)

  viewerId   String
  viewer     User   @relation("RegulatorVerificationEvidenceViewer", fields: [viewerId], references: [id])
  viewerRole String // snapshot, matches AdminAuditLog convention
  unredacted Boolean // true if this view included evidence.rawRecord

  createdAt DateTime @default(now())

  @@index([caseId, createdAt])
  @@index([viewerId, createdAt])
}

model SystemSettings {
  // ...existing fields...

  // NEW: operator SLA threshold for the manual-review backlog, currently
  // hardcoded as 48h inside apps/verification-ops/page.tsx.
  verificationSlaHours Int @default(48)
}
```

**Cascade-delete note (flag for compliance sign-off, not a code change here):**
`ProfessionalLicense --Cascade--> RegulatorVerificationCase --Cascade--> RegulatorVerificationDecision`
means a hard delete of a license destroys its entire verification case _and_ its immutable
decision/audit trail in one cascade. `AdminAuditLog` mirrors decisions separately and wouldn't be
deleted, but the richer, structured `RegulatorVerificationDecision` rows (queryable `outcome`,
`reasonCode`, `highRiskReview`, `isSecondApprover`) would be. If licenses are ever hard-deleted
(vs. soft-deleted) — e.g. as part of a GDPR/Kenya DPA erasure request — this needs an explicit
policy decision: archive the decision trail before delete, change the relation to
`onDelete: Restrict` and require an explicit archival step first, or confirm this is acceptable
and document why. Recommend against silently allowing cascade to take this data out under a
routine delete path.

---

## Priority order for fixes

1. **Auth default-deny** (§1.1–1.4) — do not deploy this app further until this is fixed; it's
   currently accessible to any authenticated user, not just admins.
2. **Domain contract corrections** (§2.1–2.3) — fix before any decision-recording UI is built on
   top of these types, since code written against the current types won't match the real schema.
3. **Dashboard blind spots** (§3.2, §3.1) — `LOW_CONFIDENCE`/`REGULATOR_UNAVAILABLE` cases must
   become visible before this replaces any part of the manual-review workflow operators rely on.
4. Schema migration (§5) — needed to support #2 and the evidence-view audit requirement from the
   Phase 8 guideline.
5. Remaining query hardening, packaging cleanup, and governance-badge honesty (§3.3–3.6, §4, §6)
   — real, but lower urgency than the above.
