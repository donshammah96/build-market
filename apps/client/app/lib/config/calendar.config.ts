/**
 * Client-safe configuration for calendar-client.ts.
 */
export const CALENDAR_CLIENT_CONFIG = {
  /** Max concurrent operations in bulkhead */
  BULKHEAD_CONCURRENCY: 5,
} as const;
