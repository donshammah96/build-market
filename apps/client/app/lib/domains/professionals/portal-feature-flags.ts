/**
 * Professional Portal Strangler-Fig Feature Flags (ADR-ADMIN-009 / ADR-002)
 *
 * Manages feature flags for professional portal module rollouts.
 * All environment variable reads go through typed env config (ADR-004).
 */

import { env } from "@/app/lib/infrastructure/env";

export type ProfessionalFeatureFlag =
  | "portal_dashboard_v2"
  | "portal_leads_v2"
  | "portal_finance_v2"
  | "portal_projects_v2"
  | "portal_quotes_v2"
  | "portal_stores_v2"
  | "portal_calendar_v2"
  | "portal_portfolio_v2";

const FLAG_TO_ENV_KEY: Record<
  ProfessionalFeatureFlag,
  keyof typeof env.features
> = {
  portal_dashboard_v2: "portalDashboardV2",
  portal_leads_v2: "portalLeadsV2",
  portal_finance_v2: "portalFinanceV2",
  portal_projects_v2: "portalProjectsV2",
  portal_quotes_v2: "portalQuotesV2",
  portal_stores_v2: "portalStoresV2",
  portal_calendar_v2: "portalCalendarV2",
  portal_portfolio_v2: "portalPortfolioV2",
};

/**
 * Check if a professional portal feature flag is enabled using typed env config.
 */
export function isProfessionalFeatureEnabled(
  flag: ProfessionalFeatureFlag,
): boolean {
  const key = FLAG_TO_ENV_KEY[flag];
  if (key && key in env.features) {
    return Boolean(env.features[key]);
  }
  return true;
}
