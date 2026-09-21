# Supabase Integration Plan — `build-market` Monorepo

> **Scope:** `packages/db` (Prisma client + schema), `apps/client` and `apps/admin` env
> boundaries, `.env.example`, `.env.vercel.example`, Vercel dashboard setup,
> and the Supabase CLI migration workflow.

---

## Background & Decision

Your Supabase project is already provisioned (`ewbnznoprzlqtcoxvjai`). The
work is: **wire it in correctly** across Prisma, the env boundary, the Supabase
CLI, and Vercel — with naming conventions that survive the team growing.

---

## 1. The Two-URL Architecture (Non-negotiable)

Supabase exposes **two** Postgres connection strings and you must use both:

| Variable       | URL format                                                                                                 | Used by                                              | Why                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true` | Prisma at **runtime** (Next.js serverless)           | PgBouncer transaction-mode pooler — safe for short-lived serverless connections |
| `DIRECT_URL`   | `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres`                                  | Prisma **migrations only** (`prisma migrate deploy`) | Bypasses PgBouncer; required for DDL statements and `_prisma_migrations` table  |

> [!IMPORTANT]
> Your current `.env.example` has `DIRECT_CONNECTION_STRING` — rename it to
> `DIRECT_URL`. That is the exact env var name Prisma's `datasource.directUrl`
> reads. Diverging causes silent fallback to `DATABASE_URL` for migrations,
> which will fail on `ALTER TYPE`, `CREATE EXTENSION`, and migration history
> operations against a pooled connection.

---

## 2. Schema Changes — `packages/db/prisma/schema.prisma`

### 2a. Datasource Block

```diff
datasource db {
  provider   = "postgresql"
  extensions = [citext]
+ url        = env("DATABASE_URL")
+ directUrl  = env("DIRECT_URL")
}
```

The `url` field already exists implicitly because Prisma falls back to
`process.env.DATABASE_URL`. Making it **explicit** in the schema is required
once you add `directUrl` — Prisma's config validator requires both to be
explicit when `directUrl` is present.

### 2b. Enable `pgBouncer` in `DATABASE_URL`

Supabase's transaction-mode pooler requires the `pgbouncer=true` query parameter
**in the connection string**, not a Prisma config flag. Your `DATABASE_URL`
must look like:

```markdown
postgresql://postgres.ewbnznoprzlqtcoxvjai:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Find your pooler URL in Supabase Dashboard → Project Settings → Database →
Connection String → **Transaction** mode.

### 2c. `citext` Extension

Your schema already declares `extensions = [citext]`. Supabase enables this
automatically for new projects — no action required. If it is missing:

```bash
# In Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS citext;
```

---

## 3. Env Variable Naming Conventions

### Canonical Names (apply everywhere)

```bash
# ── Supabase / PostgreSQL ───────────────────────────────────────────────────
# Pooled (transaction mode) — runtime use by Next.js/Prisma serverless
DATABASE_URL="postgresql://postgres.ewbnznoprzlqtcoxvjai:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct (session mode) — Prisma migrations only, never used at runtime
DIRECT_URL="postgresql://postgres:PASSWORD@db.ewbnznoprzlqtcoxvjai.supabase.co:5432/postgres"

# Supabase project metadata (for Supabase client SDK if used, or CLI)
SUPABASE_URL="https://ewbnznoprzlqtcoxvjai.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_lGQqC2_NKZJQKumuHSnQgA_VqqIp3S0"

# Service role key — server-side only, NEVER expose to browser
# Get from: Supabase Dashboard → Project Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY=""
```

> [!CAUTION]
> `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It must only be
> used in server-side code, must be in `BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS`,
> and must never be prefixed with `NEXT_PUBLIC_`. Keep it optional for now
> (you are not using the Supabase SDK client directly yet — Prisma is your
> data access layer).

### Variables to Remove/Rename

| Old name                           | Action                       | Reason                                             |
| ---------------------------------- | ---------------------------- | -------------------------------------------------- |
| `DIRECT_CONNECTION_STRING`         | Rename → `DIRECT_URL`        | Prisma's `directUrl` reads `DIRECT_URL`            |
| `SUPABASE_PROJECT_URL`             | Rename → `SUPABASE_URL`      | Matches Supabase SDK and CLI convention            |
| `SUPABASE_PUBLISHABLE_KEY`         | Rename → `SUPABASE_ANON_KEY` | Matches Supabase SDK convention                    |
| `SUPABASE_CLI_CONNECTION_COMMANDS` | **Delete**                   | Not an env var — CLI commands                      |
| `POSTGRES_URL`                     | Keep as optional alias       | Vercel Postgres integration injects this; harmless |

---

## 4. Prisma Client Hardening for PgBouncer

Your current `packages/db/lib/prisma.ts` uses `@prisma/adapter-pg` which is
correct for the Supabase pooler. One addition needed:

```diff
// packages/db/lib/prisma.ts
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

-const connectionString = `${process.env.DATABASE_URL}`;
+// Use the pooled DATABASE_URL at runtime.
+// DIRECT_URL is only consumed by `prisma migrate deploy` — never at runtime.
+const connectionString = process.env.DATABASE_URL;
+if (!connectionString) {
+  throw new Error(
+    "DATABASE_URL is not set. Set it to the Supabase transaction-mode pooler URL.",
+  );
+}

const pool = new Pool({
  connectionString,
+ // PgBouncer transaction mode: disable prepared statements (not supported).
+ // Prisma's pg adapter handles this automatically when pgbouncer=true is in
+ // the connection string, but the explicit flag is belt-and-suspenders.
+ max: 1, // Serverless: one connection per function invocation is sufficient
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> [!NOTE]
> `max: 1` is intentional for serverless. Each Vercel function invocation is
> ephemeral; Supabase's pooler manages the actual Postgres connections. Setting
> `max > 1` wastes memory and can cause connection storms in high-concurrency
> deployments.

---

## 5. `packages/db/prisma.config.ts` Update

Add `directUrl` support:

```diff
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
+   directUrl: process.env.DIRECT_URL,
  },
});
```

---

## 6. Supabase CLI Migration Workflow

### One-time Setup (already provisioned)

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Authenticate
supabase login

# 3. Link to your project (run from monorepo root or packages/db)
supabase link --project-ref ewbnznoprzlqtcoxvjai
# → Prompts for database password
```

### Where to Store Supabase Config

The Supabase CLI generates a `supabase/` directory. Place it at the **monorepo
root** (not inside `packages/db`), since it manages project-level config:

```markdown
build-market/
├── supabase/ ← Supabase CLI home
│ ├── config.toml ← Project config (commit this)
│ └── .gitignore ← Contains access tokens (don't commit)
├── packages/db/
│ ├── prisma/
│ │ ├── schema.prisma
│ │ └── migrations/ ← Prisma migration history (commit this)
```

> [!IMPORTANT]
> **Use Prisma for schema migrations, not the Supabase CLI migration system.**
> You already have a Prisma migration history (`20260119120434_init`). Mixing
> two migration tools on the same schema creates drift. The Supabase CLI's
> migration system is an alternative — pick one and stick with it. Given your
> existing Prisma history, **Prisma is the right choice**.

### Deploying Migrations to Supabase

```bash
# From packages/db (uses DIRECT_URL to bypass PgBouncer)
pnpm -C packages/db exec prisma migrate deploy
```

Add this as a script:

```json
// packages/db/package.json — add to "scripts"
{
  "db:migrate:deploy": "prisma migrate deploy",
  "db:migrate:dev": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:seed": "prisma db seed",
  "db:reset": "prisma migrate reset",
  "db:studio": "prisma studio"
}
```

And in the root `package.json`:

```json
{
  "db:migrate": "pnpm -C packages/db run db:migrate:deploy",
  "db:migrate:dev": "pnpm -C packages/db run db:migrate:dev"
}
```

### Creating a New Migration (local dev)

```bash
# From packages/db, with DIRECT_URL pointing to local Postgres or Supabase
pnpm -C packages/db run db:migrate:dev --name <descriptive_snake_case_name>
```

**Migration naming convention:**

```bash
YYYYMMDDHHMMSS_<verb>_<noun>[_<qualifier>]

# Examples:
20260430000001_add_professional_rating_column
20260430000002_create_mpesa_webhook_table
20260430000003_drop_legacy_refresh_token_table
20260430000004_add_index_user_clerk_id
```

---

## 7. Row Level Security (RLS) Posture

Supabase enables RLS by default on new tables. Since your app accesses Postgres
exclusively via **Prisma with the service-role-equivalent `postgres` user** (not
the Supabase anon client), RLS does not apply to your runtime queries.

**You do not need RLS policies today.** Document this explicitly:

```sql
-- In a future migration if you add Supabase realtime or direct anon access:
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- For now: all access is via Prisma server-side with postgres superuser.
-- RLS is intentionally not enabled.
```

> [!NOTE]
> If you ever add Supabase Realtime subscriptions or the Supabase JS client
> with the anon key, you **must** enable RLS on every table before that feature
> ships. File an ADR at that point.

---

## 8. Vercel Environment Variables

In the Vercel dashboard (Settings → Environment Variables), set:

| Variable                    | Value                                      | Environments        |
| --------------------------- | ------------------------------------------ | ------------------- |
| `DATABASE_URL`              | Pooled URL with `?pgbouncer=true`          | Production, Preview |
| `DIRECT_URL`                | Direct URL (port 5432)                     | Production, Preview |
| `SUPABASE_URL`              | `https://ewbnznoprzlqtcoxvjai.supabase.co` | Production, Preview |
| `SUPABASE_ANON_KEY`         | Your anon/publishable key                  | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (mark sensitive)          | Production only     |

> [!WARNING]
> Do **not** add `DIRECT_URL` to the Vercel runtime environment for edge
> functions. It is only needed during `prisma migrate deploy` (a build-time
> or CI step), not at request time. Vercel's build step can access it if you
> add it to the "Build" environment scope.

---

## 9. `.env.example` & `.env` Updates

### `.env.example` (committed, no real secrets)

```bash
# ============================================
# Database [REQUIRED]
# Supabase: use TRANSACTION pooler URL for runtime, DIRECT_URL for migrations.
# ============================================

# Runtime — Supabase transaction-mode pooler (PgBouncer)
# Get from: Supabase Dashboard → Project Settings → Database → Connection String → Transaction
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Migrations only — direct connection, bypasses PgBouncer
# Get from: Supabase Dashboard → Project Settings → Database → Connection String → Session
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"

# Vercel Postgres alias (auto-injected by Vercel Postgres integration, if used)
POSTGRES_URL=""

# ============================================
# Supabase [OPTIONAL — for Supabase SDK / Realtime]
# ============================================
SUPABASE_URL="https://PROJECT_REF.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_..."
# Server-side only — never expose to browser
SUPABASE_SERVICE_ROLE_KEY=""
```

---

## 10. Env Boundary Update (`apps/client/app/lib/infrastructure/env.ts`)

Add `DIRECT_URL` to the `database` env group (optional, since it's only used by
the Prisma CLI, not the Next.js runtime) and add the Supabase variables:

```diff
// In the "database" envGroup:
{
  name: "database",
  variables: [
    {
      name: "DATABASE_URL",
      required: true,
      validate: (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
      errorMessage: "Must be a valid PostgreSQL connection string (use Supabase pooler URL)",
    },
+   {
+     name: "DIRECT_URL",
+     required: false, // Only needed by Prisma CLI, not at runtime
+     validate: (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
+     errorMessage: "Must be a valid PostgreSQL connection string (Supabase direct URL)",
+   },
    { name: "POSTGRES_URL", required: false },
  ],
},

// New "supabase" envGroup:
+{
+  name: "supabase",
+  description: "Supabase project credentials",
+  variables: [
+    { name: "SUPABASE_URL", required: false },
+    { name: "SUPABASE_ANON_KEY", required: false },
+    {
+      name: "SUPABASE_SERVICE_ROLE_KEY",
+      required: false,
+      // Never required in env boundary — only used by specific server-side modules.
+    },
+  ],
+},
```

Also expose in `buildEnvConfig()`:

```diff
// Database
databaseUrl: getOptionalStringEnv("DATABASE_URL"),
+directUrl: getOptionalStringEnv("DIRECT_URL"),
postgresUrl:
  getOptionalStringEnv("POSTGRES_URL") ??
  getOptionalStringEnv("DATABASE_URL"),

+// Supabase
+supabase: {
+  url: getOptionalStringEnv("SUPABASE_URL"),
+  anonKey: getOptionalStringEnv("SUPABASE_ANON_KEY"),
+  serviceRoleKey: getOptionalStringEnv("SUPABASE_SERVICE_ROLE_KEY"),
+},
```

---

## 11. `packages/db/.env` (local dev, gitignored)

Create/update this file (it is read by `prisma.config.ts` via `loadEnv()`):

```bash
# packages/db/.env — gitignored, real credentials for local dev
DATABASE_URL="postgresql://postgres.ewbnznoprzlqtcoxvjai:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.ewbnznoprzlqtcoxvjai.supabase.co:5432/postgres"
```

---

## 12. Phased Rollout Sequence

### Phase 1 — Env & Config (no code risk, do this now)

1. Rename env vars in `.env.example` per §3 above.
2. Update `packages/db/prisma/schema.prisma` datasource per §2a.
3. Update `packages/db/prisma.config.ts` per §5.
4. Set `DATABASE_URL` and `DIRECT_URL` in `packages/db/.env`.
5. Run `pnpm -C packages/db exec prisma generate` — confirm zero errors.

### Phase 2 — Apply Schema to Supabase (migration)

```bash
# Ensure DIRECT_URL is set in packages/db/.env
pnpm -C packages/db exec prisma migrate deploy
```

This pushes the existing `20260119120434_init` migration to Supabase's
`_prisma_migrations` table. Verify in Supabase → Table Editor that all 66
models are present.

### Phase 3 — Smoke Test

```bash
# Verify Prisma can reach Supabase via the pooler
pnpm -C packages/db exec prisma db execute --stdin <<< \
  "SELECT count(*) FROM \"SystemSettings\";"

# Run the full client test suite
pnpm -C apps/client exec vitest run __tests__/api/internal/ --reporter=verbose
```

### Phase 4 — Vercel Wiring

Set `DATABASE_URL` and `DIRECT_URL` in Vercel dashboard (§8). Trigger a
deployment. Confirm no P1001 errors in Vercel function logs.

### Phase 5 — Update env contract check

```bash
pnpm run client:check-env-contract
# Verify DIRECT_URL and SUPABASE_* variables pass the contract check
```

---

## 13. What to Skip

| Thing                   | Verdict                                              |
| ----------------------- | ---------------------------------------------------- |
| Supabase Auth           | Skip — Clerk is your identity provider (ADR-001)     |
| Supabase Storage        | Skip — S3/local storage is already wired             |
| Supabase Realtime       | Skip for now — no real-time features currently       |
| Supabase CLI migrations | Skip — use Prisma migrations (existing history)      |
| RLS policies            | Skip for now — Prisma uses superuser; no anon access |
| Supabase Edge Functions | Skip — Vercel Edge Functions is your runtime         |

---

## Verification Gates

```bash
# 1. Type-check after datasource changes
pnpm run client:check-types

# 2. Migration deployed successfully
pnpm -C packages/db exec prisma migrate status
# → All migrations: Applied ✓

# 3. No env contract regressions
pnpm run client:check-env-contract

# 4. Internal API test suite
pnpm -C apps/client exec vitest run __tests__/api/internal/ --reporter=verbose
# → 3 files, 14 tests, all pass
```
