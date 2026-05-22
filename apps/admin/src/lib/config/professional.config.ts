/**
 * Shared configuration constants for Professional API routes.
 *
 * Centralizes settings used by professionals/route.ts and professionals/[id]/route.ts.
 */
export const PROFESSIONAL_CONFIG = {
  /** Maximum professionals per page for list endpoint */
  MAX_LIMIT: 100,

  /** Default limit for list endpoint */
  DEFAULT_LIMIT: 50,

  /** Cache TTL in ms for list responses (30s) */
  LIST_CACHE_TTL_MS: 30_000,

  /** Cache TTL in ms for detail responses (30s) */
  DETAIL_CACHE_TTL_MS: 30_000,
} as const;

export type ProfessionalConfig = typeof PROFESSIONAL_CONFIG;
