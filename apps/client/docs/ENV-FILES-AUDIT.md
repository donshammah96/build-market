# apps/client Environment Files Audit

Date: 2026-03-20
Scope: apps/client environment files and env access patterns

## Executive Summary

This audit found a functional env strategy with clear template files, but also several high-impact gaps:

1. Sensitive values are present in local env files in this workspace snapshot, including auth, DB, Redis, and API credentials.
2. Development auth bypass is enabled in local overrides.
3. Runtime env usage is fragmented between centralized config and many direct `process.env` reads.
4. File intent is mostly good, but there is drift between templates, defaults, and real code-consumed variables.

## Next.js Env Load Order

For local development in this app, practical precedence is:

1. `.env.local`
2. `.env.development`
3. `.env`

For tests:

1. `.env.test`
2. `.env.local` (if loaded by runner/tooling)

## File Purpose And Usage

| File                  | Expected Git Status         | Purpose                                                   | Owner                | Update Trigger                                                             | Notes                                                                                               |
| --------------------- | --------------------------- | --------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.env`                | Ignored                     | Developer machine secrets and machine-specific defaults   | Individual developer | Local secret rotation, provider credential changes, machine-specific setup | Contains many sensitive values in current snapshot; treat as compromised and rotate if ever exposed |
| `.env.development`    | Committed                   | Shared non-secret dev defaults for all contributors       | App team             | Team-wide local dev default changes                                        | Good use for URLs/feature defaults; keep secret-free                                                |
| `.env.example`        | Committed                   | Canonical template of required/optional variables         | App team             | Any new or removed runtime env dependency in app code                      | Source of truth for onboarding and CI env-contract checks                                           |
| `.env.local`          | Ignored                     | Personal local overrides with highest precedence          | Individual developer | Temporary local-only override needed                                       | Currently used for auth bypass settings; high-risk if left enabled                                  |
| `.env.local.example`  | Committed                   | Template for personal local overrides                     | App team             | New supported local-only toggle or override policy                         | Good pattern; should include all supported local-only overrides                                     |
| `.env.test`           | Committed                   | Deterministic non-secret test configuration               | QA                   | Test harness contract change or deterministic default adjustment           | Keep aligned with runtime env contract and test reproducibility goals                               |
| `.env.vercel`         | Ignored/local-only snapshot | Local deployment-env scratch file (never source of truth) | Platform/DevOps      | Local debugging only; do not rely on it for deployment config              | Real deployment values belong in platform secret manager                                            |
| `.env.vercel.example` | Committed                   | Placeholder deployment template contract                  | Platform/DevOps      | Deployment env contract changes (new/removed platform variables)           | Template-only file; no live values                                                                  |

Ownership model used in this table:

1. Platform/DevOps owner: deployment env contracts and secret stores.
2. App team owner: `.env.example` contract accuracy and local template hygiene.
3. QA owner: `.env.test` determinism.

## Findings (Severity Ordered)

### 1) Critical: Sensitive values are present in local env files

Evidence includes entries in `.env` for server-side secrets and credentials.

Impact:

- Any leak of local workspace copies, logs, screenshots, shell history, or file sync could expose production-like credentials.
- If these values were ever committed previously, rotation is mandatory.

Recommended action:

1. Rotate all exposed credentials immediately.
2. Replace values with fresh secrets from provider consoles.
3. Run a repository and Git history secret scan.
4. Move long-lived secrets to managed secret storage (Vercel/1Password/AWS Secrets Manager).

### 2) High: Local auth bypass is enabled

`BYPASS_AUTH=true` is present in `.env.local` and the middleware path uses this in development mode.

Impact:

- Accidental reliance on bypass can mask authorization defects.
- If accidentally propagated to other environments, risk increases sharply.

Recommended action:

1. Default this flag to `false` in local templates.
2. Add a startup hard-stop if bypass is true and environment is not explicit local development.
3. Add a CI/test assertion that bypass is disabled for integration and preview checks.

### 3) High: Env contract drift between code and env files

Code references vars not declared in env files, especially storage-related vars such as `STORAGE_PROVIDER`, `UPLOAD_DIR`, `CDN_URL`, and `S3_ASSET_BUCKET`.

Impact:

- Hidden fallback behavior can differ across developers and environments.
- Missing declarations reduce observability and onboarding reliability.

Recommended action:

1. Add all code-consumed vars to `.env.example` with clear defaults/comments.
2. Mark required vs optional explicitly.
3. Add a script that diffs code-consumed env names against `.env.example`.

### 4) Medium: Fragmented env access pattern

There is centralized env config in infrastructure env modules, but many files still read `process.env` directly.

Impact:

- Validation is bypassed in direct-read paths.
- Harder to reason about required variables and defaults.

Recommended action:

1. Adopt one canonical env access boundary for server code.
2. Restrict direct `process.env` to the env module and bootstrap code.
3. Add lint rule or code review gate to discourage new direct reads.

### 5) Medium: Feature flag defaults are inconsistent across files

The mutations rollout flag differs between files:

- `.env.development` sets `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS=false`
- `.env.example` and `.env.test` set it to `true`

Impact:

- Behavioral differences between local dev and tests can hide rollout regressions.

Recommended action:

1. Define one owner file for default rollout policy.
2. Keep test defaults intentional and documented.
3. Add a short matrix in docs showing expected value by environment.

### 6) Medium: `.env.vercel` should not be a live-value file in repo

A committed `.env.vercel` containing environment values can be misused as authoritative runtime config.

Impact:

- Risk of stale values, accidental disclosure, and duplication of secret sources.

Recommended action:

1. Replace with `.env.vercel.example` (placeholders only).
2. Keep real deployment env values only in platform secret manager.
3. Add `.env.vercel` to ignore rules if local-only.

## Best-Practice Target State

1. Canonical source of env contract:

- `.env.example` defines every variable used by app code.
- Each variable tagged as required/optional and server/public.

2. Separation of responsibilities:

- `.env.development` and `.env.test` contain only non-secrets.
- `.env.local` and `.env` contain local secrets only and never leave developer machines.

3. Enforcement:

- Startup validation checks all critical vars in non-test environments.
- CI fails if code references an env var absent from `.env.example`.
- Secret scanning runs in pre-commit and CI.

4. Safe auth bypass policy:

- Disabled by default.
- Requires explicit opt-in plus local-only guardrails.

5. Deployment hygiene:

- No committed live-value deployment env files.
- Use platform-managed encrypted secrets.

## 30-60-90 Day Improvement Plan

### Next 7 days

1. Rotate credentials currently present in local env snapshot.
2. Document emergency secret rotation runbook in client docs.
3. Replace `.env.vercel` with `.env.vercel.example` placeholders.

### Next 30 days

1. Add env-contract drift check script in CI.
2. Normalize feature-flag defaults and document environment matrix.
3. Migrate most direct server-side `process.env` reads to canonical env module.

### Next 60-90 days

1. Move all production-grade secrets to managed secret store only.
2. Add repository-wide policy checks for sensitive env anti-patterns.
3. Establish quarterly secret rotation with audit trail.

## Evidence Links

- [apps/client/.env](../.env)
- [apps/client/.env.local](../.env.local)
- [apps/client/.env.development](../.env.development)
- [apps/client/.env.example](../.env.example)
- [apps/client/.env.local.example](../.env.local.example)
- [apps/client/.env.test](../.env.test)
- [apps/client/.env.vercel](../.env.vercel)
- [apps/client/.gitignore](../.gitignore)
- [apps/client/app/lib/infrastructure/env.ts](../app/lib/infrastructure/env.ts)
- [apps/client/lib/env.ts](../lib/env.ts)
- [build-market/.gitignore](../../.gitignore)
