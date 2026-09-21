# `.env` Strategy for `apps/verification-ops`

**Target:** Vercel-hosted Next.js app inside a pnpm/Turborepo monorepo, sharing a Clerk instance
and Postgres database with `apps/client`/`apps/admin`.
**Builds on:** `verification-ops-env.ts` (the `envConfig`/`validateEnv()` module from the prior
implementation plan).

The core principle underneath everything below is the [12-factor](https://12factor.net/config)
rule: **config that varies between deploys lives in the environment, never in code** — and the
staff-level corollary that matters most for a compliance app specifically: **which environment
you're in should also change what data you're allowed to touch**, not just which URL you call.

---

## 1. File taxonomy — what exists, what's committed, what isn't

| File                                   | Committed to git?                   | Purpose                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                         | ✅ Yes                              | Every variable this app reads, with safe placeholder values and comments. The single source of truth for "what do I need to set."                                                                                                                                                                                                       |
| `.env.local`                           | ❌ Never                            | Real developer secrets for local dev. Gitignored. Not shared, not synced via git.                                                                                                                                                                                                                                                       |
| `.env.test`                            | ✅ Yes, if values are non-sensitive | Deterministic, fake values for `vitest` runs (see §6). Only commit this if every value in it is genuinely safe to be public (dummy Clerk test keys that only work against a sandboxed test tenant, a local-only test DB URL, etc.) — if any value is a real secret, treat it like `.env.local` and gitignore it instead.                |
| `.env.development` / `.env.production` | ❌ Don't create these               | With Vercel as the deploy target, Preview/Production env vars live in **Vercel's dashboard**, not in files in the repo. Committing a `.env.production` — even with placeholder-looking values — trains people to expect secrets in git and is exactly the file a future contributor accidentally fills in with real values and commits. |

**`.gitignore` must have**, at minimum:

```gitignore
.env
.env.local
.env.*.local
!.env.example
!.env.test
```

Confirm this exists at the **repo root** `.gitignore`, not just inside `apps/verification-ops` —
a per-app `.gitignore` is easy to forget when a new app is scaffolded.

---

## 2. Next.js's actual load order (this trips people up)

Next.js loads env files in this precedence (first match wins, nothing later overrides it):

1. `process.env` (whatever the host/shell already set — this is what Vercel injects)
2. `.env.$(NODE_ENV).local`
3. `.env.local` (skipped entirely when `NODE_ENV=test`, by design — this is _why_ `.env.test`
   needs to be a real file rather than relying on `.env.local` during test runs)
4. `.env.$(NODE_ENV)`
5. `.env`

**Practical implication for this app:** don't create a bare `.env` at all. It's the lowest-precedence,
easiest-to-forget-about file, and having one invites "wait, why isn't my `.env.local` change taking
effect" debugging sessions when someone's shell already has the var set from a previous `vercel env
pull`. Keep exactly two working files locally: `.env.local` (secrets) and `.env.example` (docs).

---

## 3. Environment separation: map Vercel environments to real resource isolation

Vercel gives you three logical environments (Development/local, Preview, Production) — but the
industry-standard mistake is treating "Preview" as just "Production with a different URL." For an
app that handles license-verification evidence (PII, regulator records), that's a compliance risk,
not just a tidiness issue.

| Vercel environment                    | Clerk instance                      | Database                                                                                                   | Regulator adapters                                                                                   |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Development** (local, `.env.local`) | Clerk **test** instance/keys        | Local or a dedicated dev Postgres — never a copy of prod data. Seed with synthetic professionals/cases.    | All `enableAutoVerify<AUTHORITY>` flags off; adapters should have no real credentials locally at all |
| **Preview** (PR deploys)              | Same Clerk **test** instance as dev | A scoped **staging** database with synthetic or well-redacted data — not a straight snapshot of production | Off. A stray PR shouldn't be able to hit a live regulator API even by accident                       |
| **Production**                        | Clerk **production** instance/keys  | Production Postgres                                                                                        | Per §Phase-8-rollout — only authorities that have cleared shadow-mode validation                     |

**Why this matters specifically here:** `RegulatorEvidenceSnapshot.rawRecord` can contain more PII
than the professional even submitted (national ID numbers, addresses — see `evidence-store.ts`'s
own comment on this). A Preview deployment is reachable by anyone with the URL until Vercel's
Preview deployment protection is enabled — pointing Preview at real evidence data is the kind of
thing that turns into an incident report. **Action item:** confirm Vercel's "Preview Deployment
Protection" (password or SSO-gated previews) is turned on for this project regardless of the
above — defense in depth, not a substitute for data isolation.

---

## 4. Variable classification: server-only vs. `NEXT_PUBLIC_*`

Next.js inlines anything prefixed `NEXT_PUBLIC_` into the client JS bundle at build time — this
is a hard security boundary, not a naming convention. Audit every variable in
`verification-ops-env.ts` against this before adding new ones:

| Variable                            | Exposure                                                    | Why                                                                        |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client — correctly prefixed                                 | Designed to be public; it's how Clerk's client SDK identifies the instance |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | Client — correctly prefixed                                 | Just a route path, not sensitive                                           |
| `NEXT_PUBLIC_VERIFICATION_OPS_URL`  | Client — correctly prefixed                                 | Just this app's own base URL                                               |
| `CLERK_SECRET_KEY`                  | **Server-only — must never gain the `NEXT_PUBLIC_` prefix** | Full API access to your Clerk instance                                     |
| `DATABASE_URL`                      | **Server-only**                                             | Direct DB credentials                                                      |

**Staff-level rule of thumb:** when adding a new env var, default to server-only. Only add
`NEXT_PUBLIC_` when a client component genuinely needs the value in the browser, and treat that
decision as one requiring a second pair of eyes in review — it's much easier to accidentally leak
a variable this way than to fix it after the fact (rotating a key is cheap; finding every cached
bundle/CDN edge that served the leaked value is not).

---

## 5. Turborepo cache correctness (I haven't seen the repo's actual `turbo.json` — verify this against it, don't paste blind)

Turborepo hashes task inputs to decide whether it can serve a cached build. If an env var isn't
declared as a build input, **changing that var's value won't invalidate the cache** — you can ship
a stale build that thinks it's using the new `DATABASE_URL` but is actually running the previous
build's baked-in value. This is a real, easy-to-hit bug class, not a theoretical one.

Recommended addition (verify the exact syntax against your Turbo version — this is `turbo@^2.x`
syntax):

```jsonc
// turbo.json — add under the "build" task for verification-ops, or globally if every app
// shares this concern
{
  "tasks": {
    "build": {
      "env": [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
        "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        "CLERK_SECRET_KEY",
        "DATABASE_URL",
      ],
    },
  },
}
```

Also consider `"envMode": "strict"` at the root `turbo.json` (Turbo 2.x) — this makes Turbo only
pass through explicitly-declared env vars to each task, rather than the entire process
environment. That's the difference between "this task can only see what it's supposed to" and
"this task can see every secret every other app in the monorepo has," which matters once you have
multiple apps with different sensitivity levels sharing one CI run.

---

## 6. Test environment — don't let tests read a developer's real secrets

Because `.env.local` is skipped when `NODE_ENV=test` (§2), and because you don't want CI test runs
depending on any developer's personal `.env.local` existing anyway, `.env.test` should contain
fully synthetic values:

```bash
# .env.test — committed, values are dummy/test-mode only, never real secrets
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder_do_not_use_in_prod
CLERK_SECRET_KEY=sk_test_placeholder_do_not_use_in_prod
DATABASE_URL=postgresql://test:test@localhost:5432/verification_ops_test
NEXT_PUBLIC_VERIFICATION_OPS_URL=http://localhost:3501
```

If `vitest` needs these loaded explicitly (Next.js's own env-loading doesn't apply outside the
Next.js dev/build/start commands), add a small setup file:

```typescript
// vitest.setup.ts
import { config } from "dotenv";
config({ path: ".env.test" });
```

and reference it from `vitest.config.ts`'s `test.setupFiles`. Run `auth.ts`'s permission-mapping
tests (recommended in the Phase 1 implementation step) against this file, not against whatever
happens to be in a developer's shell.

---

## 7. `.env.example` — the actual file to add

This is the living contract for "what does this app need to run." Every variable in
`verification-ops-env.ts` must appear here, and this file should be the first thing updated in any
PR that adds a new env var — treat a PR that adds an env read without updating this file as an
incomplete PR, worth a lint rule or a PR-template checkbox if reviewers keep missing it.

See the accompanying `.env.example` file for the concrete content.

---

## 8. Secret scanning and rotation

- **Pre-commit + CI scanning.** Add [gitleaks](https://github.com/gitleaks/gitleaks) (or
  truffleHog) as both a pre-commit hook (via husky, if the monorepo already uses it — confirm) and
  a required CI check. This catches the "accidentally pasted a real `CLERK_SECRET_KEY` into
  `.env.example` while debugging" mistake before it reaches a shared branch, which is the single
  most common way secrets end up in git history regardless of how careful the `.gitignore` is.
- **Vercel's "Sensitive" env var toggle.** Mark `CLERK_SECRET_KEY` and `DATABASE_URL` as
  "Sensitive" in the Vercel project settings if that option is available on your plan — this
  prevents their values from being displayed in the dashboard UI/logs after initial entry, not
  just from being committed to git.
- **Rotation triggers, not just a calendar.** Rotate immediately (not "at the next scheduled
  window") if: a laptop with `.env.local` on it is lost/stolen, someone leaves the team with prior
  access, or a secret scanning tool actually flags a real leak. Calendar-based rotation (e.g.
  quarterly) is a reasonable floor on top of that, not a replacement for event-driven rotation.
- **Scope CI secrets to the job that needs them.** If GitHub Actions (or whatever CI runs this
  monorepo) has a single `CLERK_SECRET_KEY` org/repo secret shared across every app's CI job,
  `apps/verification-ops`'s CI job — which arguably needs the least access of any app here — gets
  the same blast radius as everything else. Prefer environment-scoped secrets
  (GitHub's "Environments" feature, with required-reviewer protection on anything mapped to
  Production) over one flat set of repo secrets.

---

## 9. Documentation and onboarding

Add a short section to this app's `README.md` (not covered in the files reviewed so far — confirm
one exists):

```markdown
## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill in `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from the team's Clerk **test**
   instance (ask in #platform-eng — do not use production Clerk keys locally)
3. Point `DATABASE_URL` at your local Postgres (see `/docs/local-database-setup.md`) or a shared
   dev database with synthetic seed data — never a copy of production data
4. `pnpm install && pnpm --filter verification-ops dev`
```

This is a small thing, but the actual failure mode it prevents is real: without an explicit
"don't use production keys locally" instruction, the path of least resistance for a new engineer
who just wants the app to run is to ask someone for "the" `CLERK_SECRET_KEY`/`DATABASE_URL`, and
whoever they ask often just pastes the production one because it's the one they have handy.

---

## Summary checklist

- [ ] `.env.example` committed and kept in sync with `verification-ops-env.ts`
- [ ] `.env.local` gitignored, never committed
- [ ] `.env.test` committed only if every value is genuinely non-sensitive
- [ ] No `.env`, `.env.development`, or `.env.production` files in the repo — those live in
      Vercel's dashboard
- [ ] Preview deployments use test-mode Clerk + a staging DB with synthetic data, not production
      resources
- [ ] Vercel Preview Deployment Protection enabled
- [ ] Every server-only secret confirmed to **not** have a `NEXT_PUBLIC_` prefix
- [ ] `turbo.json`'s `env` (or `globalEnv`) list updated for this app's build task — verify
      against the real file, not assumed from this doc
- [ ] gitleaks (or equivalent) running pre-commit and in CI
- [ ] CI secrets scoped per-app/per-environment, not one flat shared set
- [ ] README documents local setup with an explicit "use test-mode credentials" instruction
