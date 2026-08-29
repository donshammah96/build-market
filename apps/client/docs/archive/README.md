# Environment Configuration — Build Market (`apps/client`)

> **Production domain:** `https://build-market-ebon.vercel.app`  
> **Architecture reference:** `ADR-004` — Canonical Environment Variable Access Boundary  
> **Env module:** `app/lib/infrastructure/env.ts`

---

## Table of Contents

1. [File Inventory and Purpose](#1-file-inventory-and-purpose)
2. [Which Files Are Committed to Git](#2-which-files-are-committed-to-git)
3. [Next.js Loading Order](#3-nextjs-loading-order)
4. [Setting Up for Local Development](#4-setting-up-for-local-development)
5. [Required Variables Reference](#5-required-variables-reference)
6. [Configuring Vercel](#6-configuring-vercel)
7. [Redis Configuration by Environment](#7-redis-configuration-by-environment)
8. [Build-Time vs Runtime Variables](#8-build-time-vs-runtime-variables)
9. [Security Rules](#9-security-rules)
10. [Environment Validation System](#10-environment-validation-system)
11. [CI Configuration](#11-ci-configuration)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. File Inventory and Purpose

| File                  | Committed          | Contains Secrets | Environment            | Purpose                                                                                                   |
| --------------------- | ------------------ | ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `.env`                | ❌ No              | ✅ Yes           | Local dev              | Your actual local secrets and config. Copy from `.env.example`.                                           |
| `.env.local`          | ❌ No              | ✅ Yes           | Local dev              | Personal overrides. Highest priority. Never commit.                                                       |
| `.env.example`        | ✅ Yes             | ❌ No            | Template               | Full variable list with placeholder values. Reference when onboarding.                                    |
| `.env.development`    | ✅ Yes             | ❌ No            | `NODE_ENV=development` | Non-secret development defaults (URLs, flags, cron expressions). Committed.                               |
| `.env.test`           | ✅ Yes             | ❌ No            | `NODE_ENV=test`        | Stub values for Vitest. Contains only fake/test-mode credentials.                                         |
| `.env.vercel.example` | ✅ Yes             | ❌ No            | Production template    | Documents every variable needed for a Vercel production deployment. Real values go in the Vercel UI only. |
| `.env.vercel`         | ❌ No (gitignored) | ⚠️ Maybe         | Production reference   | Optional local file for tracking which Vercel vars you've set. Never commit if it contains secrets.       |

### `.env` — Local Secrets File

Your primary local configuration. Contains real API keys, database credentials, and secrets needed to run the app locally. **This file is gitignored** — it will never be committed.

Copy to create it:

```bash
cp .env.example .env
# Then fill in real values for your local environment
```

### `.env.local` — Personal Overrides

Highest-priority file. Use it for:

- Offline dev auth bypass (`BYPASS_AUTH=true`)
- Switching between local and remote databases
- Pointing at a different Redis instance
- Your personal Clerk testing token

**Never commit this file.** It is gitignored by Next.js automatically.

### `.env.example` — The Canonical Template

Source of truth for the complete variable set. Every variable the application reads must appear here. The `check-env-contract.mjs` script compares runtime usage against this file and fails CI if any variable is missing.

Keep this file up to date whenever you add a new `process.env` read to the codebase (though you should access env vars through `envConfig`, not `process.env` directly).

### `.env.development` — Development Defaults

Non-secret values that should be the same for all developers in development mode. Committed to version control. Examples: local service URLs, feature flags, cron schedules, Redis local defaults.

**Do not put secrets here.** They go in `.env` or `.env.local`.

### `.env.test` — Test Stubs

Configuration for Vitest. Contains only stub/fake values — obviously invalid credentials like `sk_test_stub_for_tests_only` and zeroed-out encryption keys. The environment validation module (`env.ts`) skips auto-validation when `NODE_ENV=test`.

### `.env.vercel.example` — Production Template

Documents every variable required for a Vercel deployment, with the correct production values for Build Market (`build-market-ebon.vercel.app`). Variables marked `[SECRET]` must be set in the **Vercel UI** (Project Settings → Environment Variables), never in a committed file.

---

## 2. Which Files Are Committed to Git

```
apps/client/
├── .env                  ← GITIGNORED (secrets)
├── .env.local            ← GITIGNORED (personal overrides)
├── .env.vercel           ← GITIGNORED (may contain secrets)
├── .env.example          ← COMMITTED ✅
├── .env.development      ← COMMITTED ✅
├── .env.test             ← COMMITTED ✅
└── .env.vercel.example   ← COMMITTED ✅
```

Verify your `.gitignore` contains:

```
.env
.env.local
.env.vercel
*.env.local
```

---

## 3. Next.js Loading Order

Next.js loads these files in this order (higher = higher priority, wins on conflict):

```
.env.local                  ← highest priority (personal, gitignored)
.env.[NODE_ENV].local       ← e.g., .env.development.local (gitignored)
.env.[NODE_ENV]             ← e.g., .env.development, .env.test (committed)
.env                        ← base secrets (gitignored)
```

**Practical examples:**

- `DATABASE_URL` in `.env.local` overrides the same key in `.env` — useful for switching databases.
- `REDIS_HOST=localhost` in `.env.development` sets the default; your `.env.local` can override it to point at a remote Redis.
- In CI, no `.env` or `.env.local` files exist — the CI system must inject all required variables as environment variables directly.

---

## 4. Setting Up for Local Development

### Step 1 — Copy the template

```bash
cp .env.example .env
```

### Step 2 — Fill in required secrets

Open `.env` and set at minimum:

```bash
# Clerk (get from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_FRONTEND_API=https://your-instance.accounts.dev

# Database
DATABASE_URL=postgresql://user:password@localhost:5434/buildmarket

# Auth secret — generate with: openssl rand -base64 32
AUTH_SECRET=your_generated_secret

# Encryption key — generate with: openssl rand -hex 32
ENCRYPTION_KEY_V1=your_64_hex_char_key

# Internal secret — generate with: openssl rand -base64 32
INTERNAL_API_SECRET=your_generated_secret
```

### Step 3 — Optional: configure Redis

For local development, Redis is optional when `RATE_LIMIT_BACKEND=auto` (defaults to in-memory in development). To use Redis locally:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_ENABLED=true
```

Or if using Upstash:

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### Step 4 — Optional: offline auth bypass

If you want to develop without Clerk being reachable, create `.env.local`:

```bash
# .env.local
BYPASS_AUTH=true
DEV_CLERK_ID=user_local_dev
DEV_DB_USER_ID=00000000-0000-0000-0000-000000000000
DEV_USER_EMAIL=developer@example.com
DEV_USER_ROLE=PROFESSIONAL
```

> ⚠️ `BYPASS_AUTH=true` is hard-blocked outside localhost development mode. The middleware enforces this.

### Step 5 — Run the env contract check

```bash
pnpm run client:check-env-contract
```

This verifies `.env.example` covers every `process.env` key used in the codebase.

---

## 5. Required Variables Reference

These variables must be present at **runtime**. Without them, startup validation throws an error (except during build phase when they are deferred).

| Variable                            | When Required   | How to Generate           | Notes                                                            |
| ----------------------------------- | --------------- | ------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Always          | Clerk dashboard           | `pk_test_*` for dev, `pk_live_*` for prod                        |
| `CLERK_SECRET_KEY`                  | Runtime only    | Clerk dashboard           | `sk_test_*` for dev, `sk_live_*` for prod                        |
| `CLERK_WEBHOOK_SECRET`              | Runtime only    | Clerk webhook settings    | Required for webhook signature verification                      |
| `AUTH_SECRET`                       | Runtime only    | `openssl rand -base64 32` | 32+ byte random string                                           |
| `DATABASE_URL`                      | Runtime only    | Your database             | `postgresql://...`                                               |
| `ENCRYPTION_KEY_V1`                 | Runtime only    | `openssl rand -hex 32`    | Exactly 64 hex characters                                        |
| `NEXT_PUBLIC_APP_URL`               | Build + Runtime | —                         | Set to your domain (e.g. `https://build-market-ebon.vercel.app`) |
| `NEXT_PUBLIC_API_URL`               | Build + Runtime | —                         | Typically `${NEXT_PUBLIC_APP_URL}/api`                           |

Variables marked "Runtime only" are deferred during `NEXT_PHASE=phase-production-build` — this prevents build failures when secrets aren't available at build time (normal for Vercel).

Variables marked "Build + Runtime" (`NEXT_PUBLIC_*`) **must** be set in Vercel before the first deployment because they are baked into the static bundle.

---

## 6. Configuring Vercel

### Step 1 — Go to Environment Variables

Vercel Dashboard → Your Project → **Settings** → **Environment Variables**

### Step 2 — Set each variable

Use the `.env.vercel.example` file as your checklist. For each entry:

- If marked `[SECRET]`: paste the real value in the Vercel UI under the appropriate environment scope (Production, Preview, or Development).
- If not marked `[SECRET]`: safe to add via file upload or Vercel CLI.

### Step 3 — Minimal required set for first deployment

```bash
# Public (safe to expose at build time)
NEXT_PUBLIC_APP_URL=https://build-market-ebon.vercel.app
NEXT_PUBLIC_API_URL=https://build-market-ebon.vercel.app/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# Secrets (add these in the Vercel UI, never in files)
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
AUTH_SECRET=<openssl rand -base64 32>
DATABASE_URL=postgresql://...
ENCRYPTION_KEY_V1=<openssl rand -hex 32>
INTERNAL_API_SECRET=<openssl rand -base64 32>
```

### Step 4 — Set CORS and CSRF trusted origins

```bash
CORS_ALLOWED_ORIGINS=https://build-market-ebon.vercel.app
CSRF_TRUSTED_ORIGINS=https://build-market-ebon.vercel.app
```

For preview deployments, add the Vercel preview domain pattern too:

```bash
CORS_ALLOWED_ORIGINS=https://build-market-ebon.vercel.app,https://*.vercel.app
```

### Step 5 — Configure Redis (recommended)

For production rate limiting that works across serverless invocations, use **Upstash Redis**:

1. Create a free database at [upstash.com](https://upstash.com)
2. Copy the REST URL and token
3. Add to Vercel:

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
REDIS_ENABLED=true
RATE_LIMIT_BACKEND=auto  # auto uses Redis in production
```

Alternatively, use a Redis connection URL:

```bash
REDIS_URL=redis://default:password@host:6379
REDIS_TLS=true
```

If you skip Redis entirely, set:

```bash
RATE_LIMIT_BACKEND=memory
```

> ⚠️ `memory` mode means rate limits are per-serverless-instance — two concurrent invocations don't share rate limit state. Acceptable for low-traffic, not for production scale.

### Step 6 — Trigger a deployment

After adding all environment variables, go to **Deployments** and trigger a new deployment. The build will now succeed.

### Vercel CLI alternative

```bash
# Upload non-secret variables from template
vercel env pull .env.vercel       # pull current env from Vercel to local
vercel env add VARIABLE_NAME      # add a new variable interactively
```

---

## 7. Redis Configuration by Environment

| Environment            | Recommended Config                            | Notes                                            |
| ---------------------- | --------------------------------------------- | ------------------------------------------------ |
| Local dev (no Redis)   | `RATE_LIMIT_BACKEND=auto`, Redis not running  | Auto falls back to memory in development         |
| Local dev (with Redis) | `REDIS_HOST=localhost`, `REDIS_PORT=6379`     | Run `docker run -p 6379:6379 redis`              |
| Vercel / Serverless    | `UPSTASH_REDIS_REST_URL` + token              | HTTP-based; no persistent TCP connections needed |
| Self-hosted / VPS      | `REDIS_URL=redis://...` or separate host/port | Standard Redis client                            |
| CI                     | `RATE_LIMIT_BACKEND=memory`                   | No Redis service in CI — avoid connection errors |

### Why Upstash for Vercel?

Vercel runs serverless functions that spin up and tear down per request. A traditional Redis client using TCP connections may fail to connect within the cold-start window or leave dangling connections. Upstash Redis uses HTTPS REST calls — no persistent connection needed, works reliably in serverless.

---

## 8. Build-Time vs Runtime Variables

Understanding this distinction prevents the most common Vercel deployment failures.

### Build-time variables (must be set BEFORE deploy)

Variables prefixed `NEXT_PUBLIC_` are embedded into the JavaScript bundle during `next build`. They **must** exist in Vercel's environment variables before the first deployment.

```bash
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_POSTHOG_KEY     # optional
NEXT_PUBLIC_POSTHOG_HOST    # optional
NEXT_PUBLIC_GEMINI_API_KEY  # optional
```

If you add a new `NEXT_PUBLIC_*` variable and it's required, the build will fail until you set it in Vercel.

### Runtime-only variables (deferred during build)

These are server-only secrets. The `env.ts` module defers their validation during `NEXT_PHASE=phase-production-build` so the build succeeds without them. They are validated at first request.

```bash
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
AUTH_SECRET
DATABASE_URL
ENCRYPTION_KEY_V1
```

If a runtime-only required variable is missing at first request, the server will throw an error and return 500.

---

## 9. Security Rules

### Cardinal rules — never break these

1. **Never commit `.env` or `.env.local`** — gitignore them.
2. **Never put real secrets in `.env.example`, `.env.development`, `.env.test`, or `.env.vercel.example`** — these are committed to git.
3. **Never set `BYPASS_AUTH=true` outside localhost development.** The middleware hard-blocks it in CI and production.
4. **Never set `NEXT_RUNTIME` in Vercel environment variables.** It is injected by the Next.js framework and overriding it breaks edge runtime detection.
5. **Rotate any key that has been accidentally committed** immediately — treat the old key as compromised.

### Secret rotation checklist

When rotating a secret:

1. Generate the new value.
2. Add it to Vercel (new value alongside old value during transition).
3. Trigger a deployment.
4. Verify the deployment is healthy.
5. Remove the old value from Vercel.
6. Update your local `.env` and `.env.local`.

For `ENCRYPTION_KEY_V1`:

- Increment the version counter: add `ENCRYPTION_KEY_V2` with the new key.
- Update `CURRENT_KEY_VERSION=v2`.
- Keep `ENCRYPTION_KEY_V1` in place until all data has been re-encrypted.
- Set `ENCRYPTION_MIGRATION_MODE=true` during migration.

### ADR-004 — Env access boundary

All `process.env` reads in `apps/client` must go through `app/lib/infrastructure/env.ts`. Direct `process.env` access in routes, domain services, or UI code is a boundary violation caught by the drift scanner.

Allowed bootstrap exceptions (must carry a comment):

```typescript
// bootstrap-only: module graph not initialized at this callsite
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
```

Allowed locations for bootstrap exceptions: `next.config.ts`, `instrumentation.ts`, `sentry.*.config.ts`.

---

## 10. Environment Validation System

`app/lib/infrastructure/env.ts` runs automatic validation on server startup (not on edge runtime, not in tests).

### Validation behavior by phase

| Phase / Context          | Validation behavior                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Local dev server startup | Validates all groups in `startupGroups` immediately. Throws on missing required vars.                                                       |
| `next build` (Vercel)    | `NEXT_PHASE=phase-production-build` → deferred server-only vars (secrets) are warned, not errored. `NEXT_PUBLIC_*` vars are still required. |
| Edge runtime             | Skipped entirely (middleware runs in edge).                                                                                                 |
| Test (`NODE_ENV=test`)   | Skipped entirely (vitest uses stub values).                                                                                                 |
| First HTTP request       | Full runtime validation runs. Missing runtime secrets throw 500.                                                                            |

### What gets validated at startup

```typescript
const startupGroups = ["clerk", "database", "urls", "encryption"];
// "redis" is added if RATE_LIMIT_BACKEND requires Redis in production
```

### Running validation manually

```typescript
import { validateEnv } from "@/app/lib/infrastructure/env";

// Validate specific groups (no throw)
const result = validateEnv(["redis", "storage"], false);
console.log(result.valid, result.errors, result.warnings);

// Validate all groups (throws on failure)
validateEnv("all");
```

### CI — env contract check

```bash
pnpm run client:check-env-contract
```

This script (`scripts/check-env-contract.mjs`) scans all TypeScript/JavaScript files for `process.env.VARIABLE_NAME` usage and verifies every key appears in `.env.example`. It also flags high-risk keys in `.env.example` that have no corresponding usage in the codebase.

Run this in CI before any deployment. It is already wired into the CI pipeline via `pnpm run client:check-env-contract` in `ci.yml`.

---

## 11. CI Configuration

Your CI pipeline (`ci.yml`) runs:

```yaml
- name: Env contract check
  run: pnpm run client:check-env-contract

- name: Client security drift checks
  run: pnpm run client:check-security-drift
```

For the env contract check to pass, CI needs access to `.env.example` (committed) but not to any secrets. This works automatically.

For test runs, CI needs the variables in `.env.test` (committed) plus any secrets not in that file. Add secrets to your CI provider's secret store and inject them as environment variables:

```yaml
# GitHub Actions example
env:
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
  ENCRYPTION_KEY_V1: ${{ secrets.ENCRYPTION_KEY_V1 }}
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
  CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
```

> Tip: for unit tests that don't hit the database or auth, `.env.test` stubs are sufficient and no CI secrets are needed.

---

## 12. Troubleshooting

### "Environment validation failed: Missing required: DATABASE_URL"

**Cause:** The server started in production mode but `DATABASE_URL` was not set.

**Fix:** Check that `DATABASE_URL` is set in Vercel Project Settings → Environment Variables → **Production** scope. After adding it, trigger a new deployment.

### "Environment validation failed: Missing required: NEXT_PUBLIC_APP_URL"

**Cause:** `NEXT_PUBLIC_APP_URL` is required at **build time**. If it's missing, the build fails.

**Fix:**

1. In Vercel → Settings → Environment Variables, add `NEXT_PUBLIC_APP_URL=https://build-market-ebon.vercel.app` with scope **Production**.
2. Trigger a new deployment.

### "UPLOAD_PROCESS_INLINE cannot be enabled in production"

**Cause:** `UPLOAD_PROCESS_INLINE=true` is set but `NODE_ENV=production`.

**Fix:** Set `UPLOAD_PROCESS_INLINE=false` in your production environment. File processing must go through the worker queue in production.

### "Redis rate-limit backend requires REDIS_URL or both REDIS_HOST and REDIS_PORT"

**Cause:** `RATE_LIMIT_BACKEND=redis` (or `auto` in production) is configured but Redis connection details are missing.

**Fix (Upstash):**

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

**Fix (connection URL):**

```bash
REDIS_URL=redis://default:password@host:6379
```

**Fix (skip Redis):**

```bash
RATE_LIMIT_BACKEND=memory
```

### Build succeeds but app crashes at first request

This typically means a runtime-only secret is missing. Check the server logs for "Environment validation failed" or "Missing required:" messages. The most common culprits:

- `CLERK_SECRET_KEY` not set in Vercel Production scope
- `ENCRYPTION_KEY_V1` not set
- `AUTH_SECRET` not set

### Clerk sign-in redirects to wrong URL

Check `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`. These should be `/sign-in` and `/dashboard` (relative paths work across all domains and are preferred over absolute URLs).

### `NEXT_RUNTIME` edge detection is wrong

**Do not set `NEXT_RUNTIME` in Vercel environment variables.** It is injected by Next.js automatically. Manually setting it breaks edge runtime detection in `env.ts`, which guards the `assertUploadProcessingModeInvariant` check.

### Preview deployments fail with CORS errors

Add the Vercel preview domain to your CORS/CSRF settings:

```bash
CORS_ALLOWED_ORIGINS=https://build-market-ebon.vercel.app,https://build-market-*.vercel.app
CSRF_TRUSTED_ORIGINS=https://build-market-ebon.vercel.app,https://build-market-*.vercel.app
```

---

## Quick Reference — Minimum Vercel Variable Checklist

Copy this list into a tracking document when setting up a new Vercel project. Check off each item before triggering the first production deployment.

```
Public variables (set before first deploy):
[ ] NEXT_PUBLIC_APP_URL=https://build-market-ebon.vercel.app
[ ] NEXT_PUBLIC_API_URL=https://build-market-ebon.vercel.app/api
[ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

Secret variables (Vercel UI only, never in files):
[ ] CLERK_SECRET_KEY=sk_live_...
[ ] CLERK_WEBHOOK_SECRET=whsec_...
[ ] AUTH_SECRET=<openssl rand -base64 32>
[ ] DATABASE_URL=postgresql://...
[ ] ENCRYPTION_KEY_V1=<openssl rand -hex 32>
[ ] INTERNAL_API_SECRET=<openssl rand -base64 32>

Redis (choose one option):
[ ] UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   ← recommended
[ ] REDIS_URL=redis://...                                ← alternative
[ ] RATE_LIMIT_BACKEND=memory                           ← dev/low-traffic only

CORS/CSRF:
[ ] CORS_ALLOWED_ORIGINS=https://build-market-ebon.vercel.app
[ ] CSRF_TRUSTED_ORIGINS=https://build-market-ebon.vercel.app

Optional but recommended:
[ ] RESEND_API_KEY=re_...
[ ] NEXT_PUBLIC_POSTHOG_KEY=phc_...
[ ] AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY  (if using S3)
```
