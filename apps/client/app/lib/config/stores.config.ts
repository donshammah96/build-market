/**
 * Client-safe configuration constants for the stores subsystem.
 *
 * Used by stores-client.ts and store-related client code.
 * Server-side API routes use STORE_CONFIG from store.config.ts.
 */
export const STORES_CLIENT_CONFIG = {
  /** Max concurrent operations in bulkhead */
  BULKHEAD_CONCURRENCY: 5,

  /** Default page size for store list queries */
  DEFAULT_PAGE_SIZE: 20,

  /** Max page size for store list queries */
  MAX_PAGE_SIZE: 50,
} as const;

export type StoresClientConfig = typeof STORES_CLIENT_CONFIG;
