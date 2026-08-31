# M-Pesa Phases 3b, 4b, and 5 — Hardened Implementation Plan

**Date:** 2026-08-31  
**Status:** Proposed implementation plan; not a production-readiness approval  
**Scope:** Implementation code, schema/migrations, tests, operational documentation, changelogs, and security-drift enforcement

## Goal

Deliver production-safe reconciliation, lead-credit and escrow STK settlement,
and narrowly authorized admin operations for M-Pesa while preserving the
worker-only provider boundary, replay-safe financial effects, and explicit
rollback controls.

## Staff review of the supplied plan

The supplied plan has the right high-level direction—provider isolation,
BullMQ, callback receipts, idempotency, and admin authorization—but it is not
yet executable as a production plan. The following changes are required.

### Release-blocking findings

1. **Reconciliation is specified but not wired.** The repository already has a
   reconciliation queue contract, but `apps/workers/src/index.ts` currently
   registers only the `mpesa-payments` worker. Phase 3b must add and health-check
   a separate reconciliation consumer.
2. **Callback idempotency is not settlement idempotency.** A unique callback
   event prevents duplicate event ingestion, but it does not guarantee that
   concurrent callback and query jobs cannot create duplicate subscription,
   lead-credit, or escrow effects. Each settlement must have a unique business
   key and a conditional state transition inside one database transaction.
3. **The current STK processor can settle terminal records again.** The
   settlement predicate must be “transitioned into success,” not merely
   “provider result is success.” Reversed, refunded, cancelled, and already
   settled records must be no-ops.
4. **The first draft has no claim/lease protocol.** A concurrency-one worker is
   not sufficient when multiple processes, retries, or manual actions exist.
   Reconciliation requires a conditional claim, lease expiry, bounded batch,
   and recovery of abandoned claims.
5. **Admin requery must not be a synchronous provider call.** Admin actions may
   authorize and enqueue a query command; only workers may call Daraja. Requery,
   reversal, and payout initiation must be distinct operations and capabilities.
6. **The status contract is currently misleading.** The checkout service returns
   the local transaction ID as `checkoutRequestId` before Daraja has returned a
   provider ID. The contract must distinguish `transactionId` from nullable
   `checkoutRequestId` and never fabricate provider identifiers.
7. **Ownership must be enforced in the database query.** The status route should
   query by `{ id, userId }` or `{ checkoutRequestId, userId }`, rather than load
   an arbitrary transaction and check ownership afterward.
8. **Body-size validation must protect parsing, not only validate afterward.**
   Callback routes need an early content-length check plus a bounded body reader,
   with a provider-compatible acknowledgement policy documented for malformed
   and oversized requests.
9. **Phone search needs a privacy-preserving index.** The current transaction
   model stores a normalized phone number. Admin search must use a keyed HMAC
   search fingerprint and masked display value; it must not expose or broadly
   index full phone numbers.
10. **The first draft names capabilities that do not exist.** Use the existing
    `VIEW_FINANCIALS` and `PROCESS_PAYOUTS` capabilities, and add a narrowly
    scoped `RECONCILE_PAYMENTS` capability for requery/reversal workflows rather
    than inventing `MANAGE_FINANCES` at call sites.

### Scope corrections

In scope for this plan:

- Phase 3b: pending STK reconciliation, stale-claim recovery, retry ceilings,
  metrics, and operator runbook.
- Phase 4b: `LEAD_CREDIT_PURCHASE` and `ESCROW_FUNDING` through the existing STK
  command path, with atomic settlement and ledger uniqueness.
- Phase 5: read-only admin search/details, queued requery, payout inspection,
  audit evidence, and guarded operational controls.

Explicitly deferred:

- C2B confirmation/validation, reversals/refunds, automated customer retry,
  chargebacks, and provider-side dispute handling. These require separate
  product, finance, and provider-contract decisions.
- Live B2C enablement and two-person approval. The plan defines the interfaces
  and gates, but production activation requires finance and operations sign-off.

## Architecture and tier alignment

- **Client:** thin HTTP adapters and domain services only. Routes validate,
  authenticate, rate-limit, serialize DTOs, and enqueue. Business logic belongs
  in `apps/client/app/lib/domains/<slice>/service.ts`; persistence belongs in
  repositories. This follows ADR-002 and ADR-003.
- **Admin:** every mutation uses `safeAction`, `safeParse`/the repository's
  `parseActionInput` wrapper, database-backed actor capabilities, recent-auth
  controls, declarative operation policy, and append-only audit logging. This
  follows ADR-ADMIN-001, ADR-ADMIN-002, and ADR-ADMIN-008.
- **Workers:** the only runtime allowed to create the Daraja client, read
  provider credentials, call provider endpoints, or perform settlement.
- **Packages:** `@build/mpesa` contains provider contracts, normalization,
  encryption, and HTTP behavior only. It must not import Prisma, Next.js, UI,
  or settlement code. `@build/queue-server` contains typed commands and stable
  job identities only.
- **DTO boundaries:** Prisma models never cross browser/admin presentation
  boundaries. Use explicit request, result, search-row, and details DTOs with
  redacted fields.

## State and settlement invariants

### Payment state rules

| Current local state | Provider outcome         | Result                         |
| ------------------- | ------------------------ | ------------------------------ |
| `PENDING`           | initiation accepted      | `PROCESSING`                   |
| `PENDING`           | initiation rejected      | `FAILED`                       |
| `PROCESSING`        | success                  | `SUCCESS`, settle once         |
| `PROCESSING`        | failure                  | `FAILED`, retain provider code |
| terminal            | duplicate callback/query | unchanged, no settlement       |
| any                 | unknown correlation      | acknowledge/log metadata only  |

`TIMEOUT` is a read-model label for an old non-terminal payment. It is never a
database settlement state and never triggers an automatic second charge.

### Settlement contract

Every successful payment must produce one deterministic settlement key, for
example `mpesa:<transactionId>:subscription`,
`mpesa:<transactionId>:lead-credit`, or `mpesa:<transactionId>:escrow`.

Inside one Prisma transaction:

1. Re-read the payment and verify it is eligible for a success transition.
2. Conditionally update the payment from `PROCESSING` to `SUCCESS`.
3. Insert or upsert the settlement record using its unique settlement key and
   provider receipt where available.
4. Apply the domain effect and ledger entry.
5. Mark the callback/query event processed only after all effects succeed.

If a unique conflict indicates a prior settlement, return an idempotent success
result after verifying the existing settlement belongs to the same payment and
amount. A receipt collision across different payments is a fraud/integrity
incident, not a successful retry.

## Current baseline and implementation checklist

The following baseline is present on `staging` and must remain protected while
the remaining phases are implemented:

- [x] Provider client package with OAuth, STK initiate/query, B2C initiate,
      phone normalization, schemas, error classification, and credential
      encryption.
- [x] Worker-only provider credential reads and provider HTTP calls.
- [x] Authenticated subscription checkout intent creation and queue production.
- [x] Public callback receipt routes with correlation, redaction, hashing, and
      stable callback jobs.
- [x] User-scoped payment status endpoint and admin payout enqueue baseline.
- [x] Dedicated M-Pesa security-boundary script wired into root validation.
- [ ] Correct the fabricated provider-ID DTO and callback/body-size behavior.
- [ ] Complete Phase 3b reconciliation and registration.
- [ ] Complete Phase 4b lead-credit and escrow settlement.
- [ ] Complete Phase 5 admin search, requery, operational controls, and UI.
- [ ] Complete external sandbox evidence, runbooks, release gates, and staged
      enablement.

## Detailed implementation plan

Each task follows RED → verify RED → minimal implementation → verify GREEN →
refactor/typecheck. Commit each independently verifiable slice.

### Phase 3b — Reconciliation and stale-transaction sweeps

#### 3b.1 Queue contract and schedule

**Modify:** `packages/queue-server/src/mpesa-queue-contracts.ts`,
`packages/queue-server/src/mpesa.queue.ts`.

- Keep `MPESA_QUEUE_NAMES.RECONCILIATION` separate from payment initiation.
- Change reconciliation payloads to carry a bounded policy snapshot:
  `olderThanMinutes`, `batchSize`, `leaseSeconds`, `correlationId`.
- Derive the job ID from the schedule window, not only a random correlation
  ID, so duplicate scheduler ticks collapse safely.
- Set explicit attempts/backoff and preserve failed jobs for inspection.
- Add tests for stable IDs, payload bounds, and duplicate schedule behavior.

**Verify:**

```text
pnpm -C packages/queue-server exec vitest run src/__tests__/mpesa-queue-contract.test.ts
pnpm run queue-server:check-types
```

#### 3b.2 Reconciliation persistence and claim protocol

**Modify:** `packages/db/prisma/schema.prisma` and add a new timestamped
migration under `packages/db/prisma/migrations/`.

Add fields to `MpesaTransaction` for reconciliation ownership and bounded
retrying, using names agreed with the generated Prisma client:

- `reconciliationAttempts Int @default(0)`
- `reconciliationNextAttemptAt DateTime?`
- `reconciliationClaimedAt DateTime?`
- `reconciliationClaimId String?`
- `lastProviderQueryAt DateTime?`
- `lastProviderQueryCode String?`

Add indexes supporting the actual selection predicate:
`status`, `checkoutRequestId`, `reconciliationNextAttemptAt`, and claim age.
Use an additive migration; do not drop or rewrite callback receipts.

The repository must claim rows with a conditional update that accepts only old,
unclaimed, retry-eligible `PROCESSING` rows. A claim expires after a configured
lease, and the next sweep can reclaim it. The worker must process a bounded
page, not an unbounded `findMany`.

**Tests:** migration applies to a disposable database; two concurrent claimers
cannot receive the same row; an expired lease is recoverable; terminal rows and
rows without `checkoutRequestId` are excluded; retry ceilings move a record to
an operator-visible `FAILED`/exception path without silently charging again.

**Verify:**

```text
pnpm run db:generate
pnpm run db:migrate:deploy
pnpm -C packages/db exec prisma validate
```

#### 3b.3 Reconciliation processor and worker registration

**Add:** `apps/workers/src/processors/mpesa-reconciliation.processor.ts` and its
tests. **Modify:** `apps/workers/src/index.ts`, worker health/metrics wiring,
and `apps/workers/src/env.ts` if policy values need validated configuration.

Implement `processMpesaReconciliationJob(job, workerEnv)` with this contract:

- select only old `PROCESSING` transactions with a provider request ID;
- claim before querying Daraja;
- query one provider record at a time with provider-aware rate limiting;
- classify success, failure, timeout, 401, 429, 5xx, malformed response, and
  unknown result distinctly;
- route success/failure through the same settlement service used by callbacks;
- increment attempts and schedule a bounded retry on retryable failures;
- release or expire the claim on failure;
- record redacted metrics and correlation data;
- never create a new payment or initiate a second STK push.

Register a dedicated `Worker` for `MPESA_QUEUE_NAMES.RECONCILIATION` with
concurrency and limiter values from configuration. Add a scheduler/maintenance
trigger with one active schedule per environment. Expose worker readiness for
queue registration and fail closed when M-Pesa is enabled but required config is
missing.

**Tests:** success after lost callback, provider failure, 429/backoff, timeout,
malformed response, retry exhaustion, concurrent claim, stale claim recovery,
callback/query race, already-settled transaction, and no-provider-ID exclusion.

**Verify:**

```text
pnpm -C apps/workers exec vitest run src/processors/__tests__/mpesa-reconciliation.processor.test.ts --pool=threads --maxWorkers=1
pnpm run workers:check-types
pnpm -C apps/workers run lint
```

#### 3b.4 Fix shared settlement semantics

**Modify:** `apps/workers/src/processors/mpesa-stk.processor.ts`,
`apps/workers/src/processors/mpesa-b2c.processor.ts`, and add a worker-domain
settlement module if needed, for example
`apps/workers/src/domains/mpesa/settlement.ts`.

- Replace the current “provider success means success” behavior with an
  explicit state-transition result.
- Ensure `REVERSED`, `REFUNDED`, `CANCELLED`, `SUCCESS`, and `COMPLETED` are
  immutable to duplicate success/failure callbacks.
- Make callback-event claiming conditional so two workers cannot process one
  event concurrently.
- Persist provider receipt, result code, and event metadata without raw payloads.
- Reuse the same settlement function from callback and reconciliation paths.

**Verify:**

```text
pnpm -C apps/workers exec vitest run src/processors/__tests__/mpesa-stk.processor.test.ts src/processors/__tests__/mpesa-b2c.processor.test.ts --pool=threads --maxWorkers=1
pnpm run mpesa:check-security-boundary
```

### Phase 4b — Lead credits and escrow milestone funding

#### 4b.1 Explicit payment-purpose contracts

**Modify:** `apps/client/app/lib/domains/subscriptions/checkout.ts`,
`apps/client/app/lib/domains/subscriptions/contracts.ts`,
`apps/client/app/lib/domains/subscriptions/service.ts`, and add a dedicated
payment domain if the existing subscription slice cannot own the new purposes.

Do not overload subscription checkout. Introduce a typed discriminated union:

```ts
type MpesaCheckoutCommand =
  | { purpose: "LEAD_CREDIT_PURCHASE"; creditPackId: string; credits: number }
  | { purpose: "ESCROW_FUNDING"; projectId: string; milestoneId: string };
```

The service must load authoritative pack/milestone pricing from the database,
verify actor ownership/eligibility, reject client-supplied prices and credit
counts that disagree with server data, and persist immutable metadata needed by
settlement. Return `transactionId` and nullable provider IDs; never return the
local ID as a provider ID.

Add request-conflict behavior: reuse of an idempotency key with a different
purpose, actor, resource, amount, or metadata returns a conflict and does not
enqueue another provider command.

**Tests:** valid/invalid purpose metadata, ownership failure, inactive/paid
milestone, pack mismatch, zero/decimal amount, duplicate identical request,
idempotency-key payload conflict, and DTO serialization.

**Verify:**

```text
pnpm -C apps/client exec vitest run app/lib/domains/subscriptions/__tests__/checkout.test.ts --pool=threads --maxWorkers=1
pnpm run client:check-types
```

#### 4b.2 Lead-credit settlement ledger

**Modify:** `packages/db/prisma/schema.prisma`, add the migration, and add the
worker settlement/domain repository code.

Add a unique `settlementKey` (or an equivalent unique provider-reference
constraint) to `LeadCreditLedgerEntry`. Settlement must lock/re-read the wallet,
insert exactly one purchase ledger entry, calculate `balanceAfter` from the
transactional balance, and update the wallet in the same database transaction.
Link the entry to one immutable `ProfessionalTransaction` whose
`referenceCode` is the provider receipt when available.

Reject negative/overflowing balances and mismatched credit quantities. If a
successful provider result has no usable receipt, use the local settlement key
for idempotency and mark the record for reconciliation rather than creating
unbounded duplicates.

**Tests:** first settlement, duplicate callback, concurrent settlement,
receipt collision, insufficient/overflow guard, and replay after worker retry.

**Verify:**

```text
pnpm -C apps/workers exec vitest run src/processors/__tests__/mpesa-stk.processor.test.ts --pool=threads --maxWorkers=1
pnpm run db:generate
pnpm run workers:check-types
```

#### 4b.3 Escrow milestone funding

**Modify:** `apps/workers/src/processors/mpesa-stk.processor.ts` or the shared
settlement module; `packages/db/prisma/schema.prisma`; and the client escrow
domain/repository only where a new funding intent is required.

On success, atomically verify the payment is for the expected project and
milestone, the amount equals the authoritative milestone/escrow amount, and the
milestone is not already funded. Then set `EscrowTransaction.status` to
`FUNDS_HELD`, set `fundedAt`, set its unique `fundingRef`, set milestone
`isPaid`/status according to the existing domain contract, and create balanced
ledger entries with a deterministic settlement key. A repeat callback must be a
no-op; a receipt or amount mismatch must fail closed and alert operations.

**Tests:** valid funding, wrong project/milestone, amount mismatch, already
funded milestone, duplicate/concurrent callbacks, ledger balance, and callback
versus reconciliation race.

**Verify:**

```text
pnpm -C apps/workers exec vitest run src/processors/__tests__/mpesa-stk.processor.test.ts --pool=threads --maxWorkers=1
pnpm run workers:check-types
```

### Phase 5 — Admin operational controls

#### 5.1 Read-only search and details

**Modify:** `apps/admin/src/actions/admin/mpesa.ts`,
`apps/admin/src/lib/domains/mpesa/contracts.ts`, `service.ts`, and
`repository.ts`. Add tests under
`apps/admin/src/lib/domains/mpesa/__tests__/`.

Add capability-gated read operations for status, professional, local
transaction ID, provider receipt, bounded date range, and phone search. Phone
search uses a worker-held/application-held keyed HMAC fingerprint; details show
only masked phone, redacted callback metadata, status history, retry/claim
state, and correlation IDs. Enforce a maximum page size, a required filter or
minimum date constraint, and no arbitrary unbounded export.

Use `VIEW_FINANCIALS` and explicit low-risk operation names. Keep all Prisma
access in the repository and return stable admin DTOs.

**Tests:** capability denial, pagination bounds, date-range bounds, phone
fingerprint matching, masked output, no raw callback/secret leakage, and
cross-tenant/resource access denial.

#### 5.2 Queued requery operation

**Modify:** admin action/domain/policy files, queue contracts, and worker
reconciliation processor.

Add a distinct `requery_mpesa_transaction` operation requiring
`RECONCILE_PAYMENTS`, recent authentication (`maxAgeSeconds: 180`), rate
limiting, reason, target transaction, and audit metadata. The action validates
and enqueues a requery command; it never invokes `@build/mpesa` or Daraja.

The worker reuses claim and settlement logic, rejects terminal or
provider-ID-missing transactions, and records whether the request was scheduled,
completed, ignored, or failed. A requery cannot transition a payment out of a
reversed/refunded/cancelled state.

Add `RECONCILE_PAYMENTS` to the database-backed capability mapping and make
operation registration, policy, recent-auth, rate limit, and audit coverage
mandatory in the drift check.

**Tests:** action authorization, recent-auth failure, audit-before-success,
queue-only behavior, terminal-state no-op, provider-query success/failure,
rate-limit behavior, and replayed admin request.

#### 5.3 Payout inspection and future approval boundary

Keep `create_mpesa_payout` separate from requery. Continue using
`PROCESS_PAYOUTS`, server-side amount/phone validation, idempotency, and audit
logging. Add payout details/read-only views under `VIEW_FINANCIALS`.

Do not add a hidden break-glass bypass. A future live-payout approval workflow
must have two distinct actors, explicit approval records, expiry, and a separate
release decision before `MPESA_B2C_ENABLED` is turned on.

**Verify:**

```text
pnpm -C apps/admin exec vitest run src/lib/domains/mpesa/__tests__/policy.test.ts src/lib/domains/mpesa/__tests__/service.test.ts --pool=forks --maxWorkers=1
pnpm run admin:check-types
pnpm run admin:check-governance
```

## Schema and migration safety

Migration order:

1. Additive schema migration for reconciliation leases, phone search
   fingerprint, and settlement uniqueness.
2. Generate and validate Prisma client.
3. Run duplicate/backfill checks before adding unique indexes. A failed
   backfill blocks deployment; it must not silently discard duplicates.
4. Deploy code with `MPESA_ENABLED=false` and `MPESA_B2C_ENABLED=false`.
5. Verify callback receipt persistence, queue connectivity, worker boot checks,
   and redaction in staging.
6. Enable sandbox STK, collect evidence, then enable each payment purpose
   independently. Enable B2C only after separate payout approval evidence.

Rollback is feature-flag and queue-control based. Do not remove callback events,
settlement records, or additive columns while provider callbacks may still
arrive. If a migration cannot be safely rolled back, document forward-fix and
data-repair procedures before applying it.

## Security-drift and boundary checks

Extend `scripts/check-mpesa-security-boundary.mjs` and its tests to fail on:

- `MPESA_*`, certificates, initiator passwords, passkeys, and bearer tokens
  read outside the worker env/bootstrap boundary;
- any `NEXT_PUBLIC_MPESA_*` variable, provider secret, or certificate in client
  or admin source, server configuration, or browser output;
- `@build/mpesa` imports in browser components or admin/client code paths that
  can initiate provider calls;
- `new Worker`, provider endpoints, OAuth calls, or B2C initiation outside
  `apps/workers`;
- a callback route missing bounded body handling, schema validation, correlation,
  redacted receipt persistence, stable enqueueing, and private/no-store headers;
- admin M-Pesa mutations absent from operation names, capability mapping,
  recent-auth policy, rate-limit policy, or audit configuration;
- settlement code without a unique settlement key and conditional terminal
  transition;
- raw callback payloads, full phone numbers, credentials, or authorization
  headers in logs, errors, fixtures, snapshots, or admin DTOs;
- schema drift that removes unique provider/idempotency indexes or introduces a
  destructive M-Pesa migration.

Run the following from the repository root for every M-Pesa change and every
dependency, route, worker, environment, schema, or callback-contract change:

```text
pnpm run mpesa:check-security-boundary
pnpm run client:check-env-contract
pnpm run admin:check-env-contract
pnpm run client:report-security-drift:strict
pnpm run admin:report-security-drift:strict
pnpm run deps:audit
```

Add a fixture-only allowlist mechanism with a mandatory reason if the scanner
must contain provider-shaped test data. Never weaken the production source or
bundle rules to accommodate fixtures.

## Changelog, ADR, and operational-document updates

Update in the same implementation release, with actual shipped scope and
deferrals:

- `CHANGELOG.md` — user-visible payment behavior, migration, feature flags,
  and release gates.
- `docs/CHANGELOG.md` — architecture, data protection, incident response, and
  operational changes.
- `apps/client/docs/CHANGELOG.md` — checkout purposes, status DTO, callback
  receipt behavior, and ownership/rate-limit changes.
- `apps/admin/docs/CHANGELOG.md` — search/details, capabilities, audit, requery,
  and payout controls.
- `apps/workers/docs/CHANGELOG.md` — reconciliation worker, claim leases,
  provider retry classification, and settlement behavior.
- `packages/db/docs/CHANGELOG.md` — migration, indexes, retention, and
  backfill/rollback notes.
- `packages/mpesa/docs/CHANGELOG.md` — provider contract assumptions,
  credential handling, and sandbox evidence.
- `docs/runbooks/mpesa-reconciliation.md` — queue lag, stuck claims, query
  retry exhaustion, duplicate/receipt collision, and provider incident steps.
- `docs/runbooks/mpesa-secret-rotation.md` — staged rotation and verification
  of old credential invalidation.
- Applicable `apps/client/docs/adr/` and `apps/admin/docs/adr/` records — amend
  existing ADRs when boundaries change; do not create a conflicting local rule.

Every changelog entry must label work as shipped, gated, or deferred. It must
not claim C2B, reversals/refunds, live B2C, or production readiness unless the
corresponding tests and external gates are complete.

## Observability and incident controls

Emit redacted structured metrics for:

- initiation accepted/rejected;
- callback receipt, duplicate, unknown-correlation, and processing latency;
- reconciliation selected/claimed/reclaimed/succeeded/failed/exhausted;
- provider 401/429/5xx/timeout/malformed-response rates;
- settlement uniqueness conflicts and ledger-balance failures;
- queue depth and oldest pending payment age;
- B2C success/failure only when B2C is enabled.

Alert on reconciliation inactivity, oldest pending age, retry exhaustion,
unknown correlations, receipt collisions, queue growth, provider error-rate
changes, and any ledger invariant failure. Retain redacted payloads only for a
documented period with restricted access; payload hashes support correlation but
are not a retention policy.

## Verification and release gates

### Focused gates per phase

```text
pnpm -C packages/mpesa exec vitest run src/__tests__/client.test.ts src/__tests__/contracts.test.ts src/__tests__/callback.test.ts --pool=threads --maxWorkers=1
pnpm -C packages/mpesa run build
pnpm run queue-server:check-types
pnpm -C apps/workers exec vitest run src/processors/__tests__/mpesa-stk.processor.test.ts src/processors/__tests__/mpesa-b2c.processor.test.ts src/processors/__tests__/mpesa-reconciliation.processor.test.ts --pool=threads --maxWorkers=1
pnpm -C apps/admin run test:all
pnpm run client:check-types
pnpm run admin:check-types
pnpm run workers:check-types
```

### Full release gates

```text
pnpm run db:generate
pnpm run db:migrate:deploy
pnpm run mpesa:check-security-boundary
pnpm run client:check-env-contract
pnpm run admin:check-env-contract
pnpm run client:report-security-drift:strict
pnpm run admin:report-security-drift:strict
pnpm run admin:check-governance
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run client:test:all
pnpm run admin:test:all
pnpm -C apps/workers run test
pnpm run deps:audit
```

The release remains blocked until:

- migration and generated client verification pass;
- callback/query concurrency and settlement uniqueness tests pass;
- sandbox evidence covers accepted, rejected, duplicate, lost-callback,
  timeout, retry-exhaustion, lead-credit, and escrow scenarios;
- no provider secret appears in client/admin runtime or browser output;
- finance approves ledger and payout controls;
- operations approves dashboards, alerts, retention, rotation, and rollback
  runbooks;
- feature flags remain disabled until current Daraja endpoint/callback and
  go-live requirements are verified against the Safaricom Developer Portal.

## Definition of done

- [ ] Every in-scope code path has a focused RED/GREEN test and exact passing
      verification output retained with the review.
- [ ] Reconciliation is scheduled, registered, lease-safe, rate-limited, and
      observable.
- [ ] Callback and query paths share one replay-safe settlement implementation.
- [ ] Lead-credit and escrow effects are atomic and uniquely settled.
- [ ] Admin reads are bounded/redacted; admin mutations are capability-,
      recent-auth-, rate-limit-, and audit-gated.
- [ ] Security-boundary and strict drift checks fail closed on regression.
- [ ] Changelogs, ADR amendments, runbooks, and migration notes match the
      actual shipped scope.
- [ ] Sandbox and release approvals are recorded before production enablement.
