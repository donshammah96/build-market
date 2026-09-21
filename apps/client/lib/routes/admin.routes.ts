// ============================================================================
// ADMIN ROUTES — admin-panel page and API routes
// ============================================================================

export const ADMIN_ROUTES = {
  // Admin pages live in apps/admin — listed here for cross-app linking only
  adminDashboard: "/admin",
  adminUsers: "/admin/users",
  adminProfessionals: "/admin/professionals",
  adminProperties: "/admin/properties",
  adminStores: "/admin/stores",
  adminFinance: "/admin/finance",
  adminSettings: "/admin/settings",
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTES;

// ============================================================================
// ADMIN API ROUTES — API endpoints consumed by the admin application
// ============================================================================

export const ADMIN_API_ROUTES = {
  // Internal system settings (called by middleware)
  internalSystemSettings: "/api/internal/system-settings",
} as const;
