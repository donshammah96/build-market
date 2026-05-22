# CI Secrets and Smoke Gate Configuration

This document explains every GitHub Actions secret required by the
`client-preview-smoke-gate` job and the mandatory code-side guard that
prevents BullMQ from attempting connections when `REDIS_URL` is absent.

---

## Why secrets are needed

The `validate` job uses placeholder values for static analysis (lint, type
check, unit tests) because those steps never execute Clerk's runtime SDK.
The `client-preview-smoke-gate` job actually **starts the Next.js server and
sends HTTP requests to it**, which means Clerk's edge middleware processes
every request — including the public root route. Clerk calls
`initPublishableKeyValues()` at request time and throws
`Error: Publishable key not valid` for any key that is not valid base64url,
producing a 500 regardless of whether the route is protected.

Real Clerk test-instance keys are required for the smoke gate. These keys
carry no financial or production data risk — a Clerk development instance is
free and isolated from production.

---

## Required GitHub Actions secrets

Add the following secrets under  
**Repository → Settings → Secrets and variables → Actions → New repository secret**.

| Secret name                | Where to get it                              | Notes                                                 |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `CLERK_CI_PUBLISHABLE_KEY` | Clerk dashboard → API Keys → Publishable key | Must start with `pk_test_`                            |
| `CLERK_CI_SECRET_KEY`      | Clerk dashboard → API Keys → Secret key      | Must start with `sk_test_`; never commit to source    |
| `CLERK_CI_WEBHOOK_SECRET`  | Clerk dashboard → Webhooks → Signing secret  | Must start with `whsec_`; use a dedicated CI endpoint |

### Creating the Clerk CI instance

1. Sign in at <https://dashboard.clerk.com> (free plan is sufficient).
2. Create a new application named **build-market-ci** (or similar).
3. Under **API Keys**, copy the **Publishable key** and **Secret key**.
4. Under **Webhooks**, add a dummy endpoint URL (e.g. `https://example.com/ci`)
   to obtain a signing secret. The endpoint does not need to be reachable —
   the smoke gate never triggers webhook delivery.
5. Add the three values as repository secrets using the names in the table above.

The CI instance does not need a database connection, real users, or any
production configuration. Its sole purpose is to provide keys whose format
passes Clerk's SDK validation.

---

## Why REDIS_URL is intentionally absent from the smoke gate

BullMQ uses ioredis under the hood. When `REDIS_URL` is set to **any**
hostname, ioredis immediately attempts a TCP connection during job-orchestrator
startup — before any HTTP requests are served. If the hostname does not resolve
in public DNS (as with `stub.upstash.io`), every connection attempt throws
`getaddrinfo ENOTFOUND`, ioredis enters a reconnect loop, and the server
output is flooded with:

```bash
[Redis:BullMQ] Reconnect attempt N in 500ms
```

This does not necessarily crash the process, but it destabilises the startup
sequence and can cause the smoke curl loop to see a 500 or a connection refusal
during the reconnect window.

**The fix:** omit `REDIS_URL` from the smoke gate entirely.
`envConfig.redis.url` will be `undefined`, and the job orchestrator must
guard against this (see below).

---

## Required code-side guard: job orchestrator

The job orchestrator must not attempt BullMQ initialisation when
`envConfig.redis.url` is absent or when running in CI. Without this guard,
even the absence of `REDIS_URL` is insufficient — some versions of the
orchestrator reference `new Queue(...)` at module evaluation time, which
would throw before the guard can fire.

Apply the following pattern at the top of the orchestrator's initialisation
function (the exact filename depends on your slice — typically
`app/jobs/orchestrator.ts` or similar):

```typescript
import { envConfig } from "@/app/lib/infrastructure/env";

export function initializeJobOrchestrator(): void {
  // Guard 1: BullMQ requires a Redis TCP endpoint. Skip entirely when
  // REDIS_URL is not configured (local dev without Redis, CI smoke gate).
  if (!envConfig.redis.url) {
    console.info("[jobs] REDIS_URL not set — background job queues disabled.");
    return;
  }

  // Guard 2: Belt-and-suspenders for CI environments that set
  // DISABLE_BACKGROUND_JOBS=true explicitly.
  if (envConfig.isCI && process.env.DISABLE_BACKGROUND_JOBS === "true") {
    console.info(
      "[jobs] DISABLE_BACKGROUND_JOBS=true — skipping queue initialisation in CI.",
    );
    return;
  }

  // ... BullMQ Queue / Worker / Scheduler setup below this point
}
```

`envConfig.isCI` is already defined in `env.ts`:

```typescript
isCI: getBooleanEnv("CI"),
```

GitHub Actions automatically injects `CI=true` into every job, so no
additional configuration is needed for this flag.

---

## Upstash REST stubs (UPSTASH_REDIS_REST_URL / TOKEN)

These values are present in the smoke gate env as stubs. They are **not**
called at runtime when `RATE_LIMIT_BACKEND=memory`:

- `env.ts` only adds the `redis` group to `startupGroups` when
  `isRedisRateLimitBackendRequired` returns `true` (production mode or
  explicit `RATE_LIMIT_BACKEND=redis`). With `memory`, the redis group is
  skipped entirely, so no format validation is run against these values.
- The `@upstash/ratelimit` REST client is never initialised in `memory` mode.
- The values are stored in `envConfig.redis.upstashRestUrl /
upstashRestToken` but nothing reads them during a smoke-gate request.

The stubs satisfy the env-contract checker without making any outbound HTTP
connections.

---

## Summary of changes made in this fix

| File                              | Change                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| `.github/workflows/ci.yml`        | Smoke gate Clerk keys → `${{ secrets.CLERK_CI_* }}`                     |
| `.github/workflows/ci.yml`        | Removed `REDIS_URL` from smoke gate env                                 |
| `.github/workflows/ci.yml`        | Added `DISABLE_BACKGROUND_JOBS: "true"` to smoke gate env               |
| `.github/workflows/ci.yml`        | Renamed `UPSTASH_REDIS_REST_URL` stub to `stub-ci.upstash.io` (clarity) |
| `app/jobs/orchestrator.ts` (user) | Add `envConfig.redis.url` guard before BullMQ initialisation            |
| `apps/client/docs/CHANGELOG.md`   | Add fix entry under `Fixed` + `Security`                                |

---

## Verification

After adding the three secrets and pushing the updated `ci.yml`, the
`client-preview-smoke-gate` job should:

1. Build successfully (same as before).
2. Start the Next.js server without BullMQ reconnect loop noise.
3. Receive a non-5xx response from `http://127.0.0.1:3500/`.
4. Exit with `Smoke gate passed`.

If the smoke gate still returns 500 after adding the secrets, check the
server log output (`/tmp/client-preview-smoke.log`) for the specific error.
Common follow-on causes: a database initialisation module that throws when
`DATABASE_URL` points to a nonexistent host, or a startup invariant in
`assertUploadProcessingModeInvariant` that fires when `UPLOAD_PROCESS_INLINE`
is absent. Both are silenced by the guards in `env.ts` but may exist in other
startup paths.
