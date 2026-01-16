/**
 * Dashboard Configuration Module
 *
 * Exports configuration system for profession-specific dashboards.
 */

// Types
export * from "./dashboardTypes";

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
