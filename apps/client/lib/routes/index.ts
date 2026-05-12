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
  getStoreSearchUrl,
  getPropertySearchUrl,
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

// ============================================================================
// BACKWARD-COMPAT: ROUTES and API_ROUTES unified objects
// All existing `@/lib/links` callsites use these — kept for smooth migration.
// New code should import from the domain-specific route files above.
// ============================================================================
export { ROUTES, API_ROUTES } from "@/lib/links";
