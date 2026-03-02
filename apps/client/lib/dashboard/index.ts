/**
 * Dashboard Configuration Module
 *
 * Exports configuration system for profession-specific dashboards.
 */

// Types
export * from "./dashboardTypes";

// Services
// NOTE: getDashboardMetrics is server-side only and should be imported directly from .service file
// to avoid pulling server dependencies (Prisma) into client bundles via this barrel file.

// Configuration
export {
  getDashboardGroup,
  getDashboardConfig,
  shouldShowStoreFeatures,
  shouldShowPropertyFeatures,
  shouldShowProjectFeatures,
  getDashboardGroupIcon,
  formatWelcomeMessage,
} from "./dashboardConfig";
