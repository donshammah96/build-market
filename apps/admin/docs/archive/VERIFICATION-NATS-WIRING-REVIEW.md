# Staff Review: Wiring `@build/nats` into the Verification Domain

Scope: `apps/admin/src/lib/domains/verification/internal/**` — the 14 files
covering professional/store/property/license verification, audit logging,
notifications, and their retry queue.

## TL;DR

- **License verification publishes no NATS event at all**, despite
  `@build/nats` already shipping a purpose-built `LicenseVerificationEvent`
  type for exactly this. This is a real, live gap: admins can verify or
  reject a license today and the professional gets **no email, no
  downstream event, nothing** — the one path where every other entity
  type (professional/store/property) already works.
- **Two independent, ad-hoc NATS producer singletons** exist
  (`notification.service.ts`, `license-external-verification.service.ts`),
  one of them typed `any`. Neither is wrong exactly, but there's no single
  shared entry point, so every new file that wants to publish reinvents
  the pattern.
- **`notification-queue.ts` (three queue strategies, ~900 lines) reimplements
  retry-with-backoff and dead-lettering** — which is precisely what
  JetStream's `maxDeliver` + NAK backoff (already built and tested in
  `@build/nats`) does natively, for a different failure mode of the same
  underlying problem.
- **Recommendation:** wire `@build/nats` in — but narrowly. Fix the
  license gap and consolidate the producer now. Treat migrating the
  notification retry queue onto JetStream as a deliberate phase-2
  decision, not something to bundle into this pass.

---

## 1. Autopsy

### `types.ts`

Clean. `EntityType` includes `"license"`, `VALID_TRANSITIONS` correctly
model the finite-state-machine for all entity types including license.
No issues.

### `professional-/store-/property-verification.service.ts`

Structurally identical: fetch entity → `validateTransition` → single
`prisma.$transaction` (entity update + `createAuditLog`) → return
`VerificationResult`. None of these publish to NATS directly — that's
correctly left to the caller (the admin action layer, not in scope here)
via `notification.service.ts`'s `notifyVerificationResult()`. This
separation is good: domain logic stays testable without mocking NATS.

The three files are near-duplicates of each other (see §3.5). Not a bug,
but worth collapsing while we're already touching all of them.

### `license-verification.service.ts`

Same shape as the three above, but **nothing downstream ever gets told
this happened.** `notifyVerificationResult()` explicitly skips it:

```ts
// notification.service.ts, publishVerificationEvent()
if (result.entityType === "license") {
  return;
}
```

This isn't an oversight in that file — `VerificationEvent`'s `entityType`
union in `@build/nats` doesn't include `"license"` at all, so publishing
a license result through it would be a type error. The skip is the
_correct_ short-term guard against a type mismatch. The actual bug is
one level up: nobody ever built the license-specific publish path using
the type that already exists for it.

### `license-external-verification.service.ts`

Publishes `license.auto_verify_requested` — a _different_ concern
(asking an external authority API to auto-verify) from admin-driven
manual verification. Two things worth flagging:

- `natsProducer: any = null` — throws away all type safety from
  `@build/nats` for no reason; should be `JetStreamProducer | null`.
- The published object literal isn't type-checked against
  `LicenseVerificationEvent` at all (`publishWithRetry` is generic over
  `T extends object`, so anything typechecks). It happens to line up
  with most of that interface's fields today, but nothing would catch it
  drifting.
- **Consumer confirmed**: Active consumer exists at `apps/client/app/workers/license-auto-verify.consumer.ts` subscribing to `license.auto_verify_requested` via JetStream worker `license-auto-verify-worker`.

### `notification.service.ts`

Owns its own `natsProducer` singleton (typed correctly this time,
`JetStreamProducer | null`). `publishVerificationEvent()` is
fire-and-forget (`.catch()`, not awaited) from the caller
`notifyVerificationResult()`, which is a reasonable choice — a slow NATS
publish shouldn't block the notification response — but note the failure
mode: if `publishWithRetry`'s 3 internal attempts all fail, the catch
just logs. Unlike the DB-notification/external-HTTP-notification failure
path (which _does_ get queued via `queueFailedNotification`), a failed
NATS publish has no re-queue equivalent. In practice this is probably
fine (`publishWithRetry` is already resilient, and the in-app +
external-service notification still succeeded via the other paths), but
it means downstream event consumers (the email worker) can permanently
miss an event with no automatic recovery.

### `notification-queue.ts`

Three parallel strategies (Memory/DB/Redis via BullMQ) implementing:
exponential backoff, max-attempts dead-lettering, manual requeue, stats.
This is a solid, well-tested reliability pattern — but it's solving the
exact same shape of problem `@build/nats`'s `consumer.ts` already solves
(NAK-based redelivery with exponential backoff, `maxDeliver`-based
termination), and there's a `NOTIFICATIONS` stream preset (workqueue
retention, 24h max age) sitting in `@build/nats` unused for this. See
§3.4 for why I'm _not_ recommending ripping this out immediately.

### `notification-retry.worker.ts`

Thin BullMQ worker wrapper around `resendNotification()`. Fine as-is,
contingent on §3.4's decision.

### `notification-helpers.ts`, `entity-routes.ts`, `notification-templates.ts`

No NATS involvement, no issues found relevant to this review.

### `verification-email.worker.ts`

Subscribes to `verification.>` — which, given the license gap above,
means it structurally _cannot_ receive license events even once that gap
is fixed, unless it also subscribes to whatever subject license events
end up on (see §3.1 — I'm proposing `license.>`, a separate namespace,
consistent with `license-external-verification.service.ts`'s existing
`license.auto_verify_requested` precedent).

### `audit-service.ts`

`createAuditLog(data, tx?: any)` — the transaction client parameter is
untyped. Should be `Prisma.TransactionClient`. Separately: the entire
function body, including the actual audit DB write, is wrapped in one
try/catch that only logs on failure. That means a verification action
can complete successfully with **zero audit trail** and raise no error
to the caller. Given how much weight this codebase visibly puts on audit
correctness elsewhere (idempotency keys on every high-risk mutation, per
the root changelog), this seems like it should at minimum be an alerted
condition, not a silent log line — but I'm flagging this as worth a
deliberate decision, not silently changing failure-swallowing behavior
in a domain-review pass.

### `index.ts`

Barrel export, no issues.

---

## 2. Should we wire `@build/nats` into these services?

**Yes, but not by adding `producer.publish()` calls directly inside
`verifyProfessional`/`verifyStore`/`verifyProperty`/`verifyLicense`.**

Two options, and why the second wins:

**Option A — publish from inside each domain service.** Guarantees no
verification action can complete without an attempted event publish.
Downside: couples domain logic to messaging infrastructure, makes unit
testing these functions require mocking NATS, and — more importantly —
creates a dual-write problem: the Prisma transaction can commit
successfully while the publish (outside that transaction, since NATS
isn't transactional with Postgres) fails, with no record that it needs
retrying.

**Option B — keep domain services pure; fix the _caller-side_ gap.**
`verifyProfessional`/`verifyStore`/`verifyProperty` already work this
way today (verify → caller separately calls `notifyVerificationResult`).
The actual bug is that `verifyLicense`'s equivalent caller-side hookup
was never built. Fixing that closes the gap using the same pattern
already proven correct for the other three entity types, rather than
introducing a new pattern.

I'd go further and note: if you want _stronger_ delivery guarantees than
"fire an event and retry a few times" — e.g. before this is
customer-facing with real professionals depending on license-status
emails — the rigorous version of Option A is a **transactional outbox**:
write an `OutboxEvent` row inside the same `prisma.$transaction` as the
entity update + audit log, and have a separate always-on relay process
read outbox rows and publish them to NATS, marking them sent only after
a successful ack. That gets you exactly-once eventual publish with no
dual-write risk. I'm not proposing building that _now_ — you're
pre-launch with no live users per your own notes, and `msgId`-based
JetStream dedup already gives you a decent safety net — but it's worth
having as the "before this matters for real" plan rather than
retrofitting it under pressure later.

---

## 3. Proposed implementation

### 3.1 Close the license event gap

New function in `notification.service.ts` (or split into its own
`license-notification.service.ts` if you'd rather keep the file
focused — either works, shown here inline for brevity):

```ts
import type { LicenseVerificationEvent } from "@build/nats";
import type { LicenseVerificationResult } from "./license-verification.service";

function mapLicenseResultToEvent(
  result: LicenseVerificationResult,
  adminId: string,
  correlationId: string,
): LicenseVerificationEvent {
  const action: LicenseVerificationEvent["action"] =
    result.newStatus === "VERIFIED"
      ? "verified"
      : result.newStatus === "REJECTED"
        ? "rejected"
        : result.newStatus === "NEEDS_CORRECTION"
          ? "needs_correction"
          : "resubmitted"; // shouldn't be reached for admin-driven actions

  return {
    licenseId: result.licenseId,
    professionalId: result.professionalId,
    authority: result.authority,
    licenseNumber: result.licenseNumber,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    action,
    adminId,
    verificationMethod:
      result.verificationMethod === "MANUAL" ? "MANUAL" : "SYSTEM",
    correlationId,
    timestamp: new Date().toISOString(),
    ...(result.reason || result.notes
      ? { metadata: { reason: result.reason, notes: result.notes } }
      : {}),
  };
}

export async function publishLicenseVerificationEvent(
  result: LicenseVerificationResult,
  adminId: string,
  correlationId: string,
): Promise<void> {
  try {
    const producer = await getAdminNatsProducer(); // see 3.2
    const event = mapLicenseResultToEvent(result, adminId, correlationId);
    const subject = `license.${event.action}`;

    // Explicit type param: catches the event shape drifting from
    // LicenseVerificationEvent at compile time, unlike the untyped
    // publish in license-external-verification.service.ts today.
    await producer.publishWithRetry<LicenseVerificationEvent>(subject, event, {
      msgId: `license-${result.licenseId}-${event.action}-${Date.now()}`,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    logger.info("License verification event published to NATS", {
      subject,
      licenseId: result.licenseId,
      status: result.newStatus,
    });
  } catch (error) {
    logger.error(
      "Failed to publish license verification event to NATS",
      error as Error,
      { licenseId: result.licenseId },
    );
  }
}
```

Caller-side: wherever the admin action layer currently calls
`verifyLicense()` (not in the files reviewed here — confirm this
exists), add the matching call, mirroring how professional/store/property
already call `notifyVerificationResult()` after their own verify calls:

```ts
const result = await verifyLicense(request);
await publishLicenseVerificationEvent(result, request.adminId, correlationId);
```

And extend `verification-email.worker.ts` with a second subscription
entry for the new subject namespace, since `license.>` is separate from
`verification.>`:

```ts
await consumer.subscribe([
  { subject: "verification.>" /* existing handler, unchanged */ },
  {
    subject: "license.>",
    consumerOptions: { durableName: "verification-email-worker-license" },
    handler: async (msg: MessagePayload) => {
      const event = msg.data as LicenseVerificationEvent;
      // only send email for admin-driven, terminal outcomes —
      // not for auto_verify_requested/submitted/expiring_soon, which
      // aren't "here's a decision" events
      if (
        !["verified", "rejected", "needs_correction"].includes(event.action)
      ) {
        return;
      }
      // build + send email using event.licenseId/authority/licenseNumber,
      // resolving recipient via event.professionalId — same pattern as
      // resolveRecipientEmail() above, adapted for this event shape
    },
  },
]);
```

### 3.2 One shared, typed NATS producer

New file, `apps/admin/src/lib/infrastructure/nats-client.ts`:

```ts
import { createProducer, type JetStreamProducer } from "@build/nats";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("admin-nats-client");
let producer: JetStreamProducer | null = null;

export async function getAdminNatsProducer(): Promise<JetStreamProducer> {
  if (!producer) {
    producer = createProducer("admin-service");
    await producer.connect();
    logger.info("Admin NATS producer connected");
  }
  return producer;
}

export async function shutdownAdminNatsProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Admin NATS producer shutdown complete");
  }
}
```

Then:

- `notification.service.ts` drops its own `natsProducer` module state
  and imports `getAdminNatsProducer` instead.
- `license-external-verification.service.ts` does the same, which also
  fixes the `any` typing for free.
- `shutdownNatsProducer()` (currently in `notification.service.ts`) and
  any equivalent in the external-verification file both collapse into
  the one `shutdownAdminNatsProducer()`, called once from wherever the
  app's graceful-shutdown hook lives.

This doesn't change behavior (the underlying `createNatsClient()`
connection was already a de facto shared singleton) — it just makes the
sharing explicit and gives every future file one obvious import instead
of a fourth ad-hoc lazy-singleton pattern.

### 3.3 Type `audit-service.ts`'s transaction parameter

```ts
import type { Prisma } from "@build/db";

export async function createAuditLog(
  data: AuditLogData,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  // ...unchanged
}
```

Small, but it's the one place in this batch of files where a real type
(already available from `@build/db`) was dropped in favor of `any` for
no apparent reason.

### 3.4 (Phase 2, not this pass) Consider migrating `notification-queue.ts` onto JetStream

Not proposing this now — it's a bigger, riskier change than the license
gap, and the existing BullMQ/DB/Memory system works. But worth having on
the roadmap: today you maintain three custom retry strategies for one
failure mode (notification delivery), while `@build/nats`'s consumer
already gives you NAK-backoff + `maxDeliver` termination + the
`NOTIFICATIONS` stream preset, for free, with the metrics and tracing
this package already has built in. If `notification-queue.ts` ever needs
non-trivial new work, that's the natural trigger to revisit whether it
should exist at all versus becoming a `JetStreamConsumer` subscription
on `notification.>` with `maxDeliver` doing the dead-lettering.

### 3.5 (Phase 2, optional) Collapse the three duplicated verify functions

`verifyProfessional`/`verifyStore`/`verifyProperty` are structurally
identical modulo the Prisma delegate and field names. A generic
`verifyEntity<TDelegate>()` parameterized by delegate + field mapping
would remove the duplication, but this touches three files for a
non-urgent readability win — worth doing in a dedicated pass, not
bundled into the NATS wiring fix.

---

## 4. Rollout plan

1. Ship §3.2 (shared producer) and §3.3 (typing fix) first — pure
   refactors, zero behavior change, low risk.
2. Ship §3.1 (license event) behind the same testing discipline as the
   rest of `@build/nats`: add an integration test asserting
   `verifyLicense()` → `publishLicenseVerificationEvent()` actually lands
   a message on `license.<action>`, following the same
   spawned-`nats-server` pattern already in
   `packages/nats/src/test/integration/`.
3. Confirm external-verification consumer operation (verified live at `apps/client/app/workers/license-auto-verify.consumer.ts`).
4. Revisit §3.4 and §3.5 as separate, deliberately-scoped follow-ups.

## 5. Open questions (Resolved)

- **Where does the admin action layer call `verifyLicense()`? Confirming this exists and where to insert `publishLicenseVerificationEvent()` in the same call site.**
  - **Confirmed**: `verifyLicense()` is called in `apps/admin/src/actions/admin/verification.ts` in two places:
    1. Inside `verifyEntity()` at [verification.ts:L221](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/verification.ts#L221) when `validated.entityType === "license"`.
    2. Inside the dedicated `verifyLicense()` server action at [verification.ts:L565](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/verification.ts#L565).
  - Both server actions delegate to `verificationService.verifyLicense()` in `apps/admin/src/lib/domains/verification/service.ts` ([service.ts:L830](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/service.ts#L830)).
  - **Insertion Site**: The ideal architectural location for `publishLicenseVerificationEvent()` is inside `verificationService.verifyLicense()` in `apps/admin/src/lib/domains/verification/service.ts` immediately following `verifyLicenseInternal()`. This keeps domain business logic and NATS event emission behind the domain service boundary per ADR-ADMIN-002, eliminating duplication across server actions.

- **Is there an existing consumer for `license.auto_verify_requested`? If it doesn't exist, that request event is currently write-only.**
  - **Confirmed**: An active consumer exists at `apps/client/app/workers/license-auto-verify.consumer.ts` ([license-auto-verify.consumer.ts:L170](file:///c:/Users/User/build-market/apps/client/app/workers/license-auto-verify.consumer.ts#L170)).
  - It runs a JetStream consumer worker (`license-auto-verify-worker` in group `license-auto-verify-group`) subscribing directly to `license.auto_verify_requested`. The event is **not** write-only.

- **Is audit-log write failure ever alerted on anywhere, or does it purely rely on the try/catch log line in `audit-service.ts`?**
  - **Confirmed**: It relies purely on the try/catch block and `logger.error("Failed to create audit log", ...)` call in `apps/admin/src/lib/domains/verification/internal/audit-service.ts` ([audit-service.ts:L81-L88](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/audit-service.ts#L81-L88)).
  - There is no secondary in-app alert, metric counter, or dedicated event published on audit log write failure. Any alerting depends entirely on log ingestion infrastructure monitoring structured error logs emitted by `StructuredLogger`. (Note: Per ADR-ADMIN-008, audit write failures are non-blocking and emit structured admin log events).
