/**
 * Client-safe configuration constants for the messaging subsystem.
 *
 * Used by messaging-client.ts and any client-side messaging code.
 * Server-side API routes use MESSAGING_CONFIG from messaging-validation.ts.
 */
export const MESSAGING_CLIENT_CONFIG = {
  /** Placeholder URL when asset CDN URL is missing */
  PLACEHOLDER_FILE_URL: "https://placeholder.local/file",

  /** Max concurrent operations in bulkhead (getMessages, etc.) */
  BULKHEAD_CONCURRENCY: 10,

  /** Default message limit for pagination (aligned with MESSAGING_CONFIG.DEFAULT_MESSAGE_LIMIT) */
  DEFAULT_MESSAGE_LIMIT: 50,

  /** Supported message types for normalization */
  MESSAGE_TYPES: ["TEXT", "IMAGE", "FILE", "PDF", "SYSTEM"] as const,
} as const;

export type MessagingClientConfig = typeof MESSAGING_CLIENT_CONFIG;
