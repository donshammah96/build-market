import type { z } from "zod";
import type { Result, DomainError } from "@/app/lib/errors/result";
import type {
  NewsletterSubscriberStatus,
  NewsletterEspSyncStatus,
} from "@prisma/client";

/**
 * ADR-005 observable operationName inventory:
 * - subscribe            (POST /api/newsletter/subscribe)
 * - confirm_subscription (GET  /api/newsletter/confirm)
 * - unsubscribe          (POST /api/newsletter/unsubscribe)
 * - esp_sync             (BullMQ job: lib/jobs/newsletter-esp-sync.worker.ts)
 * - esp_webhook_received (POST /api/webhooks/resend)
 */

import {
  NEWSLETTER_CONFIG,
  NewsletterSubscribeSchema,
  NewsletterConfirmSchema,
  NewsletterUnsubscribeSchema,
  newsletterSubscriberInternalSelect,
} from "@/app/lib/validation/newsletter-validation";

export {
  NEWSLETTER_CONFIG,
  NewsletterSubscribeSchema,
  NewsletterConfirmSchema,
  NewsletterUnsubscribeSchema,
  newsletterSubscriberInternalSelect,
};

export type NewsletterSubscribeBody = z.infer<typeof NewsletterSubscribeSchema>;
export type NewsletterConfirmBody = z.infer<typeof NewsletterConfirmSchema>;
export type NewsletterUnsubscribeBody = z.infer<
  typeof NewsletterUnsubscribeSchema
>;

// ---------------------------------------------------------------------------
// Domain input / output contracts
// ---------------------------------------------------------------------------

/**
 * Parsed, validated input passed from the API route into the domain service.
 * The route adapter owns Zod validation; the service trusts this shape.
 */
export interface NewsletterSubscribeInput {
  /** RFC-5321 email address, max 254 characters. */
  email: string;
  /** Client IP address for consent audit and abuse tracking. */
  ipAddress?: string;
  userAgent?: string;
  /** Signup surface, e.g. "footer" — analytics only, never trust for authz. */
  source?: string;
}

export interface NewsletterConfirmInput {
  token: string;
}

export interface NewsletterUnsubscribeInput {
  token: string;
  reason?: string;
}

export type NewsletterSubscribeStatus =
  | "pending_confirmation" // new signup, confirmation email enqueued
  | "already_subscribed" // already SUBSCRIBED — no email sent, no error
  | "resubscribe_pending"; // was UNSUBSCRIBED/BOUNCED, re-confirmation required

export interface NewsletterSubscribeResult {
  status: NewsletterSubscribeStatus;
}

export interface NewsletterConfirmResult {
  status: Extract<NewsletterSubscriberStatus, "SUBSCRIBED">;
}

export interface NewsletterUnsubscribeResult {
  status: Extract<NewsletterSubscriberStatus, "UNSUBSCRIBED">;
}

// ---------------------------------------------------------------------------
// Error codes produced by the newsletter domain
// ---------------------------------------------------------------------------

export type NewsletterErrorCode =
  | "invalid_email" // email rejected by ESP or failed a domain rule
  | "invalid_token" // confirm/unsubscribe token not found
  | "token_expired" // confirmation token past its TTL
  | "suppressed" // email previously bounced/complained — will not re-add silently
  | "resubscribe_cooldown" // re-signup attempted before RESUBSCRIBE_COOLDOWN_MS elapsed
  | "provider_unavailable" // ESP returned a non-retryable error (surfaced from the sync job, not the request path)
  | "esp_misconfigured"; // required ESP env vars are missing — an ops problem, not a user error

export type NewsletterError = DomainError<NewsletterErrorCode>;

export type NewsletterResult<T> = Result<T, NewsletterError>;

// ---------------------------------------------------------------------------
// ESP sync job contracts (BullMQ)
// ---------------------------------------------------------------------------

export interface NewsletterEspSyncJobData {
  subscriberId: string;
  /** "subscribe" adds the contact to the segment; "unsubscribe" removes/marks it. */
  action: "subscribe" | "unsubscribe";
}

export interface NewsletterEspSyncOutcome {
  status: NewsletterEspSyncStatus;
  espContactId?: string;
}

export interface NewsletterConfirmationEmailJobData {
  subscriberId: string;
  email: string;
  /** Raw tokens — only ever exist in-memory/in the job payload, never persisted. */
  confirmationToken: string;
  unsubscribeToken: string;
}
