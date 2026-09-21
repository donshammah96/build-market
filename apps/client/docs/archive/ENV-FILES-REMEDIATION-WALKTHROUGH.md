# apps/client Env Remediation Walkthrough

Date: 2026-03-20
Scope: step-by-step implementation plan to resolve findings in [ENV-FILES-AUDIT.md](./ENV-FILES-AUDIT.md)

## Goal

Move apps/client to a secure, repeatable env workflow with:

1. No committed live secrets.
2. Clear file ownership and purpose.
3. Consistent runtime contract between code and templates.
4. CI guardrails that detect drift and secret hygiene regressions.

## Success Criteria

You are done when all of the following are true:

1. Sensitive credentials have been rotated and old values revoked.
2. [apps/client/.env.vercel](../.env.vercel) is replaced with a non-secret template file.
3. Every env var used by app code exists in [apps/client/.env.example](../.env.example).
4. Auth bypass is off by default and blocked outside local development.
5. CI fails on env contract drift and secret leaks.

## Phase 0: Safety And Branching

### Step 0.1: Create a dedicated branch

```powershell
cd C:\Users\User\build-market
git checkout -b chore/client-env-remediation
```

### Step 0.2: Snapshot current state for incident forensics

```powershell
git status
git log --oneline -n 20
```

### Step 0.3: Stop sharing current local env values

Until rotation is complete:

1. Do not paste env content into chat, issues, PRs, or screenshots.
2. Avoid terminal commands that print full env values.

## Phase 1: Immediate Containment

### Step 1.1: Rotate exposed credentials now

Rotate all values currently present in local env snapshots, including at minimum:

1. Clerk secret keys and webhooks.
2. Auth secrets and internal API secret.
3. Database credentials.
4. Redis and Upstash credentials.
5. Resend and any external API keys.

After rotating, update only your local ignored files first:

1. [apps/client/.env](../.env)
2. [apps/client/.env.local](../.env.local)

### Step 1.2: Revoke old credentials

In each provider console, revoke old credentials explicitly. Rotation without revocation leaves risk open.

### Step 1.3: Add a one-time secret exposure review

Use your preferred scanner (for example GitHub secret scanning, trufflehog, gitleaks) across:

1. Current working tree.
2. Recent commit range.
3. Full git history if there is any chance secrets were committed before.

## Phase 2: Fix File Model And Ownership

### Step 2.1: Convert deployment env file to template-only model

Current concern: [apps/client/.env.vercel](../.env.vercel) is committed and looks like a runtime value file.

Target:

1. Replace this with [apps/client/.env.vercel.example](../.env.local.example) style placeholders.
2. Keep real deployment values in Vercel project env settings only.

Implementation sequence:

1. Create [apps/client/.env.vercel.example](../.env.local.example) with placeholder values.
2. Remove sensitive or real-looking values from [apps/client/.env.vercel](../.env.vercel) or stop tracking it.
3. Update [apps/client/.gitignore](../.gitignore) so local-only deployment env snapshots are ignored.

### Step 2.2: Clarify per-file ownership in docs

Update [apps/client/docs/ENV-FILES-AUDIT.md](./ENV-FILES-AUDIT.md) with "owner" and "update trigger" notes for each env file.

Recommended ownership model:

1. Platform/DevOps owner: deployment env contracts and secret stores.
2. App team owner: [apps/client/.env.example](../.env.example) contract accuracy.
3. QA owner: [apps/client/.env.test](../.env.test) determinism.

## Phase 3: Normalize Auth Bypass Controls

### Step 3.1: Disable bypass by default

In [apps/client/.env.local.example](../.env.local.example):

1. Add BYPASS_AUTH with default false in comments/examples.
2. Add a warning banner that bypass must never be enabled in shared or CI environments.

### Step 3.2: Add runtime hard-stop guard

Where bypass is consumed (see [apps/client/app/lib/api/api-middleware.ts](../app/lib/api/api-middleware.ts#L79)):

1. Keep development check.
2. Add explicit hard failure if BYPASS_AUTH is true and host is not local/dev.
3. Log structured warning when bypass is active.

### Step 3.3: Add CI assertion

Add a test or startup assertion that fails if:

1. BYPASS_AUTH is true in CI.
2. BYPASS_AUTH is true while NODE_ENV is production.

## Phase 4: Align Env Contract With Code

### Step 4.1: Build a single source of truth

Use [apps/client/.env.example](../.env.example) as canonical contract.

Every env var used by application code should be present there, including missing storage vars identified in audit:

1. STORAGE_PROVIDER
2. UPLOAD_DIR
3. STORAGE_BUCKET
4. STORAGE_REGION
5. CDN_URL
6. S3_ASSET_BUCKET

### Step 4.2: Add metadata comments per variable

For each variable in [apps/client/.env.example](../.env.example), annotate:

1. Required or optional.
2. Server-only or NEXT_PUBLIC.
3. Default behavior if omitted.

### Step 4.3: Resolve feature flag default drift

Make rollout defaults explicit and intentional between:

1. [apps/client/.env.development](../.env.development)
2. [apps/client/.env.test](../.env.test)
3. [apps/client/.env.example](../.env.example)

Add a small matrix to docs explaining expected values per environment.

## Phase 5: Centralize Env Access In Code

### Step 5.1: Keep one canonical env access boundary

Primary env module is [apps/client/app/lib/infrastructure/env.ts](../app/lib/infrastructure/env.ts).

Refactor strategy:

1. New code should import env config from canonical module.
2. Existing direct process.env reads should be migrated in batches.
3. Keep bootstrap-only exceptions documented.

### Step 5.2: Prioritize high-risk direct reads first

Start with files touching auth, secrets, and infrastructure:

1. [apps/client/app/lib/api/api-middleware.ts](../app/lib/api/api-middleware.ts)
2. [apps/client/app/lib/security/internal-secret.ts](../app/lib/security/internal-secret.ts)
3. [apps/client/app/lib/infrastructure/storage.ts](../app/lib/infrastructure/storage.ts)
4. [apps/client/app/jobs/asset-cleanup.ts](../app/jobs/asset-cleanup.ts)

### Step 5.3: Expand validation groups

In [apps/client/app/lib/infrastructure/env.ts](../app/lib/infrastructure/env.ts), extend validation coverage for:

1. Storage variables.
2. Internal security secrets.
3. Operational cron/batch settings where required.

## Phase 6: Add Automated Guardrails

### Step 6.1: Add env contract drift checker script

Create a script that:

1. Scans source for process.env and env access keys.
2. Extracts keys listed in [apps/client/.env.example](../.env.example).
3. Fails if code uses keys not declared in template.

Suggested location:

1. apps/client/scripts/check-env-contract.ts

Suggested CI command:

```powershell
pnpm -C apps/client exec tsx scripts/check-env-contract.ts
```

### Step 6.2: Add secret scanning in CI

Add a CI job that runs secret detection on PRs and default branch.

### Step 6.3: Add lint pressure for new direct env reads

Add one of:

1. ESLint custom rule for restricted process.env usage outside env module.
2. PR check that blocks new direct process.env references except approved files.

## Phase 7: Verification Checklist

Run after each phase:

```powershell
pnpm run client:tsc-noemit
pnpm -C apps/client exec vitest --run
```

Then run focused checks for env-sensitive paths (auth, internal routes, jobs, storage).

Manual checks:

1. Local start with BYPASS_AUTH unset/false works.
2. Local start with BYPASS_AUTH=true logs warning and only works under allowed local conditions.
3. Preview/CI environments fail when bypass is enabled.
4. App behavior is unchanged for feature gates once defaults are intentionally set.

## Phase 8: Operationalization

### Step 8.1: Document rotation playbook

Create a short runbook in client docs that defines:

1. Rotation frequency (for example every 90 days).
2. Owners per provider.
3. Rollback contacts and escalation path.

### Step 8.2: Quarterly audit cadence

Every quarter:

1. Re-run env contract drift checker.
2. Re-run secret scan across default branch.
3. Confirm [apps/client/.env.example](../.env.example) still reflects runtime usage.

## Practical Execution Order (Fastest Path)

If you want minimal risk with fastest payoff, execute in this order:

1. Rotate and revoke secrets.
2. Fix [apps/client/.env.vercel](../.env.vercel) model.
3. Disable/harden bypass.
4. Align [apps/client/.env.example](../.env.example) with code.
5. Add CI drift + secret scanning.
6. Refactor direct process.env reads incrementally.

## PR Template For This Work

Use this PR checklist:

1. No live secrets committed.
2. Env template includes all runtime keys.
3. Bypass guardrails added and tested.
4. CI checks added for drift and secret scanning.
5. Docs updated:
   - [apps/client/docs/ENV-FILES-AUDIT.md](./ENV-FILES-AUDIT.md)
   - [apps/client/docs/ENV-FILES-REMEDIATION-WALKTHROUGH.md](./ENV-FILES-REMEDIATION-WALKTHROUGH.md)
