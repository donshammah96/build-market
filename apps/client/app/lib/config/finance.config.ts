/**
 * Client-safe configuration for finance-client.ts.
 */
export const FINANCE_CLIENT_CONFIG = {
  /** Max concurrent operations in bulkhead */
  BULKHEAD_CONCURRENCY: 3,
} as const;
