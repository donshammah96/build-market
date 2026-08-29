# Changelog — `apps/verification-ops` & `@build/verification-domain`

Scoped changelog for the verification operations surface and its shared domain package. The root
`CHANGELOG.md` carries a summary entry pointing here; this file is the detailed record for anyone
working directly in either package. Follows [Keep a Changelog](https://keepachangelog.com/)
conventions, reverse-chronological.

---

## [Unreleased]

### Added — Marketplace Leads Review Queue & Transpile Packages Configuration

- **Marketplace Leads Review Queue (`lib/marketplace-leads-queue.ts`)**:
  - Implemented `getMarketplaceLeadsReviewQueue()` and `recordMarketplaceLeadReviewDecision()` for manual verification ops triage and confidence overrides on marketplace leads.
  - Formatted document scan summary tallies (`cleanDocumentCount`, `pendingDocumentCount`, `infectedDocumentCount`).
  - Encapsulated Prisma imports via `import { prisma, type MarketplaceLeadStatus } from "@build/db"` to align with monorepo packaging boundaries.
- **Next.js Transpile Packages (`next.config.ts`)**:
  - Added `@build/telemetry` to `transpilePackages` in `next.config.ts` ensuring clean bundle resolution on Vercel and local build steps.
- **ESLint Unused Variable Restrictions (`eslint.config.js`)**:
  - Replaced `@typescript-eslint/no-unused-vars: "off"` with strict `@typescript-eslint/no-unused-vars` and `no-unused-vars: "off"` supporting `^_` ignore patterns, rest siblings, and destructured array ignores.

### Added — Datadog Direct Ingestion Telemetry & Shared `@build/telemetry` Integration

- **OpenTelemetry & Datadog Telemetry Integration (`instrumentation.ts`, `package.json`, `tsconfig.json`)**:
  - Integrated `@build/telemetry` inside `instrumentation.ts` `register()` hook, exporting traces directly to Datadog's OTLP intake endpoint with dynamic environment tagging (`production` vs `staging`).
  - Added `@build/telemetry` dependency in `package.json` and wired project reference in `tsconfig.json`.

### Fixed

- **SUPER_ADMIN access denied on sign-in (`middleware.ts`, `lib/auth.ts`, `packages/db/grant-admin.ts`)** — Production user `donshammah1@gmail.com` (`clerkId: user_3FKfonUuBhDFq41AfYXQ0yPHPdw`) was blocked at both auth gates on `verification.buildmarket.app`:
  - **Gate 1 (edge middleware):** `normalizeAdminAccessRole()` in `middleware.ts` only admits `"ADMIN"` or `"VERIFICATION_ADMIN"` from Clerk `publicMetadata.role`. The user's Clerk `publicMetadata` lacked the correct container-role value. **Fix:** Clerk Dashboard `publicMetadata` updated to `{ "role": "ADMIN", "status": "ACTIVE", "isOnboarded": true }` and user signed out to force a fresh JWT.
  - **Gate 2 (DB authorization):** `getVerificationUserContext()` in `lib/auth.ts` looks up `clerkId` against the `User` table and requires an active `AdminProfile` with a recognized `AdminRole`. The production user's real `clerkId` (`user_3FKfonUuBhDFq41AfYXQ0yPHPdw`) differed from the seed placeholder (`admin_buildmarket_001`) — the User row existed under the email but with a stale clerkId, and the `AdminProfile` had no `SUPER_ADMIN` row. **Fix:** `packages/db/grant-admin.ts` updated with the correct production `clerkId` and executed against the production Supabase DB — User row `clerkId` updated, `AdminProfile` upserted with `role: SUPER_ADMIN`, `isActive: true`. A reusable `packages/db/prisma/scripts/provision-super-admin.ts` script was also created for future reference.
  - **Architecture note:** The middleware's `"ADMIN"` container role and the DB `AdminRole.SUPER_ADMIN` are intentionally separate concerns: `"ADMIN"` in Clerk metadata is the edge gate (no DB hit), `SUPER_ADMIN` in `AdminProfile` is the fine-grained capability tier. The ROLE_MAP in `lib/auth.ts` correctly maps `SUPER_ADMIN → VERIFICATION_COMPLIANCE_OFFICER`, granting full `canRecordDecisions`, `canSeniorApprove`, `canViewUnredactedEvidence`, and `canExportPackets` capabilities once the session is fresh.

- **Server Component event-handler boundary error — authority filter select (`app/page.tsx`, `app/authority-filter-select.tsx`)** — Next.js threw digest `932092346` on page load: `Error: Event handlers cannot be passed to Client Component props` caused by an `onChange` handler on a `<select>` element inside `app/page.tsx`, which is a Server Component. **Fix:** Extracted the authority filter (`<Filter>` icon + `<form>/<select>` with `onChange`) into a new `"use client"` component at `app/authority-filter-select.tsx`. The Server Component now renders `<AuthorityFilterSelect currentQueue={...} currentAuthority={...} authorities={[...]} />` passing only serializable string/array props across the RSC boundary. Removed the unused `Filter` import from `page.tsx`.
- **TypeScript Dev Server Types Reference (`next-env.d.ts`)**:
  - Updated auto-generated Next.js route type reference in `next-env.d.ts` from `./.next/types/routes.d.ts` to `./.next/dev/types/routes.d.ts` to align with monorepo Next.js Turbopack development compilation output.

### Changed — env.ts, middleware.ts, auth.ts

- **`lib/infrastructure/env.ts`**: migrated onto `@build/env-validation`'s `validateEnvGroups`/`validateSatelliteInvariants`/helpers, closing Drift 2 for this app (this file previously carried its own full local copy of the engine, by its own header comment's design). **Finding 6 confirmed already fixed** in this file — `primarySignInUrl` already resolved strictly from `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` with no relative-path fallback; added an explicit guard comment and wired `scripts/verify-vercel-env.ts` as the CI-side backstop for the same class of regression. **Documented an explicit decision**: this app does NOT implement any dev auth bypass, even locally — the most sensitive of the three apps (license verification decisions, unredacted evidence export) should exercise the real Clerk satellite handshake in local dev, not a bypass flag.
  - **`middleware.ts`**: satellite helpers (`normalizeClerkDomain`, `resolvePrimarySignInUrl`) now imported from `@build/security-clerk` instead of a local duplicate (Finding 7), which also gets this app the request-memoization fix (Finding 10) for free. `BLOCKED_STATUSES` literal replaced with `isBlockedUserStatus()` from `@build/enums` (Finding 9). Role/status parsing helpers (`parseSessionMetadata`, `normalizeAdminAccessRole`) stay local — app-specific, not part of the duplicated satellite-mechanics set.
  - **`lib/auth.ts`**: added a Tier 2 (300s) session-freshness gate to `getVerificationUserContext()` via `isClaimFresh()` from `@build/security-clerk`. `canRecordDecisions`/`canSeniorApprove`/`canViewUnredactedEvidence`/`canExportPackets` are now `role-permits AND session-fresh`; a stale session degrades these to `false` without denying the whole context, so read-only identity fields stay available while destructive actions are blocked pending a client-side session refresh. Added a `sessionFresh` field to `VerificationUserContext` so callers can distinguish "not permitted" from "needs a refresh."

- **Satellite Edge Role Gating & Status Gate (`middleware.ts`)**:
  - Implemented edge-level status gate (`SUSPENDED`, `BANNED`, `DEACTIVATED`, `ARCHIVED`) and container role gate (`normalizeAdminAccessRole`) in `middleware.ts`, requiring `"ADMIN"` container role for non-public satellite route resolution.
  - Updated `isPublicRoute` matcher to include `/unauthorized` and `/unauthorized-sign-in`.
  - Implemented `parseSessionMetadata()` supporting nested `metadata` session claims to prevent JSON key collisions with Supabase RLS integration.
  - Verified 100% passing Vitest test suite (`__tests__/auth.test.ts`) and TypeScript compilation (`tsc --noEmit`).
- **Satellite Auth Environment Contract & Origin Resolution (`lib/infrastructure/env.ts`)**:
  - Added computed `appUrl` field in `buildEnvConfig()` resolving `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` origin for primary app contract compatibility.
  - Exported `export const env = envConfig` alias for cross-app environment contract uniformity across monorepo packages.
- **Security drift reporting script (`apps/verification-ops/scripts/report-security-drift.mjs`)**: removed unused function `uniqueFiles` to ensure clean static analysis execution and zero unused-declaration warnings.
- **Directory layout & Vercel tsconfig build configuration** — resolved structural mislocations and TypeScript build failures for Vercel builds (`pnpm tsc --build tsconfig.json`):
  - Relocated domain logic and infrastructure files out of Next.js App Router route directory `app/lib/` to root `lib/` (`lib/auth.ts`, `lib/verification-ops-data.ts`, `lib/infrastructure/env.ts`, `lib/infrastructure/env-utils.ts`), eliminating path alias conflicts between `@/*` and `@/lib/*`.
  - Relocated `/sign-in` route into `(auth)` route group (`app/(auth)/sign-in/[[...sign-in]]/page.tsx`), matching workspace conventions.
  - Updated `tsconfig.json` to extend `@build/typescript-config/nextjs.json`, enabled `"composite": true` required for `tsc --build`, set `"jsx": "preserve"`, updated path aliases to `./lib/*`, and added monorepo package `references` (`packages/db`, `packages/enums`, `packages/types`, `packages/ui`, `packages/verification-domain`, `packages/resilience`).
  - Updated `instrumentation.ts`, `eslint.config.js`, `vitest.config.ts`, `__tests__/auth.test.ts`, and `README.md` to reference `lib/` paths cleanly.

### Added

- **Staff-level CI implementation** — integrated `apps/verification-ops` into `.github/workflows/ci.yml` and the monorepo validation suite for complete CI parity with `apps/client` and `apps/admin`:
  - `.github/workflows/ci.yml`: added `verification-ops-changelog-guard` (requiring `CHANGELOG.md` updates when code in `apps/verification-ops/` changes), `verification-ops` lint, env contract check, security drift checks, and full workspace gate (`pnpm run verification-ops:check-all`) in the `validate` job, and `verification-ops-preview-smoke-gate` (running `next start` on port 3501 backed by Postgres and Redis/Upstash stub services).
  - `apps/verification-ops/scripts/`: added `check-env-contract.mjs` (validates env templates against `lib/infrastructure/env.ts`), `check-security-drift.mjs` (static SEC-LINT pass checking env reads, log safety, hardcoded credentials, secret-shaped `NEXT_PUBLIC_*` vars, dynamic execution, and dangerous HTML), and `report-security-drift.mjs` (security posture summary with `--strict` mode support).
  - `package.json` & root `package.json`: added script targets `verification-ops:check-env-contract`, `verification-ops:check-security-drift`, `verification-ops:report-security-drift:strict`, `verification-ops:check-all`, `build:verification-ops`, `dev:verification-ops`, and updated `ci:local` for full local CI reproduction parity.
- **Staff Vercel Satellite Setup Guide** (`docs/verification-ops-vercel-satellite-setup.md`) — complete step-by-step setup plan for deploying `apps/verification-ops` to Vercel as a Clerk satellite of `buildmarket.app`. Covers Clerk dashboard satellite domain registration, Vercel project configuration, environment variable specifications, DNS/SSL setup, cross-domain auth smoke testing, and defect prevention (RC-2 relative sign-in URL redirect loops and RC-4 dynamic middleware options resolver).
- **Clerk satellite authentication** — this app is now configured as a Clerk **satellite** of
  `apps/client` (`buildmarket.app`), mirroring `apps/admin`'s existing setup:
  - `app/layout.tsx` — `<ClerkProvider>` now receives `isSatellite` / `domain` / `signInUrl`
    derived from the new env vars below, with the same `normalizeClerkDomain()` host-stripping
    helper as `apps/admin`'s layout.tsx (kept in sync by comment cross-reference). Fails fast at
    boot (`throw`) if `NEXT_PUBLIC_CLERK_IS_SATELLITE=true` with no absolute
    `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` configured, since that combination is a guaranteed
    infinite redirect loop the first unauthenticated request hits, not a soft-degrade case.
    Deliberately does **not** set `syncOnLoad` — left at Clerk's default (`false`) rather than
    forced to `true`, since this is a low-traffic internal tool reached via a deliberate click
    (the client-app shadow-mode banner, or a bookmark) rather than cold organic traffic; there's
    no meaningful population of "arrived without a primary-domain handshake but already holds a
    session" visitors here to justify the extra round trip on every load.
  - `middleware.ts` — unauthenticated requests to any non-public route are now redirected to the
    **primary** domain's sign-in (`resolvePrimarySignInUrl()`) with a `redirect_url` back to this
    app, replacing the previous standalone `/sign-in`-only gate. Ports
    `isAbsoluteHttpUrl()` / `normalizeClerkDomain()` / `deriveFallbackPrimarySignInUrl()` /
    `resolvePrimarySignInUrl()` from `apps/admin/middleware.ts` verbatim (comment-flagged to keep
    in sync), including the dynamic Clerk options resolver (second argument to
    `clerkMiddleware()`) required because `domain`/`signInUrl` must be resolved for every request
    — including public ones — before Clerk's own internal checks run. Falls back to this app's
    local `/sign-in` redirect (not a crash) if satellite resolution fails for a given request, and
    falls back to the pre-existing non-satellite behavior entirely when
    `NEXT_PUBLIC_CLERK_IS_SATELLITE` is unset/false, so local dev can still run this app standalone
    against a test Clerk instance without `apps/client` running.
  - `app/(auth)/sign-in/[[...sign-in]]/page.tsx` — **replaced** the previous dark-themed `<SignIn
/>` form (full Clerk sign-in UI rendered locally) with an immediate redirect to the primary's
    sign-in URL, forwarding any query params. Mirrors `apps/admin`'s equivalent page verbatim.
    This route now exists only as a safety net for direct navigation (bookmarks, stale links) —
    `middleware.ts` already redirects unauthenticated requests to every other route straight to
    the primary.
  - **`app/lib/infrastructure/env-utils.ts`** (new file) — small `toBool()` boolean-coercion
    helper, mirrored from `apps/admin`'s file of the same name. Needed because
    `NEXT_PUBLIC_CLERK_IS_SATELLITE` (and any future boolean flag) arrives as a raw string, where
    e.g. `"false"` is still truthy under a plain `if (value)` check.
  - **`env.ts`** — added `NEXT_PUBLIC_CLERK_IS_SATELLITE` (optional, default `"false"`),
    `NEXT_PUBLIC_CLERK_DOMAIN` (optional), and `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` (optional,
    validated as an absolute http(s) URL when present) to the `clerk` env group, and surfaced them
    on `envConfig.clerk` as `isSatellite` / `domain` / `primarySignInUrl`. Left non-required
    (unlike `CLERK_SECRET_KEY`/`DATABASE_URL`) so this app keeps working standalone wherever
    satellite mode hasn't been configured; the actual consequence of `isSatellite: true` without a
    valid `primarySignInUrl` is enforced at runtime in `layout.tsx` (fail fast) and
    `middleware.ts` (fail open + log), not in the validation engine itself, since it's a cross-var
    invariant rather than a single-var one.
  - **`.env.example`** — documented the three new satellite vars with inline guidance on when
    `NEXT_PUBLIC_CLERK_IS_SATELLITE` can safely stay `false` for local dev, and an explicit warning
    that `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` must be absolute, not relative.
- **`app/lib/infrastructure/env.ts`** — this app previously had **no env validation at all**;
  `layout.tsx` and `auth.ts` read `process.env` raw via `@clerk/nextjs`/`@build/db` with no
  fail-fast checks. Added a scoped `clerk`/`database`/`app` env-group validator mirroring the
  `apps/client` ADR-004 pattern (`EnvVar`/`EnvGroup`/`validateEnv()`), including
  `BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS` handling so required server secrets don't fail
  `next build` (`NEXT_PHASE=phase-production-build`) before they're actually available at
  runtime. Deliberately excludes a `nats` env group — no write path or event-publishing exists
  yet; add that group in the same change that adds `license.manual_decision_recorded` publishing.
- **`middleware.ts`** — edge-level `clerkMiddleware()` gate, redirecting any unauthenticated
  request to `/sign-in` for every route except `/sign-in` itself. Explicitly documented as
  defense-in-depth on top of (not a replacement for) `getVerificationUserContext()`'s
  authorization logic — this only guarantees no route is reachable signed-out; it has no
  knowledge of roles or `AdminProfile.isActive`. _(Superseded by the satellite-aware version
  above; the defense-in-depth framing and the `getVerificationUserContext()` relationship still
  hold unchanged.)_
- **`.env.example`** — full documented template matching every variable in `env.ts`, with a
  section explicitly marking `NATS_URL`/regulator credentials as **not yet needed**, to avoid
  making local setup harder for a capability that doesn't exist.
- **`tailwind.config.ts`** — this app had no Tailwind config at all despite `globals.css` using
  v3 `@tailwind base/components/utilities` directives, which require one for content scanning.
  Adds: `zinc.750`/`zinc.850` as explicit palette extensions (linear-midpoint hex values between
  the adjacent default shades — see Fixed, below, for why these were needed); wires
  `globals.css`'s previously-unused `--background`/`--foreground`/`--primary`/
  `--primary-foreground` CSS variables into `theme.extend.colors` so `bg-background`/
  `text-foreground`/`bg-primary` are actually usable; `darkMode: ["class"]` (app is dark-only
  today, documented as a deliberate choice, not an oversight); content paths scoped to `./app`,
  `./__tests__`, and the `@build/ui` package source. No additional plugins — kept intentionally
  lightweight.

### Changed

- **`app/(auth)/sign-in/[[...sign-in]]/page.tsx`** — no longer renders sign-in UI (see Added,
  above, for the full satellite-related rationale). The dark-themed `appearance` styling
  (`bg-zinc-800`/`emerald-600` accents, etc.) that previously lived on this page's `<SignIn />`
  block has been removed entirely rather than ported anywhere, since this domain no longer shows a
  sign-in form at all.
- **`app/lib/auth.ts`** — `getVerificationUserContext()` rewritten to default-deny:
  - Returns `null` when `!user.adminProfile` (previously fell through to a fake `"VIEWER"`
    sentinel and granted `VERIFICATION_READ_ONLY` to _any_ authenticated user, including clients
    and professionals with no admin relationship at all).
  - Returns `null` when `adminProfile.isActive === false` (previously never checked at all — an
    offboarded or suspended admin retained full role-based access indefinitely).
  - Role mapping changed from an implicit fallthrough (any unmapped `AdminRole` silently got
    `VERIFICATION_READ_ONLY`) to an explicit allow-list (`ROLE_MAP`) — `CONTENT_MODERATOR`,
    `SUPPORT_AGENT`, `FINANCE_MANAGER`, and anything else unmapped now correctly resolve to `null`.
  - Added an explicit `AUDITOR → VERIFICATION_COMPLIANCE_OFFICER` mapping with an `isAuditor` flag
    that forces `canRecordDecisions`/`canSeniorApprove` to `false` regardless of the base role
    mapping — auditors get full evidence/export access for KRA/compliance review without
    decision or four-eyes-approval authority. **Known remaining issue:** the displayed
    `verificationRole` string is identical for `AUDITOR` and `SUPER_ADMIN`
    (`"VERIFICATION_COMPLIANCE_OFFICER"`); only the boolean capability flags actually differ. Any
    future code that authorizes by checking `verificationRole` instead of the specific `can*`
    boolean will silently also match auditors. Tracked, not yet resolved — see Known Issues below.
- **`app/page.tsx`** — queue-filtering logic substantially reworked:
  - `LOW_CONFIDENCE` and `REGULATOR_UNAVAILABLE` case statuses added to `PENDING_STATES` and thus
    to both the default queue and the SLA-breach query — previously invisible in every tab despite
    being exactly the backlog the SLA-breach alert is meant to track.
  - SLA threshold now read from `SystemSettings.verificationSlaHours` (with a `48`-hour fallback
    on query failure) instead of a hardcoded constant.
  - `searchParams` now validated through a `zod` schema (`searchParamsSchema`) with `.catch()`
    fallbacks — previously invalid `authority`/`page` values threw an unhandled 500.
  - Prisma query now uses an explicit `select` (id/authority/licenseNumber/professionalId/status/
    createdAt only) instead of an unfiltered `findMany`, and a stable two-key `orderBy`
    (`createdAt` then `id`) to prevent skip/duplicate rows on timestamp collisions.
  - `ESCALATED` queue now correctly filters on cases with an open four-eyes decision
    (`decisions: { some: { highRiskReview: true, isSecondApprover: false } }`) rather than a bare
    `NEEDS_MANUAL_REVIEW` status filter — previously identical to the `NEEDS_CHANGES` tab.
  - Unauthenticated/unauthorized state now renders an in-page "Access Denied" card with a
    sign-out action, instead of relying solely on a redirect.
  - Evidence-audit and export-readiness dashboard badges reworded to be less overclaiming
    ("Append-Only Audit Log" instead of "EVIDENCE_VIEWED Active"; "Restricted" shown for users
    without `canExportPackets` instead of a blanket "Export Ready" claim). **Not fully resolved**
    — see Known Issues.
- **`@build/verification-domain/index.ts`**:
  - `VerificationCaseStatus` — added the three case statuses that were missing from the type
    entirely (`PROCESSING`, `REGULATOR_UNAVAILABLE`, `LOW_CONFIDENCE`), which meant the type was
    previously unsound relative to the real Prisma `RegulatorVerificationCaseStatus` enum: a case
    could be in a runtime state the type system had no representation for.
  - `RecordManualDecisionCommand.outcome` — corrected from an invented union
    (`"MANUALLY_VERIFIED" | "MANUALLY_REJECTED" | "NEEDS_CORRECTION"`, none of which are actually
    `RegulatorVerificationDecisionOutcome` values, and `NEEDS_CORRECTION` specifically belongs to
    an unrelated model, `ProfessionalLicense.status`) to the correct
    `"APPROVE" | "REJECT" | "REQUEST_MORE_INFO"`. Added the previously-missing required
    `highRiskReview: boolean` field — without it, nothing built against this command could ever
    trigger the four-eyes flow, since `recordManualDecision`'s second-approver logic depends on it
    being passed explicitly per call.
  - `ManualDecisionRecordedEvent` — split the single conflated `decision` field into separate
    `outcome` (the operator's verb) and `resultingCaseStatus` (the case's derived state) fields,
    since a `REQUEST_MORE_INFO` outcome or a high-risk `APPROVE` awaiting a second approver doesn't
    map 1:1 onto a single resulting status.
- **`package.json` (verification-ops)** — added `eslint` + `@build/eslint-config` (the `lint`
  script previously had no tooling installed to run it); added `@vitejs/plugin-react` (currently
  unregistered in `vitest.config.ts` — see Known Issues).
- **`vitest.config.ts`** — `resolve.alias` collapsed from three entries (`@/app`, `@/lib`, `@`) to
  the single `@` → `./` mapping that matches `tsconfig.json`'s actual `paths: { "@/*": ["./*"] }`.
  The removed `@/lib` → `./app/lib` alias didn't exist anywhere else in the toolchain — `tsc` and
  Next's bundler would have resolved a `@/lib/...` import to a different (wrong) path than vitest
  did, meaning a test could pass while the real build failed. Coverage `exclude` extended to cover
  `middleware.ts`, `instrumentation.ts`, and the App Router boilerplate files (`layout.tsx`,
  `loading.tsx`, `not-found.tsx`, `error.tsx`, `global-error.tsx`) that don't benefit much from
  unit-test coverage.

### Fixed ()

- **`lib/infrastructure/env-utils.ts`'s `toBool()` — narrowed-then-widened to match
  `apps/admin` exactly.** The version added alongside the satellite work above was initially
  typed `toBool(value: string | undefined | null)` and treated `"true"` / `"1"` / `"yes"` as
  truthy. Two problems, both now fixed:
  - **Type safety:** `apps/admin/middleware.ts` calls `toBool()` on
    `adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE`, which is already a real `boolean` by that
    point (admin's `env.ts` runs it through a zod `booleanString` transform first) — so `toBool`
    has to tolerate a `boolean` input, not just a string. The string-only signature here would
    have thrown on `.trim()` the moment a caller did the same (which the parity fix below now
    does deliberately in this app's `middleware.ts`). Retyped to `toBool(value: unknown)` with an
    explicit `typeof value === "boolean"` pass-through, verbatim-matching
    `apps/admin/lib/infrastructure/env-utils.ts`.
  - **Truthiness semantics:** narrowed from `"true" | "1" | "yes"` down to _only_ the literal
    string `"true"` (case-insensitive, trimmed) — matching admin's zod schema
    (`z.enum(["true", "false"])`) exactly. `NEXT_PUBLIC_CLERK_IS_SATELLITE` is conceptually the
    same flag family across `apps/admin` and `apps/verification-ops`; having two different
    truthiness rules for it across apps was a latent cross-app inconsistency bug, not a feature.
  - `middleware.ts`'s two `isSatellite` reads (`clerkMiddleware`'s handler and its dynamic
    options resolver) now both wrap `envConfig.clerk.isSatellite` in `toBool()` — redundant given
    `env.ts` already coerces it to a real boolean via `getBooleanEnv()`, but this matches
    `apps/admin/middleware.ts`'s identical (also redundant) call sites and is deliberately kept as
    defense-in-depth against a future `env.ts` refactor accidentally reintroducing a raw string.
    `layout.tsx` is unchanged — admin doesn't wrap it there either, since `<ClerkProvider
isSatellite>` expects a `boolean` prop directly and the value is already one.
- **Invalid Tailwind classes generating no CSS** — `bg-zinc-850` and `hover:bg-zinc-750` are not
  real shades in Tailwind's default `zinc` scale (which jumps `700 → 800 → 900`), so every use
  silently generated nothing, leaving affected elements transparent instead of the intended panel
  color. Present in `page.tsx` (queue tabs bar, table header, row hover),
  `not-found.tsx`/`error.tsx`/`global-error.tsx` (secondary button hover). Fixed by defining both
  shades explicitly in `tailwind.config.ts` rather than collapsing every usage to the nearest
  default shade, preserving the original half-step design intent.
- **`@build/verification-domain` package resolution mismatch** — `package.json`'s `main`/`types`
  pointed at `./dist/...` while `exports` pointed at raw `./src/index.ts`, two different
  resolution strategies in one file. Since this package has no runtime logic (pure types),
  switched fully to source-first resolution (`main`/`types`/`exports` all point at `src/index.ts`)
  and dropped the `dist` build (`tsc --noEmit` retained as a CI type-check gate, not an emit step).
  `tsconfig.json` updated to match (`noEmit: true`, dropped now-vestigial `declaration`/
  `declarationMap`/`sourceMap`/`outDir`/`rootDir`).
- **Duplicate dependency declaration** — `@build/types` was listed in both `dependencies` and
  `devDependencies` in `apps/verification-ops/package.json`. Removed from `devDependencies` (it's
  used for runtime type contracts, not build-only tooling).
- **`next.config.ts`** — `@build/enums` was a declared dependency but missing from
  `transpilePackages`, risking a build failure or accidental-only-working resolution depending on
  how the package ships. Added. Also added `poweredByHeader: false` and a `headers()` block
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a
  restrictive `Permissions-Policy`, HSTS) — previously zero security headers on an app that
  handles license-verification evidence and PII.

### Known Issues (tracked, not yet resolved)

- **Satellite `syncOnLoad` decision is a point-in-time judgment call, not a permanent one.**
  Left at Clerk's default (`false`) on the reasoning that this app is reached via deliberate
  clicks, not cold organic traffic (see Added, above). If usage patterns change — e.g. this
  becomes reachable from a public regulator-facing surface, or session-staleness complaints start
  showing up from operators who left a tab open across a primary-domain re-auth — revisit and
  consider forcing `syncOnLoad: true`.
- `VerificationOpsCaseDTO` (the domain package's case shape — `professionalName`,
  `confidenceScore`, `confidenceBreakdown`, precomputed `slaDueDate`/`isSlaBreached`, etc.) is
  still entirely unconsumed. `page.tsx` builds its own ad hoc row shape from a raw `select`
  instead. Concretely: the table shows a truncated `professionalId` instead of a resolved name,
  and none of the confidence-scoring detail from the Phase 10 rework is visible to operators yet.
- Queue tab overlap: "Automated Review" (`AUTO_VERIFIED | PROCESSING`) and "Verified"
  (`AUTO_VERIFIED | MANUALLY_VERIFIED`) both include `AUTO_VERIFIED`, so a completed
  auto-verification appears in both tabs. "Needs Changes" is a strict subset of the default
  "Pending" queue and is itself a superset of "Escalated" — a single case can appear in three tabs
  at once. Needs either an explicit mutual-exclusivity pass or documented sign-off that the
  overlap is intentional.
- "Needs Changes" doesn't implement what its name and the original Phase 8 guideline describe — it
  was meant to reflect `ProfessionalLicense.status = NEEDS_CORRECTION` (a License-level join), and
  currently just re-filters `RegulatorVerificationCase.status = NEEDS_MANUAL_REVIEW` instead.
- No pagination controls (Next/Previous) or authority-filter control exist in the rendered UI,
  despite both being fully supported by the underlying query and `searchParams` schema.
- Queue tabs and the not-found page's navigation links use plain `<a href>` instead of `next/link`,
  forcing a full page reload (re-mounting `ClerkProvider`, refetching fonts) on every click.
- `error.tsx`/`global-error.tsx` only `console.error` — no integration with an error-tracking
  service. In a serverless/edge deployment this means unhandled exceptions during a live review
  session aren't reliably surfaced to on-call.
- `@vitejs/plugin-react` is installed but not registered in `vitest.config.ts`, and `environment`
  is hardcoded to `"node"` — fine for the current pure-logic tests, but the first component test
  written (e.g. against the error/not-found pages, or the new sign-in redirect page) will need
  both the plugin and a `jsdom`/`happy-dom` environment added.
- Coverage thresholds in `vitest.config.ts` (80% lines/functions/branches/statements, global
  aggregate) are very likely unmet given only `auth.test.ts` exists as of this pass — confirm
  whether this is wired into a blocking CI check before relying on it as a real gate. The new
  `middleware.ts` satellite-resolution helpers and the sign-in redirect page currently have zero
  test coverage.
- Test coverage gap in `auth.test.ts`: `OPS_ADMIN → VERIFICATION_SENIOR_REVIEWER` and
  `VERIFICATION_ADMIN → VERIFICATION_REVIEWER` — two of the four real role mappings — have zero
  test coverage.
- Governance-badge honesty is partially, not fully, resolved: "Four-Eyes Mandatory" is true at the
  backend level but nothing in this app implements a decision-recording UI yet; the export
  `<Download>` button has no handler even for users where the label now correctly says nothing
  is restricted.
- `@build/verification-domain`'s `AUDITOR`/`SUPER_ADMIN` role-label collision (see Changed, above)
  — needs either a distinct `VerificationRolePermission` value or a shift to treating the role
  string as display-only, never as something authorization logic branches on.

---

## Schema dependencies (Landed & Fully Wired)

The following `packages/db` schema dependencies have landed and are fully wired across services, repositories, and UI:

- `RegulatorVerificationCase.confidenceAlgorithmVersion`, `.confidenceBreakdown` — fully populated into `VerificationOpsCaseDTO` (`verification-ops-data.ts`) and persisted during gateway verification attempts (`evidence-store.ts`).
- `RegulatorVerificationEvidenceView` model — wired to record append-only evidence read audit trails in `logEvidenceViewedAuditEvent` (`evidence-store.ts`), updating the dashboard "Evidence Audit" metric badge to active.
- `SystemSettings.verificationSlaHours` — dynamically queried from Prisma in `fetchVerificationOpsCases` (`verification-ops-data.ts`) with a `48`-hour fallback when not set.
- Audit Retention Policy (`20260803000000_regulator_verification_audit_retention_policy`) — `licenseId` made optional (`String?`) with `onDelete: SetNull` so unlinked or deleted licenses preserve historical case records, and `onDelete: Restrict` on decisions and evidence views preventing audit trail deletion.
