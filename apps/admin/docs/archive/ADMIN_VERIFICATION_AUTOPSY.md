# Admin Verification Slice — Staff-Level Autopsy

Scope: `lib/domains/verification/**` (contracts, repository, service, internal/\*),
the three `app/api/admin/**` verification routes, `lib/domains/professionals/service.ts`
(via the legacy verify-professional route), `notification-queue.ts`, `logger.ts`,
`correlation.ts`, `env.ts`, and `schema.prisma`.

Method: same lens as `NEWSLETTER_README.md` — trace each flow end-to-end from
route → domain → repository → Prisma, and from "verification decided" →
"human notified," and flag every point where the code's behavior diverges
from what the type contracts and comments claim it does.

**Headline finding:** this slice has the newsletter domain's exact failure
mode — durable, well-typed decision logic sitting on top of notification/worker
wiring that was never finished — plus a second, worse one: a live production
code path that opens a Redis connection and starts a BullMQ polling loop
**inside a request handler**, which is the specific anti-pattern the newsletter
README calls out and was written to avoid.

---

## 1. Architecture map (what's actually there)

```text
contracts.ts        Zod-free but strongly-typed domain shapes, error codes
repository.ts        Prisma access — professional/store/property/license queues,
                      document verification updates
service.ts            Orchestrator: capability check → internal/*.service call →
                      notifyVerificationResult() → NATS publish (verificationService)
internal/
  professional-verification.service.ts   entity-level verify for professionals
  store-verification.service.ts          entity-level verify for stores
  property-verification.service.ts       entity-level verify for properties
  license-verification.service.ts        license-level verify (transactional)
  notification.service.ts                DB notification + optional HTTP call +
                                          NATS publish, with retry-queue fallback
  audit-service.ts (not provided)         createAuditLog / getAuditHistory
  types.ts (not provided)                 mapActionToStatus / validateTransition
index.ts             Barrel: contracts + repository + service
route.ts (×2 shown)  GET pending-verifications, GET verification-details/[id]
route.ts (legacy)    POST /api/admin/verify-professional — bypasses all of the above
notification-queue.ts  Standalone retry/dead-letter queue for failed notifications
                        (MEMORY / DB / REDIS strategies)
logger.ts             PII-safe structured admin logger — built, not called
correlation.ts         AsyncLocalStorage correlation ID threading — built, not called
```

This is a reasonably well-designed domain on paper: capability checks are
centralized (`requireVerificationCapability`), errors are a closed set mapped
consistently, and the entity-level services share a `VerificationRequest` /
`VerificationResult` contract with transactional audit logging (license
service wraps update + audit in `prisma.$transaction`). The problems are
almost entirely in the _seams_ — where routes call into the domain, where the
domain calls into notification/queue infra, and where the type contracts
promise more than the implementation delivers.

---

## 2. Critical findings

### F1 — The AsyncLocalStorage correlation ID system is built and never invoked

`correlation.ts` exports `initializeAdminCorrelationId`, `withAdminCorrelation`,
and `getAdminCorrelationId`, explicitly designed (per its own header comment)
so that "all calls within this scope share the same correlationId" without
prop-drilling. `logger.ts` exports a matching `getAdminLogger()` that is
PII-safe _at the type level_ (`AdminLogEvent` structurally excludes
`userId`/`email`/`phone`/etc.).

Neither is called anywhere in this slice. The verification routes use a
different pair entirely — `initializeCorrelationId` / `getClientLogger` from
`@/lib/api/resilient-api` — and none of them call `withAdminCorrelation(...)`
to open the AsyncLocalStorage scope. Every `getAdminCorrelationId()` call
made by downstream repository/service code in this domain returns `undefined`.

This matters specifically for Build Market: the whole point of the
AsyncLocalStorage + Pino correlation work (already shipped on the
backend/BullMQ/NATS side per the logging initiative) is that a single
correlation ID threads through HTTP → queue → worker without every function
signature growing a `correlationId` parameter. The admin verification slice
has its own, unconnected correlation primitive sitting next to it, unused —
so a support engineer grepping logs for one admin action's correlation ID
across `verification/*` and the rest of the stack will find two disjoint ID
spaces.

#### Fix for F1

- Delete `getClientLogger()`/`initializeCorrelationId()` usage from the
  three verification routes (and the legacy `verify-professional` route) in
  favor of `initializeAdminCorrelationId(request)` + `withAdminCorrelation`.
- Wrap each route body:

  ```ts
  const correlationId = initializeAdminCorrelationId(req);
  return withAdminCorrelation(correlationId, async () => {
    // existing handler body — service/repository code can now call
    // getAdminCorrelationId() and get a real value
  });
  ```

- Replace the ad hoc `logger.info(...)` calls in the `internal/*.service.ts`
  files with `getAdminLogger()`, which also fixes F10 below (some of those
  calls currently log `userEmail` directly into `metadata`, which
  `StructuredLogger` doesn't guard against but `AdminLogEvent` does).
- Add an ESLint rule (or a `no-restricted-imports` entry) banning
  `@build/resilience`'s `StructuredLogger` inside `apps/admin` in favor of
  `getAdminLogger()`, mirroring the newsletter README's ask for an eslint
  rule enforcing its request/worker import boundary (Audit A-2 there).

---

### F2 — A BullMQ `Worker` is constructed inside the request path (live version of the newsletter's warning)

`notification-queue.ts`'s `RedisQueueStrategy` constructor:

```ts
constructor() {
  const redisConfig = getBullMQConnectionOptions();
  this.queue = new Queue<NotificationJobData>(this.queueName, { connection: redisConfig });
  this.worker = new Worker<NotificationJobData>(this.queueName, async (job) => { ... }, { connection: redisConfig });
  ...
}
```

`getStrategy()` lazily instantiates this class **on first call**, and the
only caller is `queueFailedNotification()`, which is invoked directly from
`notification.service.ts`'s `notifyVerificationResult()` catch block — i.e.
inside the same request/serverless invocation that just processed an admin's
verify/reject click. The newsletter README states this exact pattern as the
single most load-bearing rule in that slice and documents _why_: constructing
a `Worker` opens a Redis connection and starts a polling loop at
module/object-construction time, so every serverless invocation (or dev
hot-reload) that happens to hit a failure path opens its own connection and
polling loop — leaking connections and risking double-processed jobs. That
slice caught the problem before deploying it. This one didn't: the
constructor already exists and is reachable from a live route.

#### Fix for F2

- Split `RedisQueueStrategy` into a producer-only class (`Queue` construction,
  used by `queueFailedNotification`) and a separate worker entrypoint file
  (`notification-retry.worker.ts`) that only the dedicated worker process
  imports — same split the newsletter domain uses (`newsletter.queue.ts` vs
  `*.worker.ts`).
- Until that split ships, `getStrategy()` should not be reachable from any
  file under `app/api/**`; today it is, transitively, through
  `notification.service.ts`.
- Add the same import-boundary eslint rule requested in Newsletter Audit A-2,
  scoped to cover this file too.

---

### F3 — No actual email is ever sent for a verification outcome

Trace the full path from "admin clicks Verify" to "professional/store/agent
finds out":

1. `service.ts::verifyEntity` → `internal/*-verification.service.ts` updates
   the row and writes an audit log.
2. `resolveVerificationRecipient` finds the owning user ID.
3. `notifyVerificationResult(result, recipientUserId)` runs:
   - Writes a `Notification` row (in-app only — `Notification` has no
     `channels: [EMAIL]` delivery, and nothing in the provided code ever
     reads `channels` to decide whether to email).
   - **Conditionally**, only if `ENABLE_NOTIFICATION_SERVICE` is true, POSTs
     to `${NOTIFICATION_SERVICE_URL}/api/notifications` — a service that is
     not part of this codebase, defaults to `http://localhost:3011`, and
     whose existence/contract is entirely assumed. `ENABLE_NOTIFICATION_SERVICE`
     is a `booleanString` env var that defaults to `false` when unset
     (`env.ts`), so in a fresh deployment this branch never runs.
   - Publishes a `verification.<entityType>.<status>` event to NATS —
     also fire-and-forget, and again requires a _separate_ consumer (not in
     this codebase) to turn it into an email.

There is no Resend/Mailchimp/SES call anywhere in this domain — contrast with
the newsletter slice, which owns its ESP integration end to end
(`esp-sync.ts`, `esp-sync.worker.ts`, `confirmation-email.worker.ts` calling
Resend directly). **A professional whose profile just got rejected today, in
production, gets: one row in an in-app notifications table they may never
open, and nothing else**, unless a phantom `NOTIFICATION_SERVICE_URL`
microservice happens to exist and be wired up outside this repo.

#### Fix for F3 (priority #1 for this domain, mirroring Newsletter §10.1)

- Either (a) stand up the actual notification-service and document its
  contract/deployment, or (b) fold verification-outcome emails into the
  existing newsletter domain's ESP plumbing (`esp-sync.ts`'s Resend client is
  already provider-agnostic and worker-only) via a new
  `verification-email.worker.ts` that consumes the NATS
  `verification.*` subject.
- Either way, add a `Notification.emailSentAt` / `emailStatus` column (or a
  dedicated `NotificationDelivery` table) so "was this actually emailed" is
  queryable — right now `Notification.deliveryStatus` exists but nothing in
  this slice ever sets it away from its `QUEUED` default for an email
  channel, because no email is ever attempted.
- Remove or explicitly flag-gate the silent `ENABLE_NOTIFICATION_SERVICE`
  branch so its absence is visible in logs/metrics instead of silently
  no-op'ing.

---

### F4 — A second, parallel verification pathway bypasses the entire domain

`route.ts` for `POST /api/admin/verify-professional` does **not** call
`verificationService.verifyEntity`. It calls
`professionalsService.verifyProfessional` / `rejectProfessional` from
`@/lib/domains/professionals/service` — a different domain entirely — and
logs its own audit event via `auditService.recordAdminAuditEvent`, a
different audit path than `createAuditLog` used by
`internal/professional-verification.service.ts`.

Consequences:

- Two independent code paths can both legally transition a
  `ProfessionalProfile.verificationStatus`, with no shared state-transition
  validation (`validateTransition` from `internal/types.ts` is only invoked
  by the `verificationService` path).
- `notifyVerificationResult` — and therefore the in-app notification, NATS
  event, and retry-queue fallback — is **never called** on this path. A
  professional verified through this endpoint gets literally no signal.
- Audit history reconstructed by `getAuditHistory("ProfessionalProfile", id)`
  (used by `getVerificationDetails`) will show a different shape of entry for
  actions taken through this route vs. the domain's own service, since
  `recordAdminAuditEvent`'s `details` shape isn't guaranteed to match what
  `mapAuditEntry` expects (`details.oldStatus` / `details.newStatus`).
- The two routes also use different actor-resolution: `withAdminRole([SUPER_ADMIN])`
  gates via `context: AuthContext`, but the handler then calls
  `resolveAdminRouteActor(...)` a second time to get an independent `actor`
  and checks `actor.adminRole !== AdminRole.SUPER_ADMIN` — never checking
  `context.adminRole` at all. Two authorization resolutions for one request
  is a smell even if both currently agree; it's the kind of duplication that
  silently diverges the next time one of the two auth helpers changes.

#### Fix for F4

- Delete this route and repoint whatever client calls
  `POST /api/admin/verify-professional` at the `verifyEntity` domain call
  (`entityType: "professional"`), or make the route a thin adapter that
  calls `verificationService.verifyEntity` directly.
- If the route must stay for API-compat reasons, at minimum route its result
  through `notifyVerificationResult` and `createAuditLog` so audit history
  and notifications are complete regardless of entry point.
- Pick one actor-resolution strategy per route and remove the other.

---

### F5 — `entityType: "license"` is a legal value the implementation doesn't handle in two places

`VerificationEntityType` = `"professional" | "store" | "property" | "license"`,
and both `VerifyEntityInput.entityType` and
`getVerificationDetails`'s input type accept it. But:

- `verifyEntity()` in `service.ts` branches only on `"professional"`,
  `"store"`, else falls through to `verifyProperty(request)`. Calling
  `verifyEntity(actor, { entityType: "license", entityId, action })` — which
  the type system allows — will call `verifyProperty` with a license's ID,
  looking it up in the `Property` table and either 404ing with a misleading
  "Property not found" or, worse, if a UUID collision were ever possible,
  mutating the wrong row.
- `getVerificationDetails()` has explicit branches for `"professional"` and
  `"store"` only; the final, unconditional block calls
  `getPropertyVerificationDetails(input.entityId)` for anything else,
  including `"license"`. Today this is masked because the _route_ layer
  (`route.ts` for verification-details) restricts `entityType` to
  `["professional", "store", "property"]` before calling the service — but
  the service function itself has no such guard, so any other caller
  (a future admin action, a script, `batchVerifyEntities`) that passes
  `"license"` gets silently wrong behavior instead of a domain error.

Licenses do have their own correctly-implemented path
(`verifyLicense` / `verifyLicenseInternal`, keyed by `licenseId` not
`entityId`), which is the real reason for the gap — `VerifyEntityInput`
should never have included `"license"` in the first place, since licenses
use a structurally different input shape.

#### Fix for F5

- Narrow `VerifyEntityInput.entityType` to `Exclude<VerificationEntityType, "license">`
  in `contracts.ts`, and let `VerificationEntityType` stay the broader union
  used by read paths (queue/details) — but add an explicit `"license"` branch
  in `getVerificationDetails` that either 404s cleanly or delegates to
  license lookup logic, rather than falling through.
- Add a unit test asserting `verifyEntity({ entityType: "license", ... })`
  fails to compile (or, if kept runtime-only, returns a domain error rather
  than mutating a property).

---

### F6 — Unvalidated pagination params can reach Prisma as `NaN`

Both `GET` routes read `page`/`limit` with bare `Number(searchParams.get(...))`
and pass them straight to `verificationService.listVerificationQueue` /
`buildVerificationQueueQuery`. That function does:

```ts
const page = Math.max(1, Math.trunc(input.page ?? 1));
const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20)));
```

`Number("abc")` is `NaN`, and `Math.max`/`Math.min`/`Math.trunc` all
propagate `NaN` rather than clamping it (per spec, any comparison against
`NaN` is `false`, so `Math.max(1, NaN) === NaN`). `skip: (page - 1) * limit`
then becomes `NaN`, which reaches `prisma.professionalProfile.findMany({ skip: NaN, take: NaN })`
— Prisma will throw at the client-validation layer, surfacing as an
uncaught 500 (via `executeResilient`'s catch, mapped to
`HttpStatus.BAD_REQUEST` only because `errorStatus` is hardcoded there —
functionally fine today, but only by accident, and the actual root cause
never gets logged as "invalid pagination input").

#### Fix for F6

- Validate `page`/`limit` (and `entityType`/`status`/`sortBy`/`sortOrder`)
  at the route boundary with a `zod` schema before calling the service — the
  same pattern already used for `verifySchema` in the legacy route. This also
  removes the current situation where the _service_ is doing input
  validation that arguably belongs at the adapter layer per the newsletter
  domain's own boundary philosophy (§3 there: domain code is
  framework-agnostic; validation of framework-facing input belongs at the
  route).

---

### F7 — Unbounded queries for the `entityType: "all"` verification queue

In `repository.ts`, every `list*Queue` function only applies `skip`/`take`
conditionally:

```ts
skip: query.entityType === "professional" ? query.skip : 0,
...(query.entityType === "professional" ? { take: query.limit } : {}),
```

When `service.ts::listVerificationQueue` handles `entityType === "all"`, it
calls all four `list*Queue` functions with the _same_ `query` object, whose
`entityType` is `"all"` — not `"professional"`/`"store"`/etc. Every one of
those conditionals evaluates false, so **every query for the "all" view runs
with no `skip` and no `take`**: it fetches the _entire_ table of
pending/whatever-status professionals, the entire table of stores, the
entire table of properties, and (if the license flag is on) the entire table
of licenses, into Node memory, before `sortQueueItems` + `.slice(skip, skip+limit)`
throws away everything except one page.

This is fine at MVP scale with zero users; it is a straightforward
scalability/DoS vector the moment the pilot's contractor/supplier lists load
— an admin loading the default "all pending" queue view after a bulk import
will pull every pending row across three-to-four tables in one request, with
no upper bound. It also silently defeats the composite indexes that exist
specifically to make these queries fast (`ProfessionalProfile`'s
`@@index([profession, county, verificationStatus])` is irrelevant if the
query has no `take` and Postgres has to materialize the whole result set
anyway for a large-offset-free unbounded scan).

#### Fix for F7

- For `entityType === "all"`, either:
  - Query each entity type with a bounded `take` proportional to `limit`
    (e.g. `Math.ceil(limit / 4) + buffer`) and accept slightly imprecise
    cross-entity sort ordering at the page boundary, or
  - Use a proper keyset/union approach (a Prisma raw `UNION ALL` query
    across the four tables with `ORDER BY ... LIMIT`) if exact global
    ordering across entity types is a hard requirement.
- At minimum, add a hard cap (e.g. 500) on rows fetched per entity type
  before combining, so a single request can never return unbounded data even
  in the worst case.

---

### F8 — Verification "notes" are only persisted for one of three entities

`professional-verification.service.ts` writes `notes` into
`verificationNotes` on the `ProfessionalProfile` row. `store-verification.service.ts`
and `property-verification.service.ts` accept the same `notes` field in
`VerificationRequest`, pass it into the audit log's `reason` field, but
**never write it to `Store.verificationNotes` / `Property.verificationNotes`**
even though both columns exist in the schema for exactly this purpose. An
admin's rejection notes for a store or property are only recoverable by
reading `AdminAuditLog.details` (an untyped JSON blob), not from the entity
itself — so `getVerificationDetails`'s `mapStoreDetails` can never surface
`verificationNotes` for a store no matter what the admin typed, while
`mapPropertyDetails` _does_ read `details.verificationNotes` from a column
that's never populated on the property-verification path either.

Related accountability gap: `ProfessionalProfile.verifiedById` and
`ProfessionalLicense.verifiedById` are real FK-backed columns (`User?
@relation("LicenseVerifier"/"DocumentVerifier"`, plus a plain string FK on
`ProfessionalProfile`), and the professional/license services set them. But
`Store` and `Property` have **no `verifiedById` column at all** — there is no
way to answer "which admin verified this store/property" from the entity
row itself, only by cross-referencing `AdminAuditLog` by `targetType`/`targetId`,
which isn't a foreign key and has no `onDelete` semantics tying it to the
entity.

#### Fix for F8

- Add `verifiedById String?` (+ `User?` relation) to `Store` and `Property`,
  mirroring `ProfessionalProfile`, and set it in both verification services.
- Fix `store-verification.service.ts` / `property-verification.service.ts`
  to write `notes` into `verificationNotes` on every action, not just carry
  it through to the audit log.
- Add a regression test (per the newsletter README's model of "treat
  invariants as things to preserve, not clean up") asserting that
  `entity.verificationNotes` matches the last submitted `notes` after any
  verify/reject/correction action, for all three entity types.

---

### F9 — `QueueProvider.DB` is fully implemented and permanently unreachable

`notification-queue.ts` defines `DatabaseQueueStrategy` (a complete,
Prisma-backed `FailedNotification` implementation) and `getStrategy()`
explicitly has a `case QueueProvider.DB:` branch for it. But the provider
selection logic:

```ts
const CURRENT_PROVIDER: QueueProvider =
  adminEnvConfig.QUEUE_PROVIDER === "redis" ||
  adminEnvConfig.QUEUE_PROVIDER === "bullmq"
    ? QueueProvider.REDIS
    : QueueProvider.MEMORY;
```

...only ever resolves to `REDIS` or `MEMORY`. `QueueProvider.DB` is dead —
and it can't even be reached by fixing this ternary alone, because
`env.ts`'s schema is `QUEUE_PROVIDER: z.enum(["memory", "redis", "bullmq"]).optional()`,
which doesn't accept `"db"` as a valid value at all. A fully-built, more
durable-than-memory option (no Redis dependency, same durability model as
`failed_notifications` table already in the schema) is unreachable through
any legitimate configuration.

#### Fix for F9

- Add `"db"` to `adminEnvSchema`'s `QUEUE_PROVIDER` enum.
- Fix the `CURRENT_PROVIDER` ternary to route `"db"` → `QueueProvider.DB`.
- Given Build Market doesn't yet have a hard Redis dependency for every
  environment, `DB` is arguably the better MVP default over `MEMORY` — see F10.

---

### F10 — Silent fallback to an in-memory retry queue in production

Today, any `QUEUE_PROVIDER` value other than `"redis"`/`"bullmq"` — including
unset — resolves to `MemoryQueueStrategy`, with **no environment guard**. This
is the inverse of the newsletter domain's deliberate, documented behavior
(§8 there: an unconfigured ESP fails loudly in production instead of
silently no-op'ing, specifically because a prior version silently pretended
every signup succeeded). Here, the equivalent risk is worse in kind: failed
verification notifications queued in `MemoryQueueStrategy`'s
`Map<string, FailedNotificationEntry>` are lost outright on every deploy,
restart, or serverless cold-start recycle — with nothing surfaced to an
operator.

#### Fix for F10

- In `env.ts`, make `QUEUE_PROVIDER` required (no `.optional()`) when
  `NODE_ENV === "production"`, mirroring the `isProd` stub-guard pattern the
  newsletter's `esp-sync.ts` already uses.
- Until F9 ships, treat `DatabaseQueueStrategy` (not `Memory`) as the
  production default when Redis isn't configured — the `failed_notifications`
  table already exists specifically for this.

---

### F11 — Logging philosophy is inconsistent, and one file opts out of the PII rule

`logger.ts` enforces, at the _type_ level, that `AdminLogEvent.meta` can
never carry `userId`/`email`/`phone`/`firstName`/`lastName`/etc., with a
runtime sanitization pass as defense-in-depth. `notification.service.ts`
opens with:

```ts
// security-drift-allow: no-banned-log-keys -- user identifier required for compliance tracking
```

...opting itself out of whatever lint rule enforces the same policy at the
`StructuredLogger` call sites, and its `publishVerificationEvent` builds a
NATS payload whose `metadata` field is literally `{ email: userEmail, userName }`
— which then gets logged (`logger.info("Verification event published to NATS", { subject, entityId, status })`,
not the email itself, so this specific call site is fine) but travels
un-redacted over the wire to any NATS consumer, and would be trivial to
accidentally log wholesale in a future edit given the field is right there
on the object being logged around it.

#### Fix for F11

- Once F1 lands (`getAdminLogger()` everywhere in this slice), the
  `security-drift-allow` comment either becomes provably unnecessary (the
  type system already prevents the leak) or should be replaced by a narrower,
  justified exception with an expiry/ticket reference rather than a blanket
  opt-out.
- Consider whether `email`/`userName` need to travel in the NATS event
  `metadata` at all, versus having the eventual email-sending consumer look
  the recipient up by `entityId`/`recipientUserId` — reduces PII surface
  area on the wire, and matches the newsletter domain's habit of keeping
  PII out of anything that isn't the system of record.

---

### F12 — Schema/type inconsistencies between this domain and the newsletter domain's own conventions

Small items, listed together because they're all "this slice didn't reuse a
pattern the newsletter slice already established well":

- `FailedNotification.status` is a bare `String` (`"PENDING" | "COMPLETED" | "DEAD_LETTER"`
  enforced only in TS) where `NewsletterSubscriber`/sync status use real
  Prisma enums (`NewsletterSubscriberStatus`, `NewsletterEspSyncStatus`).
  A typo'd status string is a compile-time-invisible, DB-writable bug here
  that can't happen in the newsletter tables.
- `FailedNotification` has separate `@@index([status])` and
  `@@index([nextRetryAt])` but the actual polling query
  (`getPendingRetryNotifications`, presumably `WHERE status = 'PENDING' AND nextRetryAt <= now()`)
  wants a composite `@@index([status, nextRetryAt])` — same shape of gap the
  newsletter README flags for its own reconciliation query (`findDueForEspSync`,
  Audit A-4) that "exists to catch stuck rows but nothing schedules it" —
  here, nothing schedules `processRetryNotifications()` either; it's exported
  but never called from a cron/worker anywhere in the provided code.
- `verifyLicense` in `service.ts` builds `const requestData: any = {...}` —
  the one `any` in an otherwise fully-typed orchestrator. Trivial to type as
  `LicenseVerificationRequest` (imported type already exists on the internal
  service) instead of hand-assembling an untyped object.
- `sortBy` accepts `"submittedAt"`, but `ProfessionalProfile` has no
  `submittedAt` column at all (`repository.ts::listProfessionalQueue`
  hardcodes `submittedAt: null` in its mapped output and always orders by
  `createdAt`, ignoring `query.sortBy`). Store/Property do have
  `submittedAt`. Either add `submittedAt` to `ProfessionalProfile` (it's a
  meaningful concept — "when did this professional submit for review" is not
  the same moment as row creation) or drop `"submittedAt"` as a valid sort
  option when `entityType === "professional"` and say so in the contract.

---

## 2b. Second-pass findings (source-level hardening)

The following eight findings were surfaced during a second-pass trace against
the actual source files. Each has a direct code-level citation.

### F13 — PII is persisted in audit log metadata across all four entity services

All four verification services pass user email addresses into the
`createAuditLog` `metadata` field, which is stored as the `AdminAuditLog.details`
JSON blob — a permanent, queryable persistence layer:

- `professional-verification.service.ts` L79: `userEmail: professional.user.email`
- `store-verification.service.ts` L84: `ownerEmail: store.professional.user.email`
- `property-verification.service.ts` L83: `agentEmail: property.agent.user.email`
- `license-verification.service.ts` L105: `userEmail: license.professional.user.email`

ADR-ADMIN-003 explicitly prohibits logging `email`. ADR-ADMIN-008 states
audit metadata is "Class C/D only." Email addresses are Class A PII. The
audit log is not structured logging, but the prohibition applies to both —
the rationale (PII exposure in log aggregators, backup tapes, export dumps)
is the same regardless of storage medium.

**Fix:** Replace `userEmail` / `ownerEmail` / `agentEmail` with the
corresponding non-PII identifier (`userId`, `ownerId`, `agentId`) in the
audit metadata. The admin who needs to know "whose email was this" can
resolve it at query time via the `targetId` → `User` join.

---

### F14 — `resendNotification` and `getEntityName` are copy-pasted 4 times

`notification-queue.ts` contains three private `resendNotification` methods
(one per strategy class: `DatabaseQueueStrategy` L213–305,
`RedisQueueStrategy` L501–593, `MemoryQueueStrategy` L831–927) plus the
original path in `notification.service.ts` L42–88. All four are
functionally identical — same template resolution, same `prisma.notification.create`,
same optional `ENABLE_NOTIFICATION_SERVICE` branch.

`getEntityName` appears 4 times: `notification.service.ts` L197–243 (module-level),
plus private methods at `notification-queue.ts` L310–354, L598–642, L932–976.

This is not style debt. When any copy gets a bug fix or behavioral change,
the other three silently diverge. The notification-templates integration,
the status→notification-type mapping logic, and the external-service fetch
are all load-bearing notification behavior duplicated across four ownership
boundaries within the same file.

**Fix:** Extract both into standalone, shared functions (either module-level
in `notification-queue.ts` or in a new `notification-helpers.ts`). Each
strategy delegates to the shared function; `notification.service.ts` also
calls it instead of inlining its own copy.

---

### F15 — Audit log writes are non-transactional for 3 of 4 entity types

Only `license-verification.service.ts` wraps `update + createAuditLog` in
`prisma.$transaction`. The other three:

- `professional-verification.service.ts`: `prisma.professionalProfile.update(...)` L57–66,
  then `createAuditLog(...)` L69–83, no transaction wrapper.
- `store-verification.service.ts`: `prisma.store.update(...)` L61–71,
  then `createAuditLog(...)` L74–88, no transaction wrapper.
- `property-verification.service.ts`: `prisma.property.update(...)` L60–70,
  then `createAuditLog(...)` L73–87, no transaction wrapper.

`createAuditLog` swallows errors (L87: "Don't throw - audit failure shouldn't
block the operation"). So if the audit write fails for any reason (connection
timeout, unique constraint, disk pressure), the entity status changes but
the audit trail has a silent gap — a compliance risk the first pass's §3.6
already calls out for Kenya DPA traceability.

The first pass correctly notes the license service's transactional pattern
as "the correct pattern and the other three entity services should be
brought up to it" (§4, first bullet) but does not treat this as a distinct
finding.

**Fix:** Wrap `update + createAuditLog` in `prisma.$transaction` for all
three services, passing `tx` to `createAuditLog` as the license service
already does.

---

### F16 — `notification-queue.ts` instantiates its own PrismaClient

Lines 25–31 of `notification-queue.ts`:

```ts
let prismaInstance: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}
```

Every other file in this domain imports `prisma` from `@build/db` — the
shared singleton. This file creates a second, independent `PrismaClient`
instance with its own connection pool and query engine. Under load, the
two instances compete for the database's connection limit (Postgres's
`max_connections`, Prisma's `connection_limit`), doubling the effective
connection count from this domain and risking connection exhaustion errors
that only manifest under concurrent traffic.

**Fix:** Delete `getPrisma()` and import `prisma` from `@build/db` like
every other file. The `DatabaseQueueStrategy` and `MemoryQueueStrategy`
constructors currently call `getPrisma()`; replace with the shared import.

---

### F17 — `VerificationDetails` discriminated union excludes `license`

`contracts.ts` L288–300:

```ts
export type VerificationDetails =
  | (VerificationDetailsBase & {
      entityType: "professional";
      entity: ProfessionalEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "store";
      entity: StoreEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "property";
      entity: PropertyEntityDetail;
    });
```

There is no `"license"` branch. `getVerificationDetails` currently falls
through to the property path for any unrecognized entity type (F5), but
even after F5's guard is added, the contract is incomplete — the type system
does not accommodate a license details result. If `getVerificationDetails`
ever needs to return license data (e.g., for the license verification queue
UI), it would require a type assertion to satisfy the return type.

**Fix:** Add a `"license"` branch to the union with a `LicenseEntityDetail`
type. `getVerificationDetails` can still return `err(notFound(...))` for
licenses in the short term, but the contract is ready when the feature
flag enables the license queue UI.

---

### F18 — `executeResilient` retries a non-idempotent mutation

`verify/route.ts` L65–125 wraps `verificationService.verifyEntity` in
`executeResilient` with `retry: { maxAttempts: 2, ... }`. But `verifyEntity`
is not idempotent:

1. `prisma.*.update` changes the entity's `verificationStatus`.
2. `createAuditLog` writes an audit entry.
3. `notifyVerificationResult` creates a `Notification` row and publishes
   to NATS.

If attempt #1's DB write succeeds but the response is lost (network timeout
at the HTTP layer), `executeResilient` retries. Attempt #2 calls
`validateTransition(currentStatus = "VERIFIED", action = "VERIFY")`, which
finds no valid transition from VERIFIED to VERIFIED, and throws
`"Invalid transition from VERIFIED to VERIFIED via VERIFY"`. This is caught
by `executeResilient`, which maps it to a 500/400 error response — so the
admin sees "verification failed" even though the action succeeded on
attempt #1.

ADR-ADMIN-002 requires mutations to "account for idempotency." This
wrapper actively undermines it.

**Fix:** Remove `executeResilient` from the verify route. Replace with a
direct `try/catch` that maps `result.ok === false` to the appropriate HTTP
status. If resilience is needed, add idempotency at the domain layer
(check if the entity is already in the target state and return `ok(...)`)
before wrapping in a retry.

---

### F19 — `mapProfessionalDetails`/`mapStoreDetails`/`mapPropertyDetails` throw, escaping the Result boundary

`service.ts` L384–386, L417–419, L445–447:

```ts
if (!details) {
  throw new Error("Professional profile not found");
}
```

These `throw` statements are inside `mapProfessionalDetails` et al., which
are called from `getVerificationDetails` — a function whose return type is
`Promise<Result<VerificationDetails, VerificationDomainError>>`. The throws
escape the `Result` boundary entirely. The caller gets an unhandled rejection
instead of `err(notFound(...))`.

The guards at L496, L509, L521 _do_ return `err(notFound(...))` for the
`details === null` case — but there is a subtle path where `details` is
non-null (the `findUnique` returns a row) but a required relation is null
(e.g., `details.agent` is null because the agent was deleted), causing a
property access error inside the `map*Details` function that throws
_after_ the null check.

**Fix:** Delete the redundant `throw` guards inside the `map*Details`
functions (the checks at L496/L509/L521 already handle the null case).
Wrap the `map*Details` calls in try/catch that returns `err(...)` for
unexpected shapes, or validate required relations before calling the mapper.

---

### F20 — NATS producer is a singleton with no reconnection or health check

`notification.service.ts` L29–39:

```ts
let natsProducer: JetStreamProducer | null = null;

async function getNatsProducer(): Promise<JetStreamProducer> {
  if (!natsProducer) {
    natsProducer = createProducer("verification-service");
    await natsProducer.connect();
  }
  return natsProducer;
}
```

If the NATS connection drops (server restart, network partition, idle
timeout), `natsProducer` is non-null but its connection is dead. Every
subsequent `publishWithRetry` call fails with a connection error.
`publishVerificationEvent` catches these errors (L65: `.catch(err => logger.error(...))`)
and swallows them — so NATS events silently stop being published with
zero operator visibility beyond a log line that might be in a different
aggregation window.

There is no reconnection logic, no health check, no circuit breaker, and
no metric emitted when the NATS path degrades. The `shutdownNatsProducer`
export (L307) is never called from any lifecycle hook in the provided code.

#### Fix for F20

- Add a connection-health wrapper around `getNatsProducer` that resets
  `natsProducer = null` when the connection is detected as unhealthy,
  forcing reconnection on the next call.
- Add a simple cooldown (e.g., 30 seconds) to prevent thundering-herd
  reconnection attempts.
- Register `shutdownNatsProducer` with the process's SIGTERM/SIGINT handler.

---

## 3. What's actually missing (the newsletter README's §10 equivalent, for this slice)

1. **Wire real outbound notifications.** Nothing in this domain sends an
   email today (F3). This is the single highest-leverage fix — verification
   decisions are currently invisible to the people they're about unless they
   happen to check the in-app notification bell.
2. **Finish the correlation/logging migration.** `correlation.ts` and
   `logger.ts` are shipped, tested-looking infrastructure that nothing calls
   (F1). Wiring them is mechanical and should happen before more routes are
   added on top of the current, disconnected pattern.
3. **Split producer/worker in `notification-queue.ts`** before the Redis
   path sees real traffic (F2) — this is a correctness bug waiting for
   concurrency, not a style nit.
4. **Kill or absorb the legacy `verify-professional` route** (F4) — every
   day it stays live is another day the audit trail and notification
   guarantees for professional verification are not actually guaranteed.
5. **Bound the `"all"` queue query** (F7) before the first pilot's bulk
   contractor import hits the admin dashboard.
6. **Backfill `verifiedById` on `Store`/`Property`** and fix notes
   persistence (F8) — this is a compliance/audit gap (Kenya DPA / GDPR-style
   "who made this decision" traceability), the same category of concern the
   newsletter README treats as load-bearing for consent records.
7. **Add the license branch** to `getVerificationDetails`/narrow
   `VerifyEntityInput` (F5) before `batchVerifyEntities` or any new caller
   accidentally routes a license through the property path.
8. **Decide the queue-provider production story** (F9 + F10) — either finish
   wiring `QueueProvider.DB` as the no-Redis default, or explicitly document
   Redis as a hard prerequisite for this domain and fail startup without it,
   matching the loud-failure philosophy the newsletter ESP stub already
   models well.

---

## 4. What's solid and worth preserving as-is

In the spirit of the newsletter README's §4 ("treat as invariants, not
implementation details to refactor away"):

- **Transactional audit logging in `license-verification.service.ts`** —
  update + `createAuditLog` inside `prisma.$transaction` is the correct
  pattern and the other three entity services should be brought up to it if
  they aren't already doing this at the call site.
- **Lexicographic sorting before batch operations**
  (`batchVerifyDocuments`/`batchVerifyEntities` sort by ID before iterating)
  — a real, previously-learned deadlock-prevention measure; don't let a
  future refactor drop it for a `Promise.all` "optimization."
- **The `Result<T, DomainError>` discipline** throughout `service.ts` — no
  thrown domain errors escape the public API surface, which is exactly the
  boundary the newsletter domain's error model (§5 there) is built around
  too. Keep both slices doing this the same way.
- **Feature-flagging the license queue** (`NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE`)
  rather than shipping a half-wired list view — good instinct, just needs
  F5's gaps closed so the flag can safely go on.

---

## 5. Priority order (staff call)

| Tier | Findings                                                       | Why                                                                                      |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | F2 — Worker in request path                                    | Live correctness/scaling bug, not hypothetical                                           |
|      | F4 — Duplicate verify-professional route                       | Data-integrity/audit risk, grows worse daily                                             |
|      | F7 — Unbounded "all" queue query                               | DoS vector before pilot data load                                                        |
|      | F18 — Non-idempotent retry wrapping a mutation                 | Violates ADR-ADMIN-002, admin sees "failed" on success                                   |
|      | F19 — Throws escape the Result boundary                        | Crashes callers with unhandled rejections                                                |
|      | F5 — License type hole in verifyEntity                         | Silent wrong-entity mutation, type-level guard is free                                   |
|      | F14, F16, F17 — Refactor shipped with F2/F5                    | Duplicate PrismaClient, copy-pasted resend, union gap — ships naturally with F2/F5 split |
| 2    | F8 — Missing verifiedById + notes persistence                  | Compliance/audit gap, cheap schema fix                                                   |
|      | F15 — Non-transactional audit writes (3 of 4 entities)         | Silent audit gaps, ships with F8 migration                                               |
|      | F13 — PII in audit log metadata                                | ADR-ADMIN-003 violation, persistent PII in queryable store                               |
|      | F9 + F10 — Dead QueueProvider.DB + silent memory fallback      | Production safety, env hardening                                                         |
| 3    | F1 — Unwired correlation/logging                               | High long-term value, low urgency                                                        |
|      | F11 — PII in NATS payload / logging inconsistency              | Ships with F1 naturally                                                                  |
|      | F20 — NATS producer no-reconnect                               | Silent degradation, observable only via log grep                                         |
| 4    | F3 — No email ever sent                                        | Highest product impact but most implementation work                                      |
|      | F6 — Unvalidated pagination params                             | Low risk but noisy 500s, hygiene                                                         |
|      | F12 — Schema/type inconsistencies (status strings, any, index) | Correctness/hygiene, batch into one cleanup PR                                           |
