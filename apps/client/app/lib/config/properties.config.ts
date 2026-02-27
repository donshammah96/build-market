/**
 * Client-safe configuration constants for the properties subsystem.
 *
 * Used by properties-client.ts and property-related client code.
 * Server-side API routes use PROPERTY_CONFIG from property.config.ts.
 */
export const PROPERTIES_CLIENT_CONFIG = {
  /** Max concurrent operations in bulkhead */
  BULKHEAD_CONCURRENCY: 5,

  /** Default page size for property list queries */
  DEFAULT_PAGE_SIZE: 20,

  /** Max page size for property list queries */
  MAX_PAGE_SIZE: 50,
} as const;

export type PropertiesClientConfig = typeof PROPERTIES_CLIENT_CONFIG;
