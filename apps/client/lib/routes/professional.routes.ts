import { normalizeRole, type AppRole } from "@/app/lib/security/roles";

// ============================================================================
// PROFESSIONAL PAGE ROUTES — public professional listing + portal private routes
// ============================================================================

export const PROFESSIONAL_ROUTES = {
  // Public professional routes
  professional: "/professional",
  professionalList: "/professionals",
  professionalDetail: "/professionals/:id",
  joinAsPro: "/professional/sign-up",
  professionalProfile: "/professional/profile",
  professionalOnboarding:
    "/onboarding?role=professional&step=2&source=join-as-pro",

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

  // Professional Portal (Private)
  professionalDashboard: "/professional-portal/dashboard",
  professionalLeads: "/professional-portal/leads",
  professionalProjects: "/professional-portal/projects",
  professionalMessages: "/professional-portal/messages",
  professionalPortfolio: "/professional-portal/portfolio",
  professionalFinance: "/professional-portal/finance",
  professionalSettings: "/professional-portal/settings",
  professionalProfileComplete: "/professional-portal/settings/complete-profile",
  professionalCalendar: "/professional-portal/calendar",
  professionalPendingVerification: "/professional-portal/pending-verification",
} as const;

export type ProfessionalRouteKey = keyof typeof PROFESSIONAL_ROUTES;

// Public professional URL helpers
export const getProfessionalUrl = (id: string) => `/professionals/${id}`;
export const getProfessionalByCategoryUrl = (category: string) =>
  `/professionals/${category.replace(/_/g, "-")}`;
export const getProfessionalReviewsUrl = (id: string) =>
  `/professionals/${id}/reviews`;
export const getProfessionalPortfoliosUrl = (id: string) =>
  `/professionals/${id}/portfolios`;
export const getProfessionalContactUrl = (id: string) =>
  `/professionals/${id}/contact`;

// Professional portal URL helpers
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

// Route group checks
export const isProfessionalPortalRoute = (path: string): boolean =>
  path.startsWith("/professional-portal");

// Dashboard role helper
export function dashboardForRole(role?: AppRole | string): string {
  return normalizeRole(role) === "PROFESSIONAL"
    ? PROFESSIONAL_ROUTES.professionalDashboard
    : "/homeowner-dashboard";
}

// ============================================================================
// PROFESSIONAL API ROUTES
// ============================================================================

export const PROFESSIONAL_API_ROUTES = {
  professionals: "/api/professionals",
  professionalDetail: (id: string) => `/api/professionals/${id}`,
  professionalOnboarding: "/api/professional/onboarding",

  professionalPortal: "/api/professional-portal",
  professionalPortalDetail: (id: string) => `/api/professional-portal/${id}`,
  professionalPortalCalendar: "/api/professional-portal/calendar",
  professionalPortalLeads: "/api/professional-portal/leads",
  professionalPortalLeadDetail: (id: string) =>
    `/api/professional-portal/leads/${id}`,
  professionalPortalQuotes: "/api/professional-portal/quotes",
  professionalPortalCertificates: "/api/professional-portal/certificates",
  professionalPortalCertificateDetail: (id: string) =>
    `/api/professional-portal/certificates/${id}`,
  professionalPortalDocuments: "/api/professional-portal/documents",
  professionalPortalDocumentDetail: (id: string) =>
    `/api/professional-portal/documents/${id}`,
  professionalPortalLicenses: "/api/professional-portal/licenses",
  professionalPortalLicenseDetail: (id: string) =>
    `/api/professional-portal/licenses/${id}`,
  professionalPortalMessages: "/api/professional-portal/messages",
  professionalPortalFinance: "/api/professional-portal/finance",
  professionalPortalFinanceStats: "/api/professional-portal/finance/stats",
  professionalPortalFinanceTransactions:
    "/api/professional-portal/finance/transactions",
  professionalPortalFinanceTransactionDetail: (id: string) =>
    `/api/professional-portal/finance/transactions/${id}`,
  professionalPortalFinanceWithdraw:
    "/api/professional-portal/finance/withdraw",
  professionalPortalClients: "/api/professional-portal/clients",
  professionalPortalInquiries: "/api/professional-portal/inquiries",
  professionalPortalInquiryDetail: (id: string) =>
    `/api/professional-portal/inquiries/${id}`,
  professionalPortalDashboardMetrics:
    "/api/professional-portal/dashboard/metrics",
  professionalPortalOrders: "/api/professional-portal/orders",
  professionalPortalInventoryAlerts:
    "/api/professional-portal/inventory/alerts",
  professionalPortalPortfolio: "/api/professional-portal/portfolio",
  professionalPortalPortfolioDetail: (id: string) =>
    `/api/professional-portal/portfolio/${id}`,
  professionalPortalPortfolioImages: (id: string) =>
    `/api/professional-portal/portfolio/${id}/images`,
  professionalPortalPipeline: "/api/professional-portal/pipeline",
  professionalPortalTopProducts: "/api/professional-portal/products/top",
  professionalPortalProfile: "/api/professional-portal/profile",
  professionalPortalProfileDetail: (id: string) =>
    `/api/professional-portal/profile/${id}`,
  professionalPortalProjects: "/api/professional-portal/projects",
  professionalPortalProjectDetail: (id: string) =>
    `/api/professional-portal/projects/${id}`,
  professionalPortalProjectMilestones: (projectId: string) =>
    `/api/professional-portal/projects/${projectId}/milestones`,
  professionalPortalProjectMilestoneApprove: (
    projectId: string,
    milestoneId: string,
  ) =>
    `/api/professional-portal/projects/${projectId}/milestones/${milestoneId}/approve`,
  professionalPortalProjectEscrowFund: (projectId: string, escrowId: string) =>
    `/api/professional-portal/projects/${projectId}/escrow/${escrowId}/fund`,
  professionalPortalProjectEscrowRelease: (
    projectId: string,
    escrowId: string,
  ) =>
    `/api/professional-portal/projects/${projectId}/escrow/${escrowId}/release`,

  professionalProfile: "/api/professional-portal/profile",
  professionalProfileComplete: "/api/professional-portal/profile/complete",
} as const;

export const getApiProfessionalDetailUrl = (id: string) =>
  PROFESSIONAL_API_ROUTES.professionalDetail(id);
