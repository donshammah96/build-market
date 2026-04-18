# Build Market Client

The Client app is the primary web surface for Build Market users (homeowners, professionals, and authenticated account flows). It is a Next.js App Router service in the monorepo, with API routes, auth integration, and operational health endpoints in the same deployable unit.

Use this document for two things:

- onboarding a new engineer quickly and safely;
- running and operating the service in development and production.

---

## Service Snapshot

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Package manager:** pnpm (workspace)
- **Default local port:** `3500`
- **App root:** `apps/client`
- **Important integrations:** Clerk auth, Postgres, Redis, NATS, optional messaging/notification services

Related deeper docs:

- API catalog: `apps/client/app/api/API.md`
- API architecture: `apps/client/app/lib/API_ARCHITECTURE.md`
- Health endpoint behavior: `apps/client/app/api/health/README.md`
- Cypress test guide: `apps/client/cypress/README.md`

---

## New Engineer Onboarding (First Day Plan)

### 1) Prerequisites

From repo root:

```bash
node -v
pnpm -v
```

Expected:

- Node `>=20`
- pnpm `>=10`

Install dependencies once at repo root:

```bash
pnpm install
```

### 2) Environment Setup

From `apps/client`:

1. Copy `apps/client/.env.example` to your local secret file (typically `.env` or `.env.local`).
2. Optionally use `apps/client/.env.local.example` for personal overrides.
3. Never commit real secrets.

Minimum set to boot cleanly:

- Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- `AUTH_SECRET`
- `DATABASE_URL`
- Redis connection (`REDIS_URL` or host/port settings)
- `INTERNAL_API_SECRET`

### 3) Run Locally

From repo root (recommended):

```bash
pnpm dev:client
```

Alternative from app directory:

```bash
pnpm --filter client dev
```

Open [http://localhost:3500](http://localhost:3500).

### 4) Verify Local Health

Use the service probes:

```bash
curl http://localhost:3500/api/health/live
curl http://localhost:3500/api/health/ready
curl http://localhost:3500/api/health
```

Interpretation:

- `/live` should return `200` if process is alive.
- `/ready` should return `200` only when critical dependencies are ready.
- `/health` returns detailed dependency state (`200` healthy, `207` degraded, `503` unhealthy).

### 5) Baseline Quality Checks

From repo root:

```bash
pnpm lint
pnpm check-types
pnpm test
```

Client-focused test commands:

```bash
pnpm --filter client test
pnpm --filter client test:coverage
pnpm --filter client test:e2e
```

### 6) Orientation Map (Where To Look First)

- **Pages and routes:** `apps/client/app`
- **API handlers:** `apps/client/app/api`
- **Reusable UI and feature components:** `apps/client/components`
- **Client-side helpers/hooks:** `apps/client/hooks`, `apps/client/lib`
- **Testing:** `apps/client/__tests__`, `apps/client/cypress`

### 7) First Week Expectations

- Be able to run client + tests locally without support.
- Understand auth flow and top API domains in `app/api`.
- Ship one low-risk change with tests and health-check validation.

---

## Operations Runbook

### Standard Commands

From repo root:

```bash
pnpm dev:client
pnpm --filter client build
pnpm --filter client start
pnpm --filter client lint
pnpm --filter client check-types
pnpm --filter client test
```

### Cloudflare Worker Deployment

This repository uses an explicit Wrangler config in `apps/client` so the
OpenNext Cloudflare build stays non-interactive in CI and does not prompt to
create missing config files.

From repo root:

```bash
pnpm run client:build:cloudflare-worker
pnpm run client:deploy:cloudflare-worker
```

Deployment contract:

- Worker entrypoint: `.open-next/worker.js` (relative to `apps/client`)
- Worker assets: `.open-next/assets` (relative to `apps/client`)
- Wrangler config: `apps/client/wrangler.toml`
- Build command: `opennextjs-cloudflare build --config wrangler.toml --skipWranglerConfigCheck`

The explicit `--config` and `--skipWranglerConfigCheck` flags ensure Cloudflare
custom builds do not block on interactive confirmation when running in
non-interactive CI environments.

### Runtime Health and Probes

Primary endpoints:

- `GET /api/health/live` -> process liveness
- `GET /api/health/ready` -> readiness for traffic (critical deps)
- `GET /api/health` -> full dependency audit
- `GET /api/health?shallow=true` -> fast DB-focused check

Operational guidance:

- Use `/ready` for load balancer target health.
- Use `/health` for dashboards and on-call diagnostics.
- Alert on `503` immediately; investigate `207` as degraded behavior.

### Incident Triage (Fast Path)

1. **Confirm blast radius**
   - Check `/api/health/ready` and `/api/health`.
2. **Classify**
   - `503`: likely critical dependency (database path) issue.
   - `207`: non-critical dependency degraded (for example Redis/messaging/notifications).
3. **Correlate**
   - Capture correlation IDs from API responses/logs.
4. **Mitigate**
   - Rollback latest release if regression is suspected.
   - Reduce traffic, disable optional features, or fail over dependencies as available.
5. **Verify recovery**
   - Ensure readiness stable at `200` before restoring normal traffic.

### Deploy Verification Checklist

After each deployment:

```bash
curl -fsS https://<client-host>/api/health/live
curl -fsS https://<client-host>/api/health/ready
curl -fsS https://<client-host>/api/health
```

Also verify:

- core authenticated flow (sign-in + dashboard entry),
- one write path (for example onboarding step or profile update),
- error budget signals are stable (latency, error rate, saturation).

### Routine Maintenance

Security and crypto scripts (from `apps/client`):

```bash
pnpm migrate:gdpr:dry
pnpm migrate:gdpr
pnpm rotate:keys:dry
pnpm rotate:keys
```

Use dry-run first in non-production and production-like environments.

---

## Change Management Guidelines

- Keep API responses backward-compatible unless an explicit versioning plan exists.
- Add/update tests for behavior changes (unit + integration; e2e for user-critical paths).
- Prefer resilient API helpers and middleware patterns documented in `app/lib/API_ARCHITECTURE.md`.
- Keep observability intact: correlation IDs, health checks, and structured error responses.

---

## Troubleshooting

- **Port conflict on `3500`:** stop the conflicting process or adjust local run command.
- **Auth failures locally:** verify Clerk publishable/secret keys and redirect URLs.
- **Readiness fails (`503`):** validate database/Redis connectivity and env values first.
- **E2E flakiness:** use guidance in `apps/client/cypress/README.md` and run in headed mode for debugging.

---

## Ownership

If this runbook is missing operational detail discovered during an incident, update this file in the same PR as the fix. The README is expected to evolve with the service.
