/**
 * lib/routes/index.ts
 *
 * Canonical re-export barrel for all route constants and helpers.
 * Import from this file or from the specific domain route file:
 *
 *   import { ROUTES } from "@/lib/routes";          // backward compat
 *   import { PROFESSIONAL_ROUTES } from "@/lib/routes/professional.routes";
 *
 * lib/links.ts is the backward-compat barrel for all existing @/lib/links
 * imports — do not remove it until all callsites are migrated.
 */

// Marketplace / public-facing routes
export {
  MARKETPLACE_ROUTES,
  MARKETPLACE_API_ROUTES,
  EXTERNAL_LINKS,
  getStoreUrl,
  getStoreByCategoryUrl,
  getStoreByTypeUrl,
  getStoreProductUrl,
  getPropertyUrl,
  getVendorUrl,
  getStoreSearchUrl,
  getPropertySearchUrl,
  getProfessionalSearchUrl,
  getSearchUrl,
  withQueryParams,
  withPagination,
  isActiveRoute,
  getRouteSegments,
  toSlug,
  toEnumKey,
  fromEnumKey,
  matchesDynamicRoute,
  extractRouteParams,
  getApiStoresUrl,
  getApiStoreDetailUrl,
  type MarketplaceRouteKey,
  type SearchFilters,
  type QueryParams,
  type RouteSegment,
  type ExternalLinkKey,
} from "./marketplace.routes";

// Professional routes (public listing + portal)
export {
  PROFESSIONAL_ROUTES,
  PROFESSIONAL_API_ROUTES,
  dashboardForRole,
  isProfessionalPortalRoute,
  getProfessionalUrl,
  getProfessionalByCategoryUrl,
  getProfessionalReviewsUrl,
  getProfessionalPortfoliosUrl,
  getProfessionalContactUrl,
  getProfessionalProjectUrl,
  getProfessionalPortfolioUrl,
  getProfessionalEventUrl,
  getProfessionalLeadUrl,
  getProfessionalStoreUrl,
  getProfessionalQuoteUrl,
  getProfessionalCertificateUrl,
  getProfessionalMessageThreadUrl,
  getProfessionalTransactionUrl,
  getProfessionalClientUrl,
  getProfessionalCalendarUrl,
  getApiProfessionalDetailUrl,
  type ProfessionalRouteKey,
} from "./professional.routes";

// Client / homeowner routes
export {
  CLIENT_ROUTES,
  CLIENT_API_ROUTES,
  getProjectUrl,
  getIdeaBookUrl,
  getSignInWithRedirect,
  getSignUpWithRedirect,
  isPublicRoute,
  isAuthRoute,
  type ClientRouteKey,
} from "./client.routes";

// Admin routes
export {
  ADMIN_ROUTES,
  ADMIN_API_ROUTES,
  type AdminRouteKey,
} from "./admin.routes";

import { CLIENT_ROUTES, CLIENT_API_ROUTES } from "./client.routes";
import {
  MARKETPLACE_ROUTES,
  MARKETPLACE_API_ROUTES,
} from "./marketplace.routes";
import {
  PROFESSIONAL_ROUTES,
  PROFESSIONAL_API_ROUTES,
} from "./professional.routes";
import { ADMIN_ROUTES, ADMIN_API_ROUTES } from "./admin.routes";

// ============================================================================
// ROUTES and API_ROUTES unified objects
// All existing callsites use these — kept for smooth migration.
// ============================================================================
export const ROUTES = {
  ...CLIENT_ROUTES,
  ...MARKETPLACE_ROUTES,
  ...PROFESSIONAL_ROUTES,
  ...ADMIN_ROUTES,
} as const;

export const API_ROUTES = {
  ...CLIENT_API_ROUTES,
  ...MARKETPLACE_API_ROUTES,
  ...PROFESSIONAL_API_ROUTES,
  ...ADMIN_API_ROUTES,
} as const;

export type RouteKey = keyof typeof ROUTES;
export type ApiRouteKey = keyof typeof API_ROUTES;
