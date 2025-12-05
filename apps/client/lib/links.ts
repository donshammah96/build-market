export const ROUTES = {
  // Public Routes
  home: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  onboarding: '/onboarding',
  
  // Client / Homeowner Routes
  client: '/client',
  userDashboard: '/dashboard',
  userProfile: '/profile',
  userSettings: '/profile', // mapped to profile for now
  userNotifications: '/notifications',
  userProjects: '/projects',
  userMessages: '/messages', 
  
  // Features
  ideaBooks: '/idea-books',
  reviews: '/reviews',
  products: '/products',
  messages: '/messages', // General messages route

  // Professional Public Routes
  professional: '/professional',
  professionalList: '/professionals',
  professionalDetail: '/professionals/:id', // Placeholder for dynamic route
  joinAsPro: '/professional/register',
  professionalProfile: '/professional/profile',
  
  // Professional Portal (Private Tools)
  professionalDashboard: '/professional-portal/dashboard',
  professionalLeads: '/professional-portal/leads',
  professionalProjects: '/professional-portal/projects',
  professionalMessages: '/professional-portal/messages',
  professionalPortfolio: '/professional-portal/portfolio',
  professionalFinance: '/professional-portal/finance',
  professionalSettings: '/professional-portal/settings',
  professionalCalendar: '/professional-portal/calendar',

  // Categories & Search
  findProfessional: '/professionals',
  speakWithAdvisor: '/speak-with-an-advisor',
  
  // Category Routes
  hardwareShops: '/professionals/hardware-shops',
  commercialStores: '/professionals/commercial-stores',
  tilesAndCarpets: '/professionals/tiles-and-carpets',
  generalContractors: '/professionals/general-contractors',
  cabinets: '/professionals/cabinets',
  furniture: '/professionals/furniture',
  electricalAndLighting: '/professionals/electrical-and-lighting',
  plumbing: '/professionals/plumbing',
  paintAndWallpapers: '/professionals/paint-and-wallpapers',
  flooringAndTile: '/professionals/flooring-and-tile',
  roofing: '/professionals/roofing',
  engineers: '/professionals/engineers',
  designers: '/professionals/designers',
  architects: '/professionals/architects',
} as const;

export type RouteKey = keyof typeof ROUTES;

// Helper to generate dynamic routes
export const getProfessionalUrl = (id: string) => `/professionals/${id}`;
export const getProjectUrl = (id: string) => `/projects/${id}`;
export const getIdeaBookUrl = (id: string) => `/idea-books/${id}`;
export const getVendorUrl = (id: string) => `/vendors/${id}`;

// Professional Portal Helpers
export const getProfessionalProjectUrl = (id: string) => `/professional-portal/projects/${id}`;
export const getProfessionalPortfolioUrl = (id: string) => `/professional-portal/portfolio/${id}`;
export const getProfessionalEventUrl = (id: string) => `/professional-portal/calendar/${id}`;
export const getProfessionalLeadUrl = (id: string) => `/professional-portal/leads/${id}`;
