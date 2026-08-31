# Build Market - M-Pesa (Daraja) Integration

**Status:** In Progress - implementation hardening pass
**Last updated:** 2026-08-31
**Owner:** Build Market platform team
**Decision type:** Architecture and implementation plan

## Executive decision

Build Market will use a provider-only `packages/mpesa` library and keep all
Daraja API calls in `apps/workers`. `apps/client` remains the public edge and
creates authenticated payment intents, receives thin provider callbacks, and
produces typed BullMQ jobs. `apps/admin` can authorize and enqueue B2C payout
commands but cannot call Daraja or hold provider credentials.

This is the governing design for the implementation. It is deliberately
different from the first draft in three important ways:

1. There is no client-side or Vercel-side STK exception. The request is
   asynchronous: create the local intent, enqueue the worker command, and
   return a local transaction handle.
2. BullMQ is the command and retry mechanism. NATS JetStream remains reserved
   for domain events and is not used as a second payment command path.
3. A callback is a receipt, not the source of identity. Correlation, a unique
   callback-event record, conditional state transitions, and replay-safe
   settlement are required before any financial side effect.

The Daraja portal is the authoritative source for the live provider contract.
Before sandbox or production enablement, verify the current endpoint paths,
callback shapes, shortcode capabilities, credential products, certificate
algorithm, callback source guidance, rate limits, and go-live requirements in
the [Safaricom Developer Portal](https://developer.safaricom.co.ke/).

## Current implementation status

The code changes in this branch implement the first vertical slices and leave
explicit gates for work that must not be represented as production-ready:

- STK subscription checkout is queued from the authenticated client portal.
- Daraja HTTP contracts, OAuth caching, STK initiation/query, B2C initiation,
  Kenyan phone normalization, and SecurityCredential encryption are centralized
  in `@build/mpesa`.
- Public STK and B2C callback routes validate, correlate, redact, hash, persist
  a callback receipt, and enqueue worker processing.
- STK subscription settlement and B2C payout result processing are worker-only
  and idempotency-aware.
- Admin B2C payout enqueueing is capability-gated, recently-authenticated,
  audited, amount-bounded, and idempotent.
- Lead-credit, escrow, C2B, reversal, full transaction-status reconciliation,
  admin requery/reversal UI, and live provider onboarding remain gated work.

## Second-pass hardening decisions

### Trust boundaries

| Runtime                 | Allowed responsibility                                                                                      | Forbidden responsibility                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/client`           | Authenticated payment-intent creation; public callback receipt; user-scoped status reads; BullMQ production | Daraja credentials, direct provider calls, settlement side effects, raw callback logging |
| `apps/workers`          | BullMQ consumers; OAuth; STK/B2C provider calls; callback settlement; reconciliation                        | Public HTTP callback exposure; user authorization decisions                              |
| `apps/admin`            | Capability-checked, audited payout commands; operational views                                              | Provider calls; provider secrets; direct Prisma from action files                        |
| `packages/mpesa`        | Provider schemas, normalization, encryption, HTTP client                                                    | Prisma, app imports, UI imports, business settlement                                     |
| `packages/queue-server` | Queue names, payload contracts, stable job IDs, producers                                                   | Provider calls or business settlement                                                    |

Provider secrets are Class A secrets. No `NEXT_PUBLIC_MPESA_*` variables are
permitted. B2C initiator credentials and certificates exist only in the
worker runtime. A provider IP allowlist, if available, is defense in depth;
it is not callback authenticity because provider callbacks are not assumed to
carry an application-verifiable signature.

### Idempotency model

Every layer has a stable identity:

1. The client supplies an opaque idempotency key with bounded length.
2. The database stores a deterministic, user/plan/interval-scoped key with a
   unique constraint.
3. The queue producer uses a stable job ID derived from the local resource.
4. Provider identifiers are unique when available.
5. Each callback gets a unique provider-event key, SHA-256 payload hash, and a
   redacted persisted receipt before processing.
6. Worker handlers must be safe on retries and must not reopen a reversed,
   refunded, cancelled, or completed payment.
7. Financial ledger writes must use a provider receipt/transaction unique key
   or an equivalent conditional upsert. A callback being delivered twice must
   not extend a subscription or create a second payout ledger entry.

### State transition contract

| Current state                       | Provider outcome       | Allowed result | Notes                                              |
| ----------------------------------- | ---------------------- | -------------- | -------------------------------------------------- |
| `PENDING`                           | initiation accepted    | `PROCESSING`   | Provider call is worker-only                       |
| `PENDING`                           | initiation rejected    | `FAILED`       | Retry only under explicit retry policy             |
| `PROCESSING`                        | callback/query success | `SUCCESS`      | Settle once, in one DB transaction                 |
| `PROCESSING`                        | callback/query failure | `FAILED`       | Preserve provider code/description                 |
| `SUCCESS`, `COMPLETED`              | duplicate failure      | unchanged      | Never regress a settled payment                    |
| `REVERSED`, `REFUNDED`, `CANCELLED` | any duplicate callback | unchanged      | Reversal/refund authority wins                     |
| any                                 | unknown callback       | unchanged      | Acknowledge, log metadata only, no record creation |

`TIMEOUT` is a user-facing read-model result for an old non-terminal local
transaction, not a database settlement status. It must never cause a second
payment attempt automatically.

## Repository shape and interfaces

Implemented or required paths are intentionally explicit:

```text
packages/mpesa/
  src/client.ts                 # OAuth, STK initiate/query, B2C initiate
  src/schemas.ts                # strict provider response/callback contracts
  src/security.ts               # SecurityCredential encryption
  src/phone.ts                  # Kenyan MSISDN normalization/redaction
  src/callback.ts               # event identity and payload hashing
  src/errors.ts                 # typed retryable/non-retryable provider errors

packages/queue-server/src/
  mpesa-queue-contracts.ts      # names, payloads, stable identities
  mpesa.queue.ts                # BullMQ producers and retry policy

apps/client/app/api/v1/subscriptions/checkout/route.ts
apps/client/app/api/v1/payments/mpesa/status/route.ts
apps/client/app/api/webhooks/mpesa/stk-callback/route.ts
apps/client/app/api/webhooks/mpesa/b2c-result/route.ts
apps/client/app/api/webhooks/mpesa/b2c-timeout/route.ts
apps/client/app/lib/domains/payments/mpesa-callback.ts
apps/client/app/lib/domains/subscriptions/{checkout,repository,service}.ts

apps/workers/src/processors/
  mpesa-stk.processor.ts
  mpesa-b2c.processor.ts
apps/workers/src/env.ts

apps/admin/src/actions/admin/mpesa.ts
apps/admin/src/lib/domains/mpesa/{contracts,policy,repository,service}.ts

packages/db/prisma/schema.prisma
packages/db/prisma/migrations/20260831060000_mpesa_hardening/migration.sql
```

The provider client must remain free of Prisma and framework imports. Its
public methods are the minimum provider surface:

```ts
createMpesaClient(options): MpesaClient
MpesaClient.initiateStkPush(input)
MpesaClient.queryStkPush(input)
MpesaClient.initiateB2c(input)
normalizeKenyanPhone(input): string
encryptSecurityCredential(password, certificatePem): string
createProviderEventKey(type, identifiers): string
hashCallbackPayload(rawBody): string
```

## Database and migration plan

The existing `MpesaTransaction`, `MpesaB2C`, and `ProfessionalTransaction`
models remain the source of truth. The hardening migration adds:

- transaction callback event count and structured metadata;
- a required/backfilled B2C idempotency key;
- B2C callback/retry fields and operational indexes;
- `MpesaCallbackEvent` with unique provider event key, callback type,
  correlation fields, payload hash, redacted payload, processing state, and
  timestamps.

Migration sequencing:

1. Deploy the additive migration and generate the Prisma client.
2. Verify the B2C idempotency backfill has no duplicates before enforcing the
   unique index.
3. Deploy code with `MPESA_ENABLED=false` and `MPESA_B2C_ENABLED=false`.
4. Verify queue connectivity, callback route health, redaction, and worker
   boot validation.
5. Enable sandbox STK only; then enable B2C only after payout approval tests.
6. Roll back code independently if needed. Do not roll back the migration
   after new callback receipts exist; the additive schema is the rollback
   compatibility boundary.

## Implementation phases and checklist

- [x] **Phase 0 - architecture/security second pass.** Worker-only provider
      calls, public thin callbacks, BullMQ command boundary, secret boundary,
      idempotency model, and state rules are recorded here.
- [x] **Phase 1 - provider package and contracts.** `@build/mpesa` contains
      OAuth/token caching, STK initiate/query, B2C initiate, phone normalization,
      response schemas, error classification, callback identity, and certificate
      encryption. External Daraja contract verification is still a release gate.
- [x] **Phase 2 - subscription STK vertical slice.** Authenticated checkout
      intent, amount calculation, deterministic idempotency, queue production,
      status endpoint, worker initiation, callback receipt, and subscription
      settlement are implemented. Full sandbox round-trip evidence is pending.
- [x] **Phase 3a - callback receipt and worker result path.** STK and B2C
      callbacks correlate first, persist redacted receipts/hashes, and enqueue
      stable jobs. Worker result handlers preserve terminal states.
- [x] **Phase 4a - admin payout command.** Payout amount/phone policy,
      `PROCESS_PAYOUTS` capability, recent authentication, operation registry,
      declarative policy, audit metadata, DB idempotency, and B2C queue production
      are implemented. Admin review/requery UI is pending.
- [ ] **Phase 3b - production reconciliation.** Add scheduled pending sweeps,
      provider query handling, receipt-aware settlement, retry ceilings, stale
      event recovery, and metrics/alerts. The queue contract exists; the complete
      reconciliation consumer is not yet shipped.
- [ ] **Phase 4b - financial domain coverage.** Implement and test escrow
      funding, lead-credit ledger settlement, C2B validation/confirmation,
      reversals/refunds, and payout failure/retry policy. These are not implied by
      the current subscription/payout slices.
- [ ] **Phase 5 - operational controls.** Add admin read-only transaction
      search, safe requery/reversal actions, break-glass approval controls,
      dashboards, alerts, runbooks, and provider incident procedures.
- [ ] **Phase 6 - provider onboarding and go-live.** Complete portal setup,
      shortcode/product confirmation, certificate and credential validation,
      callback registration, sandbox evidence, secret rotation rehearsal, live
      smoke payment, and staged traffic enablement.

## Detailed staff-level execution plan

### Workstream A - provider package

1. Keep all Daraja URL construction, Basic auth, bearer auth, timeout, response
   validation, and error classification in `packages/mpesa/src/client.ts`.
2. Use a short-lived in-memory token cache per worker process with a safety
   window. On provider 401, invalidate and retry once at the worker policy
   layer; never loop indefinitely.
3. Keep credentials and plaintext initiator passwords out of return values,
   logs, errors, snapshots, and callback payloads.
4. Verify the exact SecurityCredential certificate/padding contract against the
   current Daraja documentation and a sandbox request before production.
5. Add fixture tests for malformed OAuth/STK/B2C responses, non-2xx responses,
   abort timeouts, invalid phone numbers, oversized references, and certificate
   failures.

### Workstream B - queue and worker execution

1. Keep all queue names and payload types in
   `packages/queue-server/src/mpesa-queue-contracts.ts`.
2. Use stable job IDs for initiate and callback jobs; preserve failed jobs for
   operational inspection and bound attempts/backoff.
3. Register payment workers only in `apps/workers/src/index.ts`. The client
   and admin apps may import producers but must never instantiate `Worker`.
4. Split reconciliation into its own queue/worker with concurrency one per
   account/shortcode. A sweep must select only old `PROCESSING` records with a
   provider request ID, cap the batch, and record the sweep outcome.
5. Use an event claim/lease or equivalent conditional update before settlement;
   release/retry a claim after failure and recover stale claims. Upsert ledger
   entries by provider receipt/transaction ID.
6. Emit redacted structured metrics: initiation accepted/rejected, callback
   receipt/processing latency, duplicate callback count, reconciliation count,
   B2C success/failure, retry exhaustion, and unknown-correlation count.

### Workstream C - client checkout and callbacks

1. `POST /api/v1/subscriptions/checkout` must authenticate through the existing
   professional portal adapter, validate a native enum plan/interval, require
   a bounded idempotency key, and use DB plan prices only.
2. Return the local `transactionId` as the tracking handle until Daraja returns
   `CheckoutRequestID`; never fabricate provider IDs.
3. Return private/no-store responses for payment status and callback routes.
   Status reads must resolve the DB user identity and never expose another
   user's transaction.
4. Callback routes must cap body size, parse JSON, validate the exact callback
   family, correlate to an expected local record, persist a redacted payload
   and hash, enqueue, and acknowledge quickly. Unknown callbacks are
   acknowledged without mutation.
5. Keep callback route logs to correlation ID, callback family, outcome, and
   provider identifiers only where operationally necessary. Never log raw
   payloads, phone numbers, credentials, or SecurityCredential values.
6. Keep lead-credit UI disabled until a dedicated credit ledger command exists;
   do not send it through subscription checkout.

### Workstream D - admin money-out controls

1. `apps/admin/src/actions/admin/mpesa.ts` must use `safeAction`, `safeParse`,
   recent authentication, `AdminCapability.PROCESS_PAYOUTS`, the operation
   registry, and declarative policy mapping.
2. Resolve the target professional and payout amount server-side. Reject
   non-integer, non-positive, and policy-over-limit amounts; normalize the
   Kenyan MSISDN before storage.
3. Write the audit record before reporting success. Include canonical action,
   target professional, amount, idempotency key fingerprint, and correlation
   ID; omit the phone number and all secrets.
4. Add a future two-person approval path for live B2C payouts and a separate
   break-glass path for requery/reversal. Neither should be a hidden bypass of
   `PROCESS_PAYOUTS`.

### Workstream E - external onboarding and release

1. Obtain current sandbox credentials separately for STK and B2C, and store
   them only in the worker secret manager.
2. Register real HTTPS callback URLs and validate each exact provider response
   with recorded redacted fixtures.
3. Confirm shortcode/product compatibility and any current provider network
   requirements; treat provider IP guidance as secondary to correlation and
   event idempotency.
4. Run the sandbox matrix: accepted STK, rejected STK, duplicate callback,
   callback-before-status-read, lost callback plus query, B2C success, B2C
   failure, timeout, unknown correlation, retry exhaustion, and secret
   rotation.
5. Require explicit sign-off from engineering, finance, and operations before
   setting either enablement flag in production.

## Test-first verification matrix

Every new behavior follows RED -> minimal implementation -> GREEN. The focused
tests currently present are:

- `packages/mpesa/src/__tests__/client.test.ts`
- `packages/mpesa/src/__tests__/contracts.test.ts`
- `packages/mpesa/src/__tests__/callback.test.ts`
- `packages/queue-server/src/__tests__/mpesa-queue-contract.test.ts`
- `apps/client/app/lib/domains/subscriptions/__tests__/checkout.test.ts`
- `apps/workers/src/processors/__tests__/mpesa-stk.processor.test.ts`
- `apps/workers/src/processors/__tests__/mpesa-b2c.processor.test.ts`
- `apps/admin/src/lib/domains/mpesa/__tests__/policy.test.ts`

Required additions before go-live:

- callback route tests for malformed, oversized, unknown, duplicate, and
  callback-type-collision payloads;
- worker integration tests against a disposable database for concurrent
  callback delivery and ledger uniqueness;
- reconciliation tests for success, failure, provider timeout, stale claim,
  query rate limit, and retry exhaustion;
- admin action tests for capability, recent-auth, audit-before-success,
  idempotency, amount/phone validation, and safe error mapping;
- an external sandbox smoke suite that is never required for ordinary CI.

## Changelog and ADR updates

Update these files in the same release PR, with the actual shipped scope and
known deferrals:

- `CHANGELOG.md` - repository-level architecture, migration, and release gate;
- `docs/CHANGELOG.md` - cross-application operational/security summary;
- `apps/client/docs/CHANGELOG.md` - checkout, callback, status, and secret
  boundary changes;
- `apps/admin/docs/CHANGELOG.md` - payout capability, audit, and policy;
- `apps/workers/docs/CHANGELOG.md` - worker processors, env gates, retries,
  and reconciliation status;
- `packages/db/docs/CHANGELOG.md` - schema/migration and retention impact;
- `packages/mpesa/docs/CHANGELOG.md` - provider contract and security notes;
- `apps/client/docs/adr/` and `apps/admin/docs/adr/` - record any amendment
  to the existing queue, callback, environment, admin capability, and audit
  ADRs rather than introducing a conflicting local rule.

No changelog may claim C2B, reversal, ledger settlement, or production
readiness until its tests and operational gates are complete.

## Security drift checks

The existing strict client/admin drift reports and env-contract checks remain
mandatory. Extend them with M-Pesa-specific assertions and fail CI on any
violation:

1. `MPESA_*` reads are limited to the canonical worker env/bootstrap boundary;
   no client/admin source reads provider credentials directly.
2. `NEXT_PUBLIC_MPESA_*`, provider credentials, certificates, passkeys, and
   initiator passwords are forbidden in client/admin source and generated
   browser bundles.
3. `@build/mpesa` imports are forbidden from browser components; only server
   routes/domain code and workers may import it.
4. `new Worker` and provider HTTP endpoints are forbidden outside
   `apps/workers`.
5. Every admin M-Pesa mutation must appear in operation names, policy mapping,
   capability checks, recent-auth requirements, and audit configuration.
6. Callback routes must contain body-size protection, provider-schema
   validation, correlation, callback-event persistence, stable enqueueing, and
   private/no-store headers.
7. Logs and error text must not contain names matching secret variables,
   certificate contents, raw callback bodies, full phone numbers, or bearer
   tokens.
8. Migration/schema drift must verify the unique idempotency keys, provider
   correlation indexes, callback event indexes, and no destructive migration.

Run the checks from the repository root:

```text
pnpm run client:report-security-drift:strict
pnpm run admin:report-security-drift:strict
pnpm run client:check-env-contract
pnpm run admin:check-env-contract
pnpm run check-types
pnpm run format:check
pnpm run lint
pnpm run deps:audit
```

The dedicated `mpesa:check-security-boundary` script is implemented and wired
into `pnpm validate` and `pnpm ci:local`. Run it on every dependency upgrade
and whenever a route, action, worker, environment schema, or callback schema
changes.

## Observability, incident response, and retention

- Dashboard queue depth, oldest payment age, callback receipt-to-processing
  latency, provider error rate, OAuth failures, unknown correlations, duplicate
  callbacks, B2C failures, and reconciliation lag.
- Alert on B2C failure/retry exhaustion, reconciliation inactivity, callback
  spikes, provider 401/429/5xx changes, and settlement/ledger uniqueness
  conflicts.
- Use correlation IDs and payload hashes to investigate. Do not ask operators
  to paste raw callbacks or credentials into tickets.
- Define retention and access controls for redacted callback payloads. A hash is
  for correlation, not a substitute for a documented retention policy.
- Rehearse consumer key/secret, passkey, initiator password, and certificate
  rotation with the flags disabled or traffic held. Confirm old credentials
  cannot be used after rotation.

## Release gates and rollback

The release is blocked unless all applicable gates pass:

- focused tests and package typecheck are green;
- Prisma migration applies to a representative database and generated client
  matches the schema;
- client/admin/workers typechecks, full tests, lint, format, env contracts,
  and strict security drift reports are green;
- no provider secret is present in client/admin runtime configuration;
- sandbox round-trip evidence covers duplicate, failure, timeout, and lost
  callback behavior;
- finance approves payout amount/approval policy and operations approves the
  callback/reconciliation runbook;
- production flags remain off until external Daraja onboarding is verified.

Rollback means disable the feature flags, stop new producers, drain/hold
payment queues under the incident runbook, and keep callback receipt routes
available for correlation. Do not delete callback events or roll back the
additive migration while receipts may still arrive. Reconciliation must resolve
in-flight provider requests before any retry or customer-facing retry advice.

## Verification commands

Use the repository scripts for the complete pass:

```text
pnpm run client:test:all
pnpm run admin:test:all
pnpm run client:check-types
pnpm run admin:check-types
pnpm run workers:check-types
pnpm run check-types
pnpm run db:generate
pnpm run db:migrate:deploy
pnpm run client:report-security-drift:strict
pnpm run admin:report-security-drift:strict
pnpm run mpesa:check-security-boundary
pnpm run client:check-env-contract
pnpm run admin:check-env-contract
pnpm run format:check
pnpm run lint
```

For the current vertical slice, run the focused Vitest command listed in the
handoff notes and retain its output with the change review. Full workspace
commands may require the repository's normal dependency installation and
database/Redis services; a timeout is an environment failure, not evidence of
passing.
