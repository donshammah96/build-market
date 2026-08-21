# Staff-Level Audit — `apps/verification-ops` (Full App Shell)

**Scope:** `env.ts`, `auth.ts`, `page.tsx`, `globals.css`, `layout.tsx`, `loading.tsx`,
`not-found.tsx`, `error.tsx`, `global-error.tsx`, `setup.ts`, `auth.test.ts`, `README.md`,
`package.json`, `instrumentation.ts`, `middleware.ts`, `@build/verification-domain/index.ts`,
`.env.example`.

**Context:** this is a re-audit. Most findings from the two previous rounds (default-allow auth,
missing edge middleware, `LOW_CONFIDENCE`/`REGULATOR_UNAVAILABLE` invisible in every queue,
missing env validation) are **confirmed fixed** in this batch — noted inline as resolved rather
than re-litigated. This pass focuses on what's still wrong or newly introduced, and on the
explicit ask: functionality, styling (modern but lightweight), and production readiness.

---

## ✅ Confirmed fixed since the last audit (no action needed)

- `auth.ts` — default-deny is correct now: no `AdminProfile` → `null`, `isActive: false` → `null`,
  unmapped roles → `null`. Explicit allow-list, not a fallthrough.
- `page.tsx` — `LOW_CONFIDENCE`/`REGULATOR_UNAVAILABLE` are now included in `PENDING_STATES` and
  visible in the default and SLA-breach queues. `zod`-validated search params. Stable
  `orderBy: [{ createdAt }, { id }]` pagination tiebreaker. `select` scoped to list-view fields
  (no more unfiltered `evidence` blob pulled into a list query).
- `middleware.ts`, `instrumentation.ts` — edge gate and fail-fast env validation both exist and
  are wired correctly.
- `@build/verification-domain` — `VerificationCaseStatus` now includes `PROCESSING`,
  `REGULATOR_UNAVAILABLE`, `LOW_CONFIDENCE`. `RecordManualDecisionCommand.outcome` now correctly
  uses `APPROVE | REJECT | REQUEST_MORE_INFO`. `ManualDecisionRecordedEvent` now separates
  `outcome` from `resultingCaseStatus` instead of conflating them.
- `package.json` — `eslint` + `@build/eslint-config` present (lint script now has tooling to run).
- `.env.example` — checked against `env.ts` directly; no drift, accurate.

---

## 🔴 Critical / High — Functionality

### 1. The domain package's `VerificationOpsCaseDTO` is still completely unused

`page.tsx` still builds its own ad hoc row shape from a raw `select`, rather than producing (or
consuming) a `VerificationOpsCaseDTO`. Concretely, this means:

- `professionalName` — never resolved. The table still shows
  `{item.professionalId.substring(0, 12)}...`, a truncated opaque ID, not a name. This is a real
  operator-usability gap (reviewers triage by _who_, not by UUID prefix) and it's already modeled
  in the DTO — it's just not joined/populated anywhere.
- `confidenceScore`, `confidenceAlgorithmVersion`, `confidenceBreakdown` — none surfaced in the UI
  at all, despite being exactly what an operator needs to understand _why_ a case landed where it
  did. The confidence-scoring work from earlier in this project produces this data; it's currently
  invisible to the people making decisions.
- `slaDueDate` / `isSlaBreached` — recomputed ad hoc in `page.tsx` (`item.createdAt < slaThreshold`)
  instead of using the DTO's precomputed fields, meaning the "what counts as breached" logic now
  exists in two places that can drift.

**Fix:** add a mapping function (in `operator-service.ts` or a new `verification-ops` data-access
module) that queries `RegulatorVerificationCase` joined to the professional's name and produces
`VerificationOpsCaseDTO[]`, and have `page.tsx` consume that instead of hand-rolling a query. This
was flagged in the prior audit and remains the single largest gap between "what the domain package
promises" and "what the UI actually does."

### 2. Queue tabs still have unresolved overlap from the previous audit

- **"Automated Review"** (`status IN (AUTO_VERIFIED, PROCESSING)`) and **"Verified"**
  (`status IN (AUTO_VERIFIED, MANUALLY_VERIFIED)`) both include `AUTO_VERIFIED` — a case that
  auto-verified appears in both tabs simultaneously. This exact overlap was flagged before and
  is still present; only the `LOW_CONFIDENCE`/`REGULATOR_UNAVAILABLE` visibility bug from that
  round was fixed, not this one.
  **Fix:** "Automated Review" should mean _in-flight_, not _completed_ — filter on `PROCESSING`
  only (or `QUEUED + PROCESSING`), and let "Verified" own `AUTO_VERIFIED`/`MANUALLY_VERIFIED`
  exclusively.
- **"Needs Changes"** (`status = NEEDS_MANUAL_REVIEW`) is now a strict subset of the default
  **"Pending"** queue (`PENDING_STATES` includes `NEEDS_MANUAL_REVIEW`), and **"Escalated"** is in
  turn a subset of "Needs Changes" (same status plus an open four-eyes decision). A single case
  can legitimately appear in three tabs at once. That's not necessarily wrong for filtered views,
  but it wasn't a deliberate design choice — it's what fell out of not making the filters mutually
  exclusive. **Recommend:** either document this overlap explicitly as intentional (a case is
  "pending" until it isn't, and "escalated"/"needs changes" are narrower lenses on the same pool),
  or make "Pending" exclude anything already claimed by a more specific tab
  (`NEEDS_MANUAL_REVIEW` minus escalated minus needs-changes) so each case has one home. Given this
  is a compliance tool, an explicit choice beats an accidental one — flag for product sign-off.
- **"Needs Changes" still doesn't mean what its label and the original design doc said it should.**
  Per the Phase 8 guideline, "needs changes" was meant to reflect `ProfessionalLicense.status =
NEEDS_CORRECTION` (a License-level concept), not `RegulatorVerificationCase.status =
NEEDS_MANUAL_REVIEW` (a Case-level one). The current tab is really just a re-filtered view of
  manual review, mislabeled. Either rename the tab to match what it actually shows, or implement
  the join it was originally meant to represent.

### 3. No pagination controls in the UI

`page` is read from `searchParams`, used in the Prisma query, and displayed as read-only text
("Page {page}") — but there is no Next/Previous link or page-number control anywhere in the
rendered output. An operator can only reach page 2 by manually editing the URL. For a queue that
could realistically exceed 20 items (the entire point of having pagination), this is a functional
gap, not a nice-to-have.

### 4. No authority filter control in the UI

`currentAuthority` is read from `searchParams`, applied to the query, and preserved across tab
navigation — but nothing in the rendered JSX lets an operator actually set it. The filter exists
in the data layer with no way to invoke it except hand-editing the URL query string.

### 5. Tab navigation uses plain `<a href>`, not `next/link`

Every queue tab and the "Go to Operations Dashboard" / "Sign In" links in `not-found.tsx` use raw
`<a>` tags. In a Next.js App Router app, this forces a full page reload (and a full re-fetch of
`layout.tsx`'s `ClerkProvider`, fonts, etc.) on every tab click, instead of a client-side
transition. For a dashboard an operator will click through repeatedly during a shift, this is a
real, avoidable performance/UX cost. Swap for `next/link`'s `<Link>`.

---

## 🟠 High — Governance-badge honesty (partially, not fully, addressed)

The previous audit flagged three dashboard badges as asserting capabilities nothing in the code
implements. Status now:

- **"Four-Eyes Mandatory"** — still nothing in this file set implements a decision-recording path
  at all (no write route, no form, no server action). The claim remains aspirational. Unchanged.
- **"Evidence Audit"** — the label softened from the previous "EVIDENCE_VIEWED Active" to
  "Append-Only Audit Log," which is less specifically false but still implies something is being
  logged. `EvidenceViewedAuditEvent` still exists only as a type in the domain package; nothing
  calls it, and no evidence-view route exists in this file set at all (the dashboard doesn't even
  render evidence yet, so there's nothing to log a view _of_ — this badge is describing a future
  capability, not a current one). **Recommend:** mark it "Planned" or remove until the
  `RegulatorVerificationEvidenceView` write path exists.
- **"Decision Packets"** — this one is now honest for people _without_ `canExportPackets`
  ("Restricted" instead of a blanket claim), which is a real, correct improvement. It's still not
  honest for people _with_ the permission — "Export Ready" is shown, but the `Download` button has
  no `onClick`/handler, so nothing actually exports. Partial fix; finish it by either wiring a
  minimal export handler or also softening this label until one exists.

---

## 🟡 Medium — Styling: two verifiable Tailwind bugs, and a half-built design-token system

The ask was "modern but lightweight" — the current approach (plain Tailwind utilities, no heavy
component library, `lucide-react` for icons only) is already the right lightweight choice. The
issues below are correctness and consistency problems within that approach, not a case for adding
weight.

### 6. `bg-zinc-850` and `hover:bg-zinc-750` are not real Tailwind classes

Tailwind's default `zinc` scale is `50, 100, 200, ..., 900, 950` — there is no `750` or `850`
shade out of the box. Every use of these classes generates **no utility at all** (Tailwind won't
guess an interpolated shade without arbitrary-value syntax), so the element silently falls back to
transparent/inherited background instead of the intended slightly-lighter panel color. This
appears in:

- `page.tsx` — queue tabs bar (`bg-zinc-850`), table header (`bg-zinc-850`), table row hover
  (`hover:bg-zinc-750`)
- `not-found.tsx` — "Sign In / Switch Account" button hover (`hover:bg-zinc-750`)
- `error.tsx` / `global-error.tsx` — same hover class on their secondary buttons

**Fix, two options:**

- Simplest: swap to real shades — `bg-zinc-850` → `bg-zinc-900` (or `bg-zinc-800/80` for a subtler
  step between 800 and 900), `hover:bg-zinc-750` → `hover:bg-zinc-700`.
- Better for a design system that clearly wants finer steps than the default scale offers: define
  `850`/`750` explicitly in `tailwind.config` (`theme.extend.colors.zinc['850']`, etc.) so the
  intent (a half-step panel color) is preserved and reusable, rather than papering over it with the
  nearest default shade everywhere. **I don't have `tailwind.config` in this file set — confirm
  whether one already defines these before picking an approach**, since if it does, this may not
  be a bug at all and this finding should be disregarded.

### 7. `globals.css`'s CSS custom properties are defined but never consumed

```css
:root {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 142.1 76.2% 36.3%;
  --primary-foreground: 355.7 100% 97.3%;
}
```

This is the standard shadcn/ui HSL-triplet token convention — but nothing in `layout.tsx`,
`page.tsx`, or any other file uses `bg-background`/`text-foreground`/`bg-primary`-style semantic
classes. Every component uses raw `zinc-*`/`emerald-*` utilities directly instead. Right now this
is dead CSS with no consumer, and it signals an unfinished migration (either toward or away from a
token-based system). **Recommend:** pick one:

- Wire these into `tailwind.config`'s `theme.extend.colors` (`background: 'hsl(var(--background))'`,
  etc.) and actually use the semantic classes throughout, which is what makes a future theme change
  (e.g. adding a light mode, or adjusting the brand green) a one-file edit instead of a grep-and-
  replace across every component; or
- Remove the unused custom properties from `globals.css` entirely if the team intends to keep using
  raw Tailwind palette classes directly, so a future reader doesn't waste time trying to find where
  `--primary` is consumed.
  Given "modern but lightweight," wiring the tokens through is the lower-cost, higher-leverage
  option — it's a `tailwind.config` change, not a new dependency, and it's what unlocks consistent
  theming later without a rewrite.

### 8. Dark-only theme is a reasonable choice, but should be documented as deliberate

Every screen is hardcoded `bg-zinc-900`/`text-zinc-100` with no `prefers-color-scheme` handling and
no light variant. For an internal ops tool this is a defensible, common choice (reduces scope, most
admin/ops tools go dark-only) — but as written it reads as "we only styled the one mode we
personally use" rather than "we decided this is dark-mode-only." A one-line comment in
`globals.css` making that explicit costs nothing and prevents a future contributor from assuming
light-mode support was simply forgotten.

### 9. Table has no horizontal-scroll wrapper — will break on narrow viewports

The queue-tabs bar has `overflow-x-auto`, but the case table itself doesn't. Seven columns
(`Authority`, `License No.`, `Professional ID`, `Status`, `Submitted`, `SLA Status`, `Actions`) at
this padding will overflow badly below ~768px with no way to scroll to see the rest, since the
parent container has no `overflow-x-auto`/`overflow-x-scroll`. **Fix:** wrap the `<table>` in a
`<div className="overflow-x-auto">`.

### 10. Minor accessibility gaps

- The export `<button>` relies on `title="Export Decision Packet"` alone — `title` tooltips aren't
  reliably announced by screen readers. Add `aria-label="Export Decision Packet"` alongside it, and
  add `type="button"` explicitly (defensive — prevents accidental form-submit behavior if this ever
  ends up inside a `<form>` once the decision-recording UI is built).
- The table has no `<caption>` (visually-hidden is fine) describing what it is, useful for screen
  reader users navigating by table landmarks.
- Status badges (`<span>{item.status}</span>`) convey meaning by text alone, which is actually
  good for accessibility — but they're all the same gray regardless of status severity
  (`AUTO_REJECTED` and `AUTO_VERIFIED` render identically styled). Consider status-specific color
  coding (e.g. red-tinted for rejected, emerald-tinted for verified, amber for pending states) —
  this is both a usability improvement (faster visual triage) and reinforces, not replaces, the
  text label so it doesn't create a color-only accessibility issue.

### 11. `loading.tsx` skeleton shows 6 tab placeholders, real UI has 7

```tsx
{Array.from({ length: 6 }).map(...)} // queue tabs skeleton
```

vs. `page.tsx`'s actual `queueTabs` array of 7 entries. Small, but it causes a one-tab layout
shift/flash the moment real content replaces the skeleton. Bump to `7`.

---

## 🟡 Medium — Production readiness

### 12. No error-tracking integration — `console.error` is the entire strategy

Both `error.tsx` and `global-error.tsx` only `console.error` the caught exception. In a serverless/
edge deployment (Vercel), `console.error` output is not the same as a searchable, alertable error
record — for a compliance tool, an unhandled exception during a review session is something
on-call should actually be notified about, not something that silently exists in a log stream
someone has to go looking for. **Recommend:** wire both boundaries to whatever the monorepo's
shared observability setup is (Sentry, or an internal equivalent) — pass `error` and `error.digest`
through, so the digest shown to the user can actually be cross-referenced against a real captured
event, not just echoed back with nothing behind it.

### 13. Domain-package role/capability coupling is still fragile (`auth.ts` + `index.ts`)

`AUDITOR` and `SUPER_ADMIN` both resolve to the same `verificationRole: "VERIFICATION_COMPLIANCE_OFFICER"`
string, and are only distinguished by the separate `canRecordDecisions`/`canSeniorApprove` boolean
flags computed via an `isAuditor` check inside `auth.ts`. Two consequences:

- **The role label shown in the UI is misleading for auditors.** `page.tsx` renders
  `userContext.verificationRole` directly as a badge — an auditor sees the literal text
  "VERIFICATION_COMPLIANCE_OFFICER," which is the same label a full compliance officer with
  decision/approval rights would see. If this screen or a screenshot of it is ever used as evidence
  of who had what authority (plausible for a compliance tool), the label overstates the auditor's
  actual permissions.
- **It's a landmine for future code.** Any new code that branches on
  `verificationRole === "VERIFICATION_COMPLIANCE_OFFICER"` (instead of checking the specific
  boolean capability) will silently also match auditors, granting them whatever that check gates —
  even though `auth.ts` deliberately denies them `canRecordDecisions`/`canSeniorApprove` today. The
  correctness currently depends entirely on every future caller remembering to check the boolean,
  not the role string.

**Fix:** either add a genuinely distinct `VerificationRolePermission` value (e.g.
`VERIFICATION_AUDITOR`) so the label and the capability set stay honest together, or — better —
stop treating `verificationRole` as something the UI/other code should branch on at all, and make
the four `can*` booleans the only thing anything ever checks. If going that route, `verificationRole`
becomes purely a display label and should be documented as such so nobody is tempted to use it for
an authorization decision.

### 14. Test coverage gap: two of four mapped roles are untested

`auth.test.ts` covers unauthenticated, user-not-found, no-`adminProfile`, inactive-`adminProfile`,
unmapped-role (`FINANCE_MANAGER`), `SUPER_ADMIN`, and `AUDITOR` — good coverage of the interesting
edge cases. But `OPS_ADMIN → VERIFICATION_SENIOR_REVIEWER` and
`VERIFICATION_ADMIN → VERIFICATION_REVIEWER` have **zero test coverage**. These are two of the four
real mapped roles in production use; a regression in either mapping (e.g. an accidental swap of
which capabilities `VERIFICATION_SENIOR_REVIEWER` gets) would ship undetected. Add both.

Also add a case for `firstName`/`lastName` both null/empty, to lock in the `fullName` → email
fallback behavior (`.trim() || user.email`) — currently implicit, not verified by any test.

### 15. `package.json` — duplicate dependency declaration

```jsonc
"dependencies": { "@build/types": "workspace:*", ... },
"devDependencies": { "@build/types": "workspace:*", ... }  // duplicate
```

`@build/types` is listed in both `dependencies` and `devDependencies`. Since it's used for runtime
type contracts (not a pure dev/build-only tool), keep it under `dependencies` and remove the
`devDependencies` copy. Harmless functionally in most package managers, but signals the file wasn't
reviewed for redundancy, and duplicate keys across dependency sections are exactly the kind of
thing that causes confusing "which version wins" questions later if the two ever specify different
ranges.

### 16. Unverifiable references — flag for confirmation, not asserted as bugs

I don't have these files in this batch, so the following are **flagged for verification**, not
claimed as confirmed problems:

- `README.md` references `pnpm -C packages/db tsx grant-admin.ts` for granting local admin
  access — confirm this script actually exists; if it doesn't yet, the README is describing
  aspirational tooling the same way the dashboard badges did.
- `README.md`'s case-status state-machine diagram
  (`QUEUED ➔ PROCESSING ➔ (...) ➔ (MANUALLY_VERIFIED | MANUALLY_REJECTED | DEAD_LETTER)`) implies
  `DEAD_LETTER` is reached from the same branch as the manual-decision outcomes. Per the earlier
  runbook work, `DEAD_LETTER` is actually reached via attempt-budget exhaustion on a _retryable_
  status (e.g. `REGULATOR_UNAVAILABLE`), which may not route through `NEEDS_MANUAL_REVIEW` first.
  Worth cross-checking this diagram against the actual BullMQ retry/`markDeadLettered` call sites
  before treating it as accurate documentation — inaccurate state-machine docs in a compliance tool
  are a real liability, not a cosmetic issue.
- `package.json` lists `@build/typescript-config` as a devDependency — I don't have this app's
  `tsconfig.json` in this batch to confirm it actually `extends` it. If it doesn't, this is an
  unused dependency.
- No `tailwind.config`/`vitest.config` were included in this upload — the styling fixes above (§6,
  §7) and the test-runner setup (`setup.ts`'s `beforeAll`/`afterEach`, `@vitejs/plugin-react`
  usage) can't be fully verified without them. Recommend including both in the next review pass.

---

## Priority order for this pass

1. **§1, §2** — wire the domain DTO through and resolve the queue-overlap/mislabeling, since these
   are the biggest gaps between what this app claims to do and what it actually shows an operator.
2. **§6** — the invalid Tailwind shades are a one-line-per-instance fix with zero risk; do it in
   the same PR as anything else touching these files.
3. **§13, §14** — the auditor role-label/capability coupling and the two untested role mappings are
   both in the authorization surface, which is still the highest-stakes code in this app.
4. **§3, §4, §5** — pagination controls, authority filter, and `next/link` tabs are all real UX
   gaps but non-blocking; bundle as one "dashboard usability" pass.
5. **§7, §9, §10, §11** — design-token cleanup, responsive table, accessibility labels, skeleton
   count — low-risk polish, good candidates for a single styling-focused PR.
6. **§12** — error-tracking integration; do this before this app is relied on operationally, not
   necessarily before the above.
7. **§15, §16** — quick cleanups / verification items, no urgency, bundle with whatever else is in
   flight.
