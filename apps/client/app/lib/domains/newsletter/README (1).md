# Newsletter Domain — README

Double opt-in newsletter subscription slice for Build Market. Owns its own durable subscriber record independent of whatever ESP (Resend, Mailchimp, or a local stub) is currently configured, so ESP outages, migrations, or provider swaps never touch the request path or lose subscriber history.

> See also: `NEWSLETTER_AUDIT.md` (open issues, prioritized) and `NEWSLETTER_WORKER_WIRING.md` (why/how the background workers need a dedicated process — **read this before deploying**, since as of this writing the workers are not yet wired to run anywhere).

---

## 1. Design summary

The core decision this slice makes: **a subscribe request only ever writes to our own Postgres table.** It never calls the ESP synchronously. This buys:

- Requests don't block on, or fail because of, ESP latency/outages.
- A durable, queryable consent record (GDPR / CAN-SPAM / Kenya DPA) that survives ESP dashboard changes or provider migration.
- ESP sync failures get BullMQ's retry/backoff instead of a single best-effort `fetch()` silently failing a user's signup.

Double opt-in is implemented by us, not the ESP — Resend does not send a confirmation email on contact creation. The flow is:

```text
subscribe() ──writes DB (PENDING_CONFIRMATION)──▶ enqueue confirmation email job
                                                            │
                                                            ▼
                                          confirmation-email.worker sends via Resend
                                                            │
                     user clicks link, page POSTs token ────┘
                                                            ▼
confirmSubscription() ──marks SUBSCRIBED──▶ enqueue esp-sync job (action: "subscribe")
                                                            │
                                                            ▼
                                       esp-sync.worker creates/updates ESP contact
```

Unsubscribe (either a human clicking the email footer link, or a mail provider's RFC 8058 one-click `List-Unsubscribe-Post`) follows the same shape: mark `UNSUBSCRIBED` locally first, then enqueue an `esp-sync` job with `action: "unsubscribe"`.

---

## 2. File map

```text
contracts.ts            Zod-inferred types, domain input/output shapes, error codes, job payload types
service.ts               Domain logic: subscribe / confirmSubscription / unsubscribe
repository.ts            Prisma access layer — the only file that touches prisma.newsletterSubscriber
esp-provider.ts           Zero-dependency accessor for the configured ESP name (kept separate so workers
                          don't transitively import queue-producer code — see file header comment)
esp-sync.ts               Outbound ESP calls (Resend / Mailchimp / stub) — worker-only, never request-path
mappers.ts                DTO serialization (Date/Decimal-safe) + toPublicSubscribeResult allow-list
newsletter.queue.ts       BullMQ Queue producers (SafeQueue wrapper — build-phase-safe, typed per job)
esp-sync.worker.ts        BullMQ Worker: processes "newsletter-esp-sync" jobs
confirmation-email.worker.ts  BullMQ Worker: processes "newsletter-confirmation-email" jobs
resend.ts                 POST /api/webhooks/resend — bounce/complaint suppression via Svix-verified webhook
route.ts (×3)             POST /api/newsletter/subscribe, /confirm, /unsubscribe
shared.ts                 Route-layer helpers: rate-limit-aware logging, domain-error → HTTP status mapping
index.ts                  Public barrel export for the domain
subscribe.route.test.ts   Route-level test coverage for /subscribe (see Audit D-1 for gaps elsewhere)
```

Everything above `route.ts` is framework-agnostic domain code; everything at `route.ts` and `shared.ts` is the Next.js adapter layer. `esp-sync.ts` and both `*.worker.ts` files are **worker-only** — see the import boundary below.

---

## 3. The request-path / worker-path boundary (important)

This is the single most load-bearing architectural rule in this slice, and it's currently enforced only by convention (see `NEWSLETTER_AUDIT.md`, A-2, for the eslint rule that should exist):

- `esp-sync.ts` and `*.worker.ts` must **only** ever be imported by the dedicated worker entrypoint (see `NEWSLETTER_WORKER_WIRING.md`).
- Nothing under `app/api/**` or `app/**` may import them.

Why: a `bullmq.Worker` opens a Redis connection and starts a polling loop the moment it's constructed, which happens at module-evaluation time. Importing one into a Next.js route handler means every serverless invocation — or every dev hot-reload — opens its own connection and its own polling loop, leaking connections and risking double-processing of jobs.

As of this writing, **no file imports the two worker modules**, which means they never run in any deployed process. This is not a stylistic gap — it means confirmation emails and ESP syncs never actually happen. Fixing this is the subject of `NEWSLETTER_WORKER_WIRING.md` and is priority #1 in the audit.

---

## 4. Idempotency guarantees (the part most worth understanding deeply)

Two flows in this slice are idempotent by explicit design, and both exist because of a real production failure mode:

**Confirmation is idempotent.** Corporate email security gateways (Microsoft Defender Safe Links, Proofpoint, Mimecast) and some mail clients prefetch every link in an email body to scan for malware _before_ the user opens the message. If confirming were a single-use token, the scanner consumes it silently and the real user's own click then fails with "invalid confirmation link" — a widely-seen support-ticket pattern industry-wide. The fix here: `markConfirmed()` intentionally does **not** null out `confirmationTokenHash`, and `confirmSubscription()` checks `status === "SUBSCRIBED"` first and returns success with no side effects re-run (no duplicate ESP-sync enqueue) rather than treating a repeat hit as an error.

**Unsubscribe is idempotent**, for the same reason plus a second one: Gmail/Yahoo's Feb 2024 bulk-sender requirements mean a mail provider's own "Unsubscribe" UI issues a POST directly to the `List-Unsubscribe` URL — with no user interaction — and per RFC 8058 that request must succeed with no further confirmation step. A second hit (human click racing the provider's one-click POST) must never surface as an error.

**The resubscribe cooldown is gated on a dedicated column, not `updatedAt`.** The previous implementation compared `existing.updatedAt` against a cooldown window — but `updatedAt` is bumped by _any_ write to the row, including the async ESP-sync-bookkeeping writes (`updateEspSyncSuccess`/`updateEspSyncFailure`) that happen completely independently of resubscribe activity. A subscriber whose ESP sync merely retried in the background would look like they'd just resubscribed, permanently locking out legitimate resubscribe attempts. `lastConfirmationSentAt` is the fix — it's only ever touched when a confirmation email is actually (re)sent.

If you're modifying this slice, treat all three of the above as invariants to preserve, not implementation details to refactor away for cleanliness.

---

## 5. Error model

Domain errors are a fixed, small set of codes (`contracts.ts: NewsletterErrorCode`), each mapped to an HTTP status and a static client-facing message in `shared.ts`. The important property: **internal error detail never reaches the client.** `esp-sync.ts`'s error messages (e.g. `"Resend account ID 12345 rate limited at datacenter us-east-1"`) are for logs only — `newsletterDomainErrorToClientMessage()` always returns a generic string per error code, regardless of what the underlying provider said. `subscribe.route.test.ts` has an explicit regression test for this boundary; preserve it if you touch error mapping.

| Code                   | HTTP | Meaning                                                          |
| ---------------------- | ---- | ---------------------------------------------------------------- |
| `invalid_email`        | 400  | Rejected by validation/ESP                                       |
| `invalid_token`        | 400  | Confirm/unsubscribe token not found                              |
| `token_expired`        | 400  | Confirmation token past TTL                                      |
| `suppressed`           | 400  | Previously bounced/complained — requires manual review to lift   |
| `resubscribe_cooldown` | 429  | Re-signup attempted before `RESUBSCRIBE_COOLDOWN_MS` elapsed     |
| `provider_unavailable` | 503  | ESP returned a non-retryable error (surfaced from the sync job)  |
| `esp_misconfigured`    | 503  | Required ESP env vars missing — an ops problem, not a user error |

---

## 6. Background jobs

Two BullMQ queues, both configured (in `newsletter.queue.ts`) with `attempts: 5`, exponential backoff starting at 60s (1m/2m/4m/8m/16m).

### `newsletter-esp-sync`

- **Producer:** `service.ts`, on every `confirmSubscription()` (action: `subscribe`) and `unsubscribe()` (action: `unsubscribe`).
- **Consumer:** `esp-sync.worker.ts`.
- **DB-side retry bookkeeping**, independent of BullMQ's own retry: `espSyncStatus`, `espSyncAttempts`, `espLastSyncError`, `espNextRetryAt`. After `NEWSLETTER_CONFIG.ESP_SYNC_MAX_ATTEMPTS` the row moves to `DEAD_LETTER` (see Audit A-3 — this currently has no active alerting attached).
- **Reconciliation gap:** `repository.findDueForEspSync()` exists to catch rows whose sync got stuck outside BullMQ's own retry window, but nothing currently schedules a call to it (see Audit A-4).

### `newsletter-confirmation-email`

- **Producer:** `service.ts`, via `enqueueConfirmationEmail()`, on both fresh signup and resubscribe.
- **Consumer:** `confirmation-email.worker.ts`, calling Resend's transactional Emails API directly (deliberately separate from the Contacts/Segments API used by ESP sync — the confirmation link has to go out immediately at signup, before any ESP contact exists).
- Sets the RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers so mail clients surface a native one-click unsubscribe button.
- **No DB-side failure visibility yet** — unlike ESP sync, a failed confirmation email has no equivalent status column (see Audit A-5).

### Where these actually run

**Nowhere yet.** See `NEWSLETTER_WORKER_WIRING.md` for the required entrypoint process and deployment target (not Vercel — BullMQ workers need a persistent process).

---

## 7. Webhook: bounce/complaint suppression

`POST /api/webhooks/resend` verifies Svix signatures (raw body, replay-window check, `timingSafeEqual`) before processing `email.bounced`/`contact.bounced` and `email.complained`/`contact.complained` events, marking the subscriber `BOUNCED`/`COMPLAINED` via `markSuppressed()`. Suppressed subscribers cannot be resubscribed through the normal `/subscribe` flow (`service.ts` returns the `suppressed` error code) — lifting suppression is a manual/admin action by design, to protect sender reputation.

Any other Resend event type (delivered, opened, clicked, etc.) is received and ignored — Resend sends every event to every configured webhook URL with no per-type subscription filter, so this is expected, not an error condition.

---

## 8. Configuration

Expected env surface (verify exact key names against `envConfig` — some file comments flag their own assumptions here, e.g. `confirmation-email.worker.ts`'s `envConfig.app.url` comment vs. the `envConfig.appUrl` actually used in code):

| Key (as referenced in code)                | Used by                                       | Notes                                                        |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------ |
| `envConfig.newsletter.provider`            | `esp-sync.ts`, `esp-provider.ts`              | `"resend"` \| `"mailchimp"` \| unset (stub)                  |
| `envConfig.newsletter.resendApiKey`        | `esp-sync.ts`, `confirmation-email.worker.ts` |                                                              |
| `envConfig.newsletter.resendSegmentId`     | `esp-sync.ts`                                 | Resend segment subscribers are added to                      |
| `envConfig.newsletter.apiKey` / `listId`   | `esp-sync.ts` (Mailchimp branch)              | Mailchimp datacenter is derived from the key's `-xxN` suffix |
| `envConfig.newsletter.resendWebhookSecret` | `resend.ts`                                   | Svix `whsec_...` signing secret                              |
| `envConfig.appUrl`                         | `confirmation-email.worker.ts`                | Base URL for confirm/unsubscribe links                       |
| `envConfig.isProd`                         | `esp-sync.ts` (stub branch)                   | Stub provider refuses to run in production                   |

**Stub provider behavior is deliberate:** in non-production, an unconfigured ESP no-ops successfully (`syncViaStub`) so local dev doesn't need real ESP credentials. In production, the same unconfigured state fails loudly instead of silently pretending every signup succeeded — this was a real bug in a previous version and the fix is load-bearing; don't relax it.

---

## 9. Testing

Current coverage: `subscribe.route.test.ts` only (happy path, rate limiting, validation, honeypot, ESP error → client message mapping, PII-leak boundary). `confirm`/`unsubscribe` routes, `service.ts`'s concurrency-race handling, `esp-sync.ts`'s provider branches, and both workers are currently untested — see `NEWSLETTER_AUDIT.md` section D for the prioritized list.

---

## 10. Before this goes anywhere near real signups

1. Wire the worker entrypoint (`NEWSLETTER_WORKER_WIRING.md`) — without it, nothing in this document past section 1 actually happens.
2. Confirm Resend rate limits against the workers' `concurrency: 5` setting before a pilot's bulk-imported contact list hits `/subscribe` in a burst.
3. Wire dead-letter alerting (Audit A-3) and the `findDueForEspSync` reconciliation sweep (Audit A-4) — both are the difference between "retries with backoff" being a real guarantee versus a comment describing intent.
