import { normalizeRole, type AppRole } from "@/app/lib/security/roles";

// ============================================================================
// MARKETPLACE PAGE ROUTES — public-facing store, property, and search pages
// ============================================================================

export const MARKETPLACE_ROUTES = {
  // Store Routes (by category)
  stores: "/stores",
  storeHardware: "/stores/hardware",
  storeBuildingMaterials: "/stores/building-materials",
  storeTilesAndCeramics: "/stores/tiles-and-ceramics",
  storeElectrical: "/stores/electrical",
  storePlumbing: "/stores/plumbing",
  storePaintsAndFinishes: "/stores/paints-and-finishes",
  storeRoofing: "/stores/roofing",
  storeTimberAndWood: "/stores/timber-and-wood",
  storeGlassAndAluminum: "/stores/glass-and-aluminum",
  storeKitchenAndBath: "/stores/kitchen-and-bath",
  storeLandscaping: "/stores/landscaping",
  storeSteelAndMetals: "/stores/steel-and-metals",
  storeSafetyAndTools: "/stores/safety-and-tools",
  storeHvac: "/stores/hvac",

  // Store Routes (by type)
  storesRetail: "/stores/type/retail",
  storesWholesale: "/stores/type/wholesale",
  storesManufacturer: "/stores/type/manufacturer",
  storesDistributor: "/stores/type/distributor",
  storesOnlineOnly: "/stores/type/online-only",

  // Properties
  properties: "/properties",

  // Search
  search: "/search",
  findProfessional: "/professionals",
  speakWithAdvisor: "/speak-with-an-advisor",

  // Features
  ideaBooks: "/idea-books",
  reviews: "/reviews",
  products: "/products",
  messages: "/messages",
} as const;

export type MarketplaceRouteKey = keyof typeof MARKETPLACE_ROUTES;

// Store URL helpers
export const getStoreUrl = (id: string) => `/stores/${id}`;
export const getStoreByCategoryUrl = (category: string) =>
  `/stores/${category.replace(/_/g, "-")}`;
export const getStoreByTypeUrl = (type: string) =>
  `/stores/type/${type.replace(/_/g, "-")}`;
export const getStoreProductUrl = (storeId: string, productId: string) =>
  `/stores/${storeId}/products/${productId}`;

// Property URL helpers
export const getPropertyUrl = (id: string) => `/properties/${id}`;

// ============================================================================
// MARKETPLACE API ROUTES
// ============================================================================

export const MARKETPLACE_API_ROUTES = {
  stores: "/api/stores",
  storesMe: "/api/stores/me",
  storeDetail: (id: string) => `/api/stores/${id}`,
  storeDocuments: (storeId: string) => `/api/stores/${storeId}/documents`,
  storeDocumentDetail: (storeId: string, documentId: string) =>
    `/api/stores/${storeId}/documents/${documentId}`,

  properties: "/api/properties",
  propertyDetail: (id: string) => `/api/properties/${id}`,
  propertyMyListings: "/api/properties/my-listings",
  propertySimilar: (id: string) => `/api/properties/${id}/similar`,
  propertyAttachments: (propertyId: string) =>
    `/api/properties/${propertyId}/attachments`,
  propertyAttachmentDetail: (propertyId: string, attachmentId: string) =>
    `/api/properties/${propertyId}/attachments/${attachmentId}`,
  propertyDocuments: (propertyId: string) =>
    `/api/properties/${propertyId}/documents`,
  propertyDocumentDetail: (propertyId: string, documentId: string) =>
    `/api/properties/${propertyId}/documents/${documentId}`,

  reviews: "/api/reviews",
  searchProfessionals: "/api/search/professionals",
  services: "/api/services",

  leads: "/api/leads",
  leadDetail: (id: string) => `/api/leads/${id}`,

  settingsPublic: "/api/settings/public",
  internalSystemSettings: "/api/internal/system-settings",
} as const;

// API helper functions
export const getApiStoresUrl = () => MARKETPLACE_API_ROUTES.stores;
export const getApiStoreDetailUrl = (id: string) =>
  MARKETPLACE_API_ROUTES.storeDetail(id);

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

export interface SearchFilters {
  query?: string;
  category?: string;
  city?: string;
  county?: string;
  verified?: boolean;
  minRating?: number;
  sortBy?: "rating" | "reviews" | "experience" | "newest";
  sortOrder?: "asc" | "desc";
}

export type QueryParams = Record<
  string,
  string | number | boolean | string[] | undefined | null
>;

export const withQueryParams = (
  baseUrl: string,
  params: QueryParams,
): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, v));
    } else {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
};

export const getSearchUrl = (
  basePath: string,
  filters: SearchFilters,
): string => withQueryParams(basePath, filters as QueryParams);

export const getStoreSearchUrl = (filters: SearchFilters): string =>
  getSearchUrl(MARKETPLACE_ROUTES.stores, filters);

export const getPropertySearchUrl = (
  filters: SearchFilters & {
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  },
): string =>
  getSearchUrl(MARKETPLACE_ROUTES.properties, filters as QueryParams);

// ============================================================================
// EXTERNAL LINKS
// ============================================================================

export const EXTERNAL_LINKS = {
  facebook: "https://facebook.com/buildmarket",
  twitter: "https://twitter.com/buildmarket",
  instagram: "https://instagram.com/buildmarket",
  linkedin: "https://linkedin.com/company/buildmarket",
  youtube: "https://youtube.com/@buildmarket",
  support: "mailto:support@buildmarket.co.ke",
  helpCenter: "/help",
  contactUs: "/contact",
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
  blog: "/blog",
  faq: "/faq",
  careers: "/careers",
  pressKit: "/press",
} as const;

export type ExternalLinkKey = keyof typeof EXTERNAL_LINKS;

// ============================================================================
// ROUTE UTILITIES (shared, used by navigation and breadcrumbs)
// ============================================================================

export interface RouteSegment {
  label: string;
  path: string;
}

const fromSlug = (slug: string): string =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export const getRouteSegments = (path: string): RouteSegment[] => {
  const segments = path.split("/").filter(Boolean);
  const result: RouteSegment[] = [];
  let currentPath = "";
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    result.push({ label: fromSlug(segment), path: currentPath });
  });
  return result;
};

export const isActiveRoute = (
  currentPath: string,
  targetRoute: string,
  exact = false,
): boolean => {
  const normalizedCurrent = currentPath.toLowerCase().replace(/\/$/, "");
  const normalizedTarget = targetRoute.toLowerCase().replace(/\/$/, "");
  if (exact) return normalizedCurrent === normalizedTarget;
  return (
    normalizedCurrent === normalizedTarget ||
    normalizedCurrent.startsWith(`${normalizedTarget}/`)
  );
};

export const withPagination = (
  baseUrl: string,
  page: number,
  limit = 12,
): string => withQueryParams(baseUrl, { page, limit });

export const toSlug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const toEnumKey = (slug: string): string => slug.replace(/-/g, "_");
export const fromEnumKey = (key: string): string => key.replace(/_/g, "-");

export const matchesDynamicRoute = (path: string, pattern: string): boolean => {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((part, index) => {
    if (part.startsWith(":")) return true;
    return part === pathParts[index];
  });
};

export const extractRouteParams = (
  path: string,
  pattern: string,
): Record<string, string> | null => {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (!patternPart || !pathPart) continue;
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
};

// Re-exported for use through the dashboard role helper
export { normalizeRole };
export type { AppRole };
