/**
 * Newsletter domain service
 *
 * Responsibility: own the newsletter subscription lifecycle
 * (subscribe -> confirm -> [unsubscribe]) against our own database, and
 * keep the configured ESP (Resend by default) in sync via a background
 * job rather than a synchronous call in the request path.
 *
 * Why a DB table in front of the ESP (this is the main change from the
 * previous version, which called out to Resend directly and had no local
 * record at all):
 *   - A request no longer blocks on, or fails because of, ESP latency/
 *     outages — subscribe() only ever does a local DB write.
 *   - We have a durable, queryable record of consent (GDPR/CAN-SPAM/Kenya
 *     DPA) independent of whatever the ESP dashboard shows.
 *   - ESP sync failures retry with backoff (BullMQ) instead of being a
 *     single best-effort fetch() that silently fails the user's signup.
 *   - Switching ESPs later does not lose subscriber history.
 *
 * Double opt-in is implemented by us, explicitly. Resend does not send a
 * confirmation email on contact creation (unlike Mailchimp's "pending"
 * status) — the previous version's doc comment claiming otherwise was
 * incorrect. subscribe() only writes PENDING_CONFIRMATION locally and
 * enqueues our own confirmation email; the ESP contact is only created
 * once confirmSubscription() has been called.
 *
 * Observability: this file does NOT log PII (no raw email in log fields).
 * The route adapter owns structured logging per ADR-005.
 *
 * STAFF AUDIT NOTES (see NEWSLETTER_AUDIT_AND_PLAN.md for full writeup):
 *
 * 1. Resubscribe cooldown bug (fixed here): the previous implementation
 *    compared `existing.updatedAt` against a cooldown cutoff. `updatedAt`
 *    is a `@updatedAt` column that Prisma bumps on ANY write to the row —
 *    including updateEspSyncSuccess/updateEspSyncFailure, which run
 *    asynchronously from the BullMQ worker completely independent of
 *    resubscribe activity. A subscriber whose ESP sync merely retried
 *    would look like they'd just resubscribed, permanently locking out
 *    legitimate resubscribe attempts behind a rolling cooldown that never
 *    expires. This now uses a dedicated `lastConfirmationSentAt` column —
 *    see the schema migration in the audit doc — which is only ever
 *    touched when we actually send a confirmation email.
 *
 * 2. Idempotent confirmation (fixed here): confirmSubscription() no
 *    longer treats a repeat hit on the same token as an error. Corporate
 *    email security gateways (Microsoft Defender for Office 365 Safe
 *    Links, Proofpoint, Mimecast) and some mail clients prefetch every
 *    link in an email to scan it for malware BEFORE the user ever opens
 *    the message. If confirmation is a single-use, non-idempotent GET,
 *    the scanner silently consumes the token and the real user then
 *    clicks a "confirmation link" that immediately errors as invalid —
 *    a top cause of "double opt-in emails don't work" support tickets
 *    industry-wide. The fix: confirming is idempotent — if the
 *    subscriber is already SUBSCRIBED, we return success without
 *    re-running side effects (no duplicate ESP sync enqueue). See
 *    repository.ts: markConfirmed() intentionally no longer nulls
 *    confirmationTokenHash for this reason.
 */

import { randomBytes, createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/app/lib/errors/result";
import { newsletterRepository } from "@/app/lib/domains/newsletter/repository";
import { getConfiguredEspProvider } from "@/app/lib/domains/newsletter/esp-provider";
import {
  newsletterEspSyncQueue,
  newsletterEmailQueue,
} from "@/app/lib/queues/newsletter.queue";
import { NEWSLETTER_CONFIG } from "@/app/lib/validation/newsletter-validation";
import type {
  NewsletterSubscribeInput,
  NewsletterConfirmInput,
  NewsletterUnsubscribeInput,
  NewsletterSubscribeResult,
  NewsletterConfirmResult,
  NewsletterUnsubscribeResult,
  NewsletterResult,
} from "@/app/lib/domains/newsletter/contracts";

// Re-exported so callers that only imported this from service.ts (e.g.
// lib/jobs/newsletter-esp-sync.worker.ts pre-refactor) keep working.
// New code should import getConfiguredEspProvider directly from
// esp-provider.ts to avoid pulling in queue producers.
export { getConfiguredEspProvider };

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe an email address. Always a local DB write only — never calls
 * the ESP directly. Enqueues a confirmation email; the ESP contact is
 * created later, once the user confirms.
 */
export async function subscribe(
  input: NewsletterSubscribeInput,
): Promise<NewsletterResult<NewsletterSubscribeResult>> {
  const existing = await newsletterRepository.findByEmail(input.email);

  if (existing) {
    if (existing.status === "SUBSCRIBED") {
      return ok({ status: "already_subscribed" });
    }

    if (existing.status === "BOUNCED" || existing.status === "COMPLAINED") {
      // Do not silently re-add a suppressed address — that's how ESPs end
      // up sending to addresses that previously bounced/complained, which
      // damages sender reputation. Requires manual review to lift.
      return err({
        error: "suppressed",
        message: "This address cannot be resubscribed automatically",
        status: 400,
      });
    }

    // PENDING_CONFIRMATION or UNSUBSCRIBED: allow a fresh double opt-in
    // cycle, but rate-limit resends per address (distinct from the route's
    // IP rate limit) so this form can't be used to bomb a third party's
    // inbox with repeated confirmation emails.
    //
    // NOTE: gated on `lastConfirmationSentAt`, NOT `updatedAt` — see the
    // STAFF AUDIT NOTES block at the top of this file for why.
    const cooldownCutoff = new Date(
      Date.now() - NEWSLETTER_CONFIG.RESUBSCRIBE_COOLDOWN_MS,
    );
    if (
      existing.lastConfirmationSentAt &&
      existing.lastConfirmationSentAt > cooldownCutoff
    ) {
      return err({
        error: "resubscribe_cooldown",
        message: "Please wait a few minutes before trying again",
        status: 429,
      });
    }

    const confirmationToken = generateToken();
    const unsubscribeToken = generateToken();

    const updated = await newsletterRepository.resetForResubscribe(
      existing.id,
      {
        confirmationTokenHash: hashToken(confirmationToken),
        confirmationTokenExpiresAt: new Date(
          Date.now() + NEWSLETTER_CONFIG.CONFIRMATION_TOKEN_TTL_MS,
        ),
        unsubscribeTokenHash: hashToken(unsubscribeToken),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    );

    await enqueueConfirmationEmail(
      updated.id,
      updated.email,
      confirmationToken,
      unsubscribeToken,
    );

    return ok({ status: "resubscribe_pending" });
  }

  const confirmationToken = generateToken();
  const unsubscribeToken = generateToken();
  const userId = await newsletterRepository.findUserIdByEmail(input.email);

  // The findByEmail-then-create above is not atomic: two concurrent
  // subscribe requests for the same brand-new email (double-click, a
  // client retrying a slow request, two devices) can both pass the
  // `existing` check and race on the unique `email` constraint. Rather
  // than let the second request 500, treat a unique-violation as "someone
  // else just created this row" and fall through to the same
  // resubscribe/already-subscribed handling used above, recursing exactly
  // once — the second call's findByEmail will now see the row the other
  // request just committed.
  try {
    const created = await newsletterRepository.createPendingSubscriber({
      email: input.email,
      userId,
      source: input.source ?? "footer",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      confirmationTokenHash: hashToken(confirmationToken),
      confirmationTokenExpiresAt: new Date(
        Date.now() + NEWSLETTER_CONFIG.CONFIRMATION_TOKEN_TTL_MS,
      ),
      unsubscribeTokenHash: hashToken(unsubscribeToken),
    });

    await enqueueConfirmationEmail(
      created.id,
      created.email,
      confirmationToken,
      unsubscribeToken,
    );

    return ok({ status: "pending_confirmation" });
  } catch (error) {
    const isUniqueViolation =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";
    if (!isUniqueViolation) throw error;

    // Someone else's request just created this row — re-run subscribe()
    // once so it takes the normal "existing subscriber" branch above.
    return subscribe(input);
  }
}

/**
 * Confirm a subscription via the token from the confirmation email.
 *
 * Idempotent: if the subscriber is already SUBSCRIBED (e.g. the token was
 * already consumed by a security-scanner prefetch, or the user double
 * clicked / their mail client retried the request), this returns success
 * without re-running side effects. Only a genuinely unrecognized or
 * expired token is an error. See STAFF AUDIT NOTES above.
 */
export async function confirmSubscription(
  input: NewsletterConfirmInput,
): Promise<NewsletterResult<NewsletterConfirmResult>> {
  const subscriber = await newsletterRepository.findByConfirmationTokenHash(
    hashToken(input.token),
  );

  if (!subscriber) {
    return err({
      error: "invalid_token",
      message: "This confirmation link is invalid",
      status: 400,
    });
  }

  if (subscriber.status === "SUBSCRIBED") {
    // Already confirmed — most likely a prefetch/retry/double-click.
    // Returning success here (rather than invalid_token) is the whole
    // point of not nulling confirmationTokenHash in markConfirmed().
    return ok({ status: "SUBSCRIBED" });
  }

  if (
    subscriber.status === "PENDING_CONFIRMATION" &&
    subscriber.confirmationTokenExpiresAt &&
    subscriber.confirmationTokenExpiresAt < new Date()
  ) {
    return err({
      error: "token_expired",
      message: "This confirmation link has expired — please subscribe again",
      status: 400,
    });
  }

  const confirmed = await newsletterRepository.markConfirmed(subscriber.id);

  await newsletterEspSyncQueue.add("esp-sync", {
    subscriberId: confirmed.id,
    action: "subscribe",
  });

  return ok({ status: "SUBSCRIBED" });
}

/**
 * Unsubscribe via the token embedded in every newsletter email footer,
 * or via the RFC 8058 one-click List-Unsubscribe-Post URL. Idempotent by
 * design: an already-unsubscribed token still returns success rather
 * than an error, since a user (or their mail provider, per Gmail/Yahoo's
 * 2024 one-click bulk sender requirements) hitting this a second time
 * should never see a failure.
 */
export async function unsubscribe(
  input: NewsletterUnsubscribeInput,
): Promise<NewsletterResult<NewsletterUnsubscribeResult>> {
  const subscriber = await newsletterRepository.findByUnsubscribeTokenHash(
    hashToken(input.token),
  );

  if (!subscriber) {
    return err({
      error: "invalid_token",
      message: "This unsubscribe link is invalid",
      status: 400,
    });
  }

  if (subscriber.status === "UNSUBSCRIBED") {
    return ok({ status: "UNSUBSCRIBED" });
  }

  await newsletterRepository.markUnsubscribed(subscriber.id, input.reason);

  await newsletterEspSyncQueue.add("esp-sync", {
    subscriberId: subscriber.id,
    action: "unsubscribe",
  });

  return ok({ status: "UNSUBSCRIBED" });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function enqueueConfirmationEmail(
  subscriberId: string,
  email: string,
  confirmationToken: string,
  unsubscribeToken: string,
) {
  await newsletterEmailQueue.add("send-confirmation", {
    subscriberId,
    email,
    confirmationToken,
    unsubscribeToken,
  });
}
