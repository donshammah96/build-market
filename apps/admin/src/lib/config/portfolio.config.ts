/**
 * Shared configuration constants for Portfolio API routes.
 *
 * Centralizes settings used by professional-portal/portfolio/ routes.
 */
export const PORTFOLIO_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum portfolios per professional */
  MAX_PORTFOLIOS_PER_PROFESSIONAL: 50,

  /** Maximum images per portfolio */
  MAX_IMAGES_PER_PORTFOLIO: 30,

  /** Maximum images per single upload request */
  MAX_IMAGES_PER_REQUEST: 20,

  /** Maximum page size for list queries */
  MAX_LIMIT: 50,

  /** Default page size */
  DEFAULT_LIMIT: 20,

  /** TTL in hours for idempotency keys */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,
} as const;

export type PortfolioConfig = typeof PORTFOLIO_CONFIG;
