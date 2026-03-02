export const ROUTES = {
  // Public Routes
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  onboarding: "/onboarding",
  authCallback: "/auth-callback",

  // Client / Homeowner Routes
  client: "/client",
  userDashboard: "/dashboard",
  userProfile: "/profile",
  userProfileComplete: "/profile/complete",
  userSettings: "/profile", // mapped to profile for now
  userNotifications: "/notifications",
  userProjects: "/projects",
  userMessages: "/messages",

  // Features
  ideaBooks: "/idea-books",
  reviews: "/reviews",
  products: "/products",
  messages: "/messages", // General messages route

  // Professional Public Routes
  professional: "/professional",
  professionalList: "/professionals",
  professionalDetail: "/professionals/:id", // Placeholder for dynamic route
  joinAsPro: "/professional/sign-up",
  professionalProfile: "/professional/profile",
  professionalOnboarding: "/professional/onboarding",

  // Professional Portal (Private Tools)
  professionalDashboard: "/professional-portal/dashboard",
  professionalLeads: "/professional-portal/leads",
  professionalProjects: "/professional-portal/projects",
  professionalMessages: "/professional-portal/messages",
  professionalPortfolio: "/professional-portal/portfolio",
  professionalFinance: "/professional-portal/finance",
  professionalSettings: "/professional-portal/settings",
  professionalProfileComplete: "/professional-portal/settings/complete-profile",
  professionalCalendar: "/professional-portal/calendar",

  // Categories & Search
  findProfessional: "/professionals",
  speakWithAdvisor: "/speak-with-an-advisor",

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

  // Professional Category Routes
  generalContractors: "/professionals/general-contractors",
  engineers: "/professionals/engineers",
  designers: "/professionals/designers",
  architects: "/professionals/architects",
  interiorDesigners: "/professionals/interior-designers",
  cabinetmakers: "/professionals/cabinetmakers",
  landscaping: "/professionals/landscaping",
  draftsmen: "/professionals/draftsmen",
  electricians: "/professionals/electricians",
  plumbers: "/professionals/plumbers",
  painters: "/professionals/painters",
  roofers: "/professionals/roofers",
  contractors: "/professionals/contractors",
  urbanPlanners: "/professionals/urban-planners",
  landscapeArchitects: "/professionals/landscape-architects",
  structuralEngineers: "/professionals/structural-engineers",
  civilEngineers: "/professionals/civil-engineers",
  surveyors: "/professionals/surveyors",
  mechanicalEngineers: "/professionals/mechanical-engineers",
  HVACEngineers: "/professionals/hvac-engineers",
  geotechnicalEngineers: "/professionals/geotechnical-engineers",
  environmentalEngineers: "/professionals/environmental-engineers",
  waterEngineers: "/professionals/water-engineers",
  constructionManagers: "/professionals/construction-managers",
  projectManagers: "/professionals/project-managers",
  safetyManagers: "/professionals/safety-managers",
  siteSupervisors: "/professionals/site-supervisors",
  quantitySurveyors: "/professionals/quantity-surveyors",
  estimators: "/professionals/estimators",
  clerkOfWorks: "/professionals/clerk-of-works",
  buildingContractors: "/professionals/building-contractors",
  roofingContractors: "/professionals/roofing-contractors",
  flooringContractors: "/professionals/flooring-contractors",
  paintingContractors: "/professionals/painting-contractors",
  demolitionContractors: "/professionals/demolition-contractors",

  // Specialized Trades
  hvacTechnicians: "/professionals/hvac-technicians",
  masons: "/professionals/masons",
  carpenters: "/professionals/carpenters",
  welders: "/professionals/welders",
  glaziers: "/professionals/glaziers",
  tilers: "/professionals/tilers",
  plasterers: "/professionals/plasterers",
  waterproofingSpecialists: "/professionals/waterproofing-specialists",

  // Real Estate
  realEstateAgents: "/professionals/real-estate-agents",
  realtors: "/professionals/realtors",
  realtyCompanies: "/professionals/realty-companies",
  propertyDevelopers: "/professionals/property-developers",
  landSurveyors: "/professionals/land-surveyors",
  propertyValuators: "/professionals/property-valuators",

  // Specialists
  solarInstallers: "/professionals/solar-installers",
  poolBuilders: "/professionals/pool-builders",
  landscapers: "/professionals/landscapers",
  securitySystemsInstallers: "/professionals/security-systems-installers",
  smartHomeSpecialists: "/professionals/smart-home-specialists",
  fireSafetySpecialists: "/professionals/fire-safety-specialists",
  acousticConsultants: "/professionals/acoustic-consultants",

  // Suppliers
  buildingMaterialsSuppliers: "/professionals/building-materials-suppliers",
  hardwareSuppliers: "/professionals/hardware-suppliers",
  sanitaryWareSuppliers: "/professionals/sanitary-ware-suppliers",

  // Properties
  properties: "/properties",
} as const;

export type RouteKey = keyof typeof ROUTES;

// Helper to generate dynamic routes
export const getProfessionalUrl = (id: string) => `/professionals/${id}`;
export const getProjectUrl = (id: string) => `/projects/${id}`;
export const getIdeaBookUrl = (id: string) => `/idea-books/${id}`;
export const getVendorUrl = (id: string) => `/vendors/${id}`;
export const getPropertyUrl = (id: string) => `/properties/${id}`;
// Professional Portal Helpers
export const getProfessionalProjectUrl = (id: string) =>
  `/professional-portal/projects/${id}`;
export const getProfessionalPortfolioUrl = (id: string) =>
  `/professional-portal/portfolio/${id}`;
export const getProfessionalEventUrl = (id: string) =>
  `/professional-portal/calendar/${id}`;
export const getProfessionalLeadUrl = (id: string) =>
  `/professional-portal/leads/${id}`;
export const getProfessionalStoreUrl = (id: string) =>
  `/professional-portal/stores/${id}`;

// Store Helpers
export const getStoreUrl = (id: string) => `/stores/${id}`;
export const getStoreByCategoryUrl = (category: string) =>
  `/stores/${category.replace(/_/g, "-")}`;
export const getStoreByTypeUrl = (type: string) =>
  `/stores/type/${type.replace(/_/g, "-")}`;
export const getStoreProductUrl = (storeId: string, productId: string) =>
  `/stores/${storeId}/products/${productId}`;

// Professional Public Helpers
export const getProfessionalByCategoryUrl = (category: string) =>
  `/professionals/${category.replace(/_/g, "-")}`;
export const getProfessionalReviewsUrl = (id: string) =>
  `/professionals/${id}/reviews`;
export const getProfessionalPortfoliosUrl = (id: string) =>
  `/professionals/${id}/portfolios`;
export const getProfessionalContactUrl = (id: string) =>
  `/professionals/${id}/contact`;

// Professional Portal Detail Helpers
export const getProfessionalQuoteUrl = (id: string) =>
  `/professional-portal/quotes/${id}`;
export const getProfessionalCertificateUrl = (id: string) =>
  `/professional-portal/certificates/${id}`;
export const getProfessionalMessageThreadUrl = (threadId: string) =>
  `/professional-portal/messages/${threadId}`;
export const getProfessionalTransactionUrl = (id: string) =>
  `/professional-portal/finance/transactions/${id}`;
export const getProfessionalClientUrl = (clientId: string) =>
  `/professional-portal/clients/${clientId}`;
export const getProfessionalCalendarUrl = (id: string) =>
  `/professional-portal/calendar/${id}`;

// ============================================================================
// API ROUTES
// ============================================================================

export const API_ROUTES = {
  // Auth
  clerkWebhook: "/api/clerk-webhook",

  // Users
  users: "/api/users",
  userDetail: (id: string) => `/api/users/${id}`,

  // Onboarding
  onboarding: "/api/onboarding",
  onboardingSkip: "/api/onboarding/skip",
  onboardingSkipProfessional: "/api/onboarding/skip-professional",

  // Professionals
  professionals: "/api/professionals",
  professionalDetail: (id: string) => `/api/professionals/${id}`,
  professionalOnboarding: "/api/professional/onboarding",

  // Professional Portal
  professionalPortal: "/api/professional-portal",
  professionalPortalDetail: (id: string) => `/api/professional-portal/${id}`,
  professionalPortalCalendar: "/api/professional-portal/calendar",
  professionalPortalLeads: "/api/professional-portal/leads",
  professionalPortalLeadDetail: (id: string) =>
    `/api/professional-portal/leads/${id}`,
  professionalPortalQuotes: "/api/professional-portal/quotes",
  professionalPortalCertificates: "/api/professional-portal/certificates",
  professionalPortalMessages: "/api/professional-portal/messages",
  professionalPortalFinance: "/api/professional-portal/finance",
  professionalPortalClients: "/api/professional-portal/clients",
  professionalPortalInquiries: "/api/professional-portal/inquiries",
  professionalPortalInquiryDetail: (id: string) =>
    `/api/professional-portal/inquiries/${id}`,
  professionalPortalPortfolio: "/api/professional-portal/portfolio",
  professionalPortalPortfolioDetail: (id: string) =>
    `/api/professional-portal/portfolio/${id}`,
  professionalPortalPortfolioImages: (id: string) =>
    `/api/professional-portal/portfolio/${id}/images`,
  professionalPortalPipeline: "/api/professional-portal/pipeline",
  professionalPortalProfile: "/api/professional-portal/profile",
  professionalPortalProfileDetail: (id: string) =>
    `/api/professional-portal/profile/${id}`,
  professionalPortalProjects: "/api/professional-portal/projects",
  professionalPortalProjectDetail: (id: string) =>
    `/api/professional-portal/projects/${id}`,

  // Reviews (public)
  reviews: "/api/reviews",

  // Stores
  stores: "/api/stores",
  storeDetail: (id: string) => `/api/stores/${id}`,

  // Uploads
  uploads: "/api/uploads",
  onboardingUploads: "/api/onboarding/uploads",

  // Messaging
  messagingConversations: "/api/messaging/conversations",
  messagingConversationDetail: (id: string) =>
    `/api/messaging/conversations/${id}`,
  messagingConversationRead: (id: string) =>
    `/api/messaging/conversations/${id}/read`,
  messagingMessages: "/api/messaging/messages",
  messagingMessageDetail: (id: string) => `/api/messaging/messages/${id}`,
  messagingMessageRead: (id: string) => `/api/messaging/messages/${id}/read`,

  // Profile
  profileComplete: "/api/profile/complete",
  profileStatus: "/api/profile/status",
  professionalProfile: "/api/professional-portal/profile",
  professionalProfileComplete: "/api/professional-portal/profile/complete",

  // Services
  services: "/api/services",

  // Notifications
  notifications: "/api/notifications",
  notificationDetail: (id: string) => `/api/notifications/${id}`,

  // Idea Books
  ideaBooks: "/api/idea-books",
  ideaBookDetail: (id: string) => `/api/idea-books/${id}`,
  ideaBookAttachments: (bookId: string) =>
    `/api/idea-books/${bookId}/attachments`,
  ideaBookAttachmentDetail: (bookId: string, attachmentId: string) =>
    `/api/idea-books/${bookId}/attachments/${attachmentId}`,

  // Public Leads (no auth)
  leads: "/api/leads",
  leadDetail: (id: string) => `/api/leads/${id}`,

  // Client Dashboard (auth required)
  clientDashboard: "/api/client/dashboard",

  // System Settings (public)
  settingsPublic: "/api/settings/public",

  // Internal (middleware)
  internalSystemSettings: "/api/internal/system-settings",
} as const;

// API Helper Functions
export const getApiStoresUrl = () => API_ROUTES.stores;
export const getApiStoreDetailUrl = (id: string) => API_ROUTES.storeDetail(id);
export const getApiProfessionalDetailUrl = (id: string) =>
  API_ROUTES.professionalDetail(id);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Query Parameters Builder
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

// Active Route Checker (for navigation highlighting)
export const isActiveRoute = (
  currentPath: string,
  targetRoute: string,
  exact = false,
): boolean => {
  const normalizedCurrent = currentPath.toLowerCase().replace(/\/$/, "");
  const normalizedTarget = targetRoute.toLowerCase().replace(/\/$/, "");

  if (exact) {
    return normalizedCurrent === normalizedTarget;
  }
  return (
    normalizedCurrent === normalizedTarget ||
    normalizedCurrent.startsWith(`${normalizedTarget}/`)
  );
};

// Route Segments (for breadcrumbs)
export interface RouteSegment {
  label: string;
  path: string;
}

export const getRouteSegments = (path: string): RouteSegment[] => {
  const segments = path.split("/").filter(Boolean);
  const result: RouteSegment[] = [];

  let currentPath = "";
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    result.push({
      label: fromSlug(segment),
      path: currentPath,
    });
  });

  return result;
};

// Search URL Builder
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

export const getSearchUrl = (
  basePath: string,
  filters: SearchFilters,
): string => {
  return withQueryParams(basePath, filters as QueryParams);
};

export const getProfessionalSearchUrl = (filters: SearchFilters): string => {
  return getSearchUrl(ROUTES.professionalList, filters);
};

export const getStoreSearchUrl = (filters: SearchFilters): string => {
  return getSearchUrl(ROUTES.stores, filters);
};

export const getPropertySearchUrl = (
  filters: SearchFilters & {
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  },
): string => {
  return getSearchUrl(ROUTES.properties, filters as QueryParams);
};

// Pagination Helper
export const withPagination = (
  baseUrl: string,
  page: number,
  limit = 12,
): string => {
  return withQueryParams(baseUrl, { page, limit });
};

// Auth Redirect Helper
export const getSignInWithRedirect = (returnTo: string): string => {
  return withQueryParams(ROUTES.signIn, { redirect_url: returnTo });
};

export const getSignUpWithRedirect = (returnTo: string): string => {
  return withQueryParams(ROUTES.signUp, { redirect_url: returnTo });
};

// Slug Utilities
export const toSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const fromSlug = (slug: string): string => {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const toEnumKey = (slug: string): string => {
  return slug.replace(/-/g, "_");
};

export const fromEnumKey = (key: string): string => {
  return key.replace(/_/g, "-");
};

// Dynamic Route Matching
export const matchesDynamicRoute = (path: string, pattern: string): boolean => {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every((part, index) => {
    if (part.startsWith(":")) return true; // Dynamic segment matches anything
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
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
};

// Route Group Checks
export const isProfessionalPortalRoute = (path: string): boolean => {
  return path.startsWith("/professional-portal");
};

export const isPublicRoute = (path: string): boolean => {
  const publicPaths = [
    "/",
    "/sign-in",
    "/sign-up",
    "/professionals",
    "/stores",
    "/properties",
  ];
  return publicPaths.some((p) => path === p || path.startsWith(`${p}/`));
};

export const isAuthRoute = (path: string): boolean => {
  return (
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path === "/auth-callback"
  );
};

// ============================================================================
// EXTERNAL LINKS
// ============================================================================

export const EXTERNAL_LINKS = {
  // Social Media
  facebook: "https://facebook.com/buildmarket",
  twitter: "https://twitter.com/buildmarket",
  instagram: "https://instagram.com/buildmarket",
  linkedin: "https://linkedin.com/company/buildmarket",
  youtube: "https://youtube.com/@buildmarket",

  // Support
  support: "mailto:support@buildmarket.co.ke",
  helpCenter: "/help",
  contactUs: "/contact",

  // Legal
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",

  // Resources
  blog: "/blog",
  faq: "/faq",
  careers: "/careers",
  pressKit: "/press",
} as const;

export type ExternalLinkKey = keyof typeof EXTERNAL_LINKS;
