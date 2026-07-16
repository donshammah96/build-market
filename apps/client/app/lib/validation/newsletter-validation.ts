import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const NEWSLETTER_CONFIG = {
  MAX_BODY_SIZE: 2 * 1024, // 2KB — this domain only ever accepts an email + honeypot
  CONFIRMATION_TOKEN_TTL_MS: 24 * 60 * 60 * 1000, // 24h
  // Minimum time between confirmation-email sends to the same address.
  // Protects a third party's inbox from being spammed via this form
  // (distinct from the IP rate limit, which protects *our* infra).
  RESUBSCRIBE_COOLDOWN_MS: 5 * 60 * 1000, // 5 min
  ESP_SYNC_MAX_ATTEMPTS: 5,
} as const;

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/**
 * The `company` field is a honeypot: rendered off-screen in the UI, real
 * users never fill it, bots that fill all visible fields often do.
 */
export const NewsletterSubscribeSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  company: z.string().max(100).optional(),
  /** Where the signup happened, for analytics — never trust for auth/authz. */
  source: z.string().max(50).optional(),
});

export const NewsletterConfirmSchema = z.object({
  token: z.string().min(32).max(256),
});

export const NewsletterUnsubscribeSchema = z.object({
  token: z.string().min(32).max(256),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Prisma select projections
// ---------------------------------------------------------------------------

/**
 * Never select/return the full row anywhere near a client response —
 * confirmationTokenHash, unsubscribeTokenHash, and the ESP sync fields are
 * internal state only.
 */
export const newsletterSubscriberInternalSelect = {
  id: true,
  email: true,
  userId: true,
  status: true,
  source: true,
  confirmationTokenHash: true,
  confirmationTokenExpiresAt: true,
  confirmedAt: true,
  lastConfirmationSentAt: true,
  confirmationEmailStatus: true,
  confirmationEmailLastError: true,
  unsubscribeTokenHash: true,
  unsubscribedAt: true,
  espProvider: true,
  espContactId: true,
  espSyncStatus: true,
  espSyncAttempts: true,
  espNextRetryAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
