/**
 * Dashboard Configuration System
 *
 * Maps professions to dashboard configurations with appropriate
 * widgets, metrics, and quick actions based on profession type.
 */

import {
  Calendar,
  Plus,
  Store,
  Building2,
  Home,
  Briefcase,
} from "lucide-react";

import {
  DashboardGroup,
  DashboardConfig,
  QuickAction,
} from "./dashboard-types";

import {
  SUPPLIER_PROFESSIONS,
  REAL_ESTATE_PROFESSIONS,
} from "@/lib/constants/professionOptions";

// ============================================================================
// PROFESSION TO GROUP MAPPING
// ============================================================================

/**
 * Property developers are hybrid - they have both projects and properties
 */
const HYBRID_PROFESSIONS = ["property_developer"] as const;

/**
 * Get the dashboard group for a profession
 */
export function getDashboardGroup(profession: string): DashboardGroup {
  // Check for hybrid first (property developers)
  if (
    HYBRID_PROFESSIONS.includes(
      profession as (typeof HYBRID_PROFESSIONS)[number],
    )
  ) {
    return "hybrid";
  }

  // Check for suppliers (store owners)
  if (
    SUPPLIER_PROFESSIONS.includes(
      profession as (typeof SUPPLIER_PROFESSIONS)[number],
    )
  ) {
    return "seller_store";
  }

  // Check for real estate (property sellers)
  if (
    REAL_ESTATE_PROFESSIONS.includes(
      profession as (typeof REAL_ESTATE_PROFESSIONS)[number],
    )
  ) {
    return "seller_property";
  }

  // Default: service provider (engineers, architects, contractors, trades)
  return "service_provider";
}

// ============================================================================
// QUICK ACTIONS BY GROUP
// ============================================================================

const SERVICE_PROVIDER_ACTIONS: QuickAction[] = [
  {
    id: "schedule",
    label: "Schedule",
    href: "/professional-portal/calendar",
    icon: Calendar,
    variant: "secondary",
  },
  {
    id: "add_project",
    label: "New Project",
    href: "/professional-portal/projects/new",
    icon: Plus,
    variant: "primary",
  },
];

const SELLER_STORE_ACTIONS: QuickAction[] = [
  {
    id: "manage_store",
    label: "Manage Store",
    href: "/professional-portal/settings/stores",
    icon: Store,
    variant: "secondary",
  },
  {
    id: "add_product",
    label: "Add Product",
    href: "/professional-portal/products/new",
    icon: Plus,
    variant: "primary",
  },
];

const SELLER_PROPERTY_ACTIONS: QuickAction[] = [
  {
    id: "schedule",
    label: "Schedule",
    href: "/professional-portal/calendar",
    icon: Calendar,
    variant: "secondary",
  },
  {
    id: "add_listing",
    label: "New Listing",
    href: "/professional-portal/properties/new",
    icon: Plus,
    variant: "primary",
  },
];

const HYBRID_ACTIONS: QuickAction[] = [
  {
    id: "schedule",
    label: "Schedule",
    href: "/professional-portal/calendar",
    icon: Calendar,
    variant: "secondary",
  },
  {
    id: "add_project",
    label: "New Development",
    href: "/professional-portal/projects/new",
    icon: Building2,
    variant: "primary",
  },
];

// ============================================================================
// DASHBOARD CONFIGURATIONS
// ============================================================================

const SERVICE_PROVIDER_CONFIG: DashboardConfig = {
  group: "service_provider",
  label: "Professional Dashboard",
  description: "Manage your projects, leads, and client relationships",
  metrics: [
    "total_revenue",
    "active_leads",
    "active_projects",
    "client_rating",
  ],
  primaryWidgets: ["leads", "projects"],
  secondaryWidgets: ["profile_strength", "agenda", "portfolio"],
  quickActions: SERVICE_PROVIDER_ACTIONS,
  welcomeMessage:
    "You have {leads} new leads and {projects} active projects requiring attention today.",
};

const SELLER_STORE_CONFIG: DashboardConfig = {
  group: "seller_store",
  label: "Store Dashboard",
  description: "Track your store performance, orders, and inventory",
  metrics: ["total_sales", "pending_orders", "total_products", "store_views"],
  primaryWidgets: ["store_overview", "orders"],
  secondaryWidgets: ["profile_strength", "inventory_alerts", "products"],
  quickActions: SELLER_STORE_ACTIONS,
  welcomeMessage:
    "You have {orders} pending orders and {products} products in your store.",
};

const SELLER_PROPERTY_CONFIG: DashboardConfig = {
  group: "seller_property",
  label: "Real Estate Dashboard",
  description: "Manage your property listings and client inquiries",
  metrics: [
    "active_listings",
    "property_inquiries",
    "property_views",
    "closings",
  ],
  primaryWidgets: ["property_inquiries", "property_listings"],
  secondaryWidgets: ["profile_strength", "sales_pipeline", "agenda"],
  quickActions: SELLER_PROPERTY_ACTIONS,
  welcomeMessage:
    "You have {inquiries} new inquiries and {listings} active listings.",
};

const HYBRID_CONFIG: DashboardConfig = {
  group: "hybrid",
  label: "Developer Dashboard",
  description: "Oversee your development projects and property portfolio",
  metrics: [
    "active_projects",
    "active_listings",
    "total_revenue",
    "property_views",
  ],
  primaryWidgets: ["development_projects", "property_listings"],
  secondaryWidgets: ["profile_strength", "agenda", "sales_pipeline"],
  quickActions: HYBRID_ACTIONS,
  welcomeMessage:
    "You have {projects} active developments and {listings} properties for sale.",
};

// ============================================================================
// MAIN CONFIGURATION GETTER
// ============================================================================

/**
 * Get the complete dashboard configuration for a profession
 */
export function getDashboardConfig(
  profession: string | undefined | null,
): DashboardConfig {
  if (!profession) {
    return SERVICE_PROVIDER_CONFIG; // Default fallback
  }

  const group = getDashboardGroup(profession);

  switch (group) {
    case "seller_store":
      return SELLER_STORE_CONFIG;
    case "seller_property":
      return SELLER_PROPERTY_CONFIG;
    case "hybrid":
      return HYBRID_CONFIG;
    case "service_provider":
    default:
      return SERVICE_PROVIDER_CONFIG;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a profession should see store-related features
 */
export function shouldShowStoreFeatures(profession: string): boolean {
  const group = getDashboardGroup(profession);
  return group === "seller_store";
}

/**
 * Check if a profession should see property-related features
 */
export function shouldShowPropertyFeatures(profession: string): boolean {
  const group = getDashboardGroup(profession);
  return group === "seller_property" || group === "hybrid";
}

/**
 * Check if a profession should see project-related features
 */
export function shouldShowProjectFeatures(profession: string): boolean {
  const group = getDashboardGroup(profession);
  return group === "service_provider" || group === "hybrid";
}

/**
 * Get icon for a dashboard group
 */
export function getDashboardGroupIcon(group: DashboardGroup) {
  switch (group) {
    case "seller_store":
      return Store;
    case "seller_property":
      return Home;
    case "hybrid":
      return Building2;
    case "service_provider":
    default:
      return Briefcase;
  }
}

/**
 * Format welcome message with actual data
 */
export function formatWelcomeMessage(
  config: DashboardConfig,
  data: {
    leads?: number;
    projects?: number;
    orders?: number;
    products?: number;
    inquiries?: number;
    listings?: number;
  },
): string {
  let message = config.welcomeMessage;

  message = message.replace("{leads}", String(data.leads ?? 0));
  message = message.replace("{projects}", String(data.projects ?? 0));
  message = message.replace("{orders}", String(data.orders ?? 0));
  message = message.replace("{products}", String(data.products ?? 0));
  message = message.replace("{inquiries}", String(data.inquiries ?? 0));
  message = message.replace("{listings}", String(data.listings ?? 0));

  return message;
}
