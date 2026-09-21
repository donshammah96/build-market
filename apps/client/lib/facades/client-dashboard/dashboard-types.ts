/**
 * Dashboard Types
 *
 * Type definitions for the profession-specific dashboard system.
 */

import { LucideIcon } from "lucide-react";

// ============================================================================
// DASHBOARD GROUPS
// ============================================================================

/**
 * Dashboard group types based on profession categories
 */
export type DashboardGroup =
  | "service_provider" // Engineers, Architects, Contractors, Trades
  | "seller_store" // Suppliers with stores
  | "seller_property" // Realtors, Real Estate Agents
  | "hybrid"; // Property Developers (projects + properties)

// ============================================================================
// WIDGET TYPES
// ============================================================================

/**
 * Available widget identifiers
 *
 * Note: All widgets should have corresponding implementations in the widget registry.
 * Widgets prefixed with comments indicate their implementation status.
 */
export type WidgetId =
  // Shared widgets (implemented)
  | "profile_strength"
  | "agenda"
  // Service Provider widgets (implemented)
  | "leads"
  | "projects"
  | "portfolio"
  // Seller (Store) widgets (implemented)
  | "store_overview"
  | "orders"
  | "products"
  | "inventory_alerts"
  // Seller (Property) widgets (implemented)
  | "property_listings"
  | "property_inquiries"
  | "sales_pipeline"
  // Hybrid widgets (for property developers)
  | "development_projects"
  // Tier & monetization widgets
  | "tier_system";

/**
 * Metric card identifiers
 */
export type MetricId =
  // Service Provider metrics
  | "total_revenue"
  | "active_leads"
  | "active_projects"
  | "client_rating"
  // Store metrics
  | "total_sales"
  | "pending_orders"
  | "total_products"
  | "store_views"
  // Property metrics
  | "active_listings"
  | "property_inquiries"
  | "property_views"
  | "closings";

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Quick action configuration
 */
export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "secondary";
}

// ============================================================================
// DASHBOARD CONFIG
// ============================================================================

/**
 * Complete dashboard configuration for a profession group
 */
export interface DashboardConfig {
  /** The profession group */
  group: DashboardGroup;
  /** Human-readable label for the dashboard */
  label: string;
  /** Description of the dashboard */
  description: string;
  /** Metric cards to display in the top row */
  metrics: MetricId[];
  /** Primary widgets (main content area) */
  primaryWidgets: WidgetId[];
  /** Secondary widgets (sidebar) */
  secondaryWidgets: WidgetId[];
  /** Quick action buttons */
  quickActions: QuickAction[];
  /** Welcome message template */
  welcomeMessage: string;
}

// ============================================================================
// WIDGET REGISTRY
// ============================================================================

/**
 * Widget component props
 */
export interface WidgetProps {
  /** Widget data from useDashboardData */
  data?: unknown;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Widget registry entry
 */
export interface WidgetRegistryEntry {
  id: WidgetId;
  label: string;
  component: React.ComponentType<WidgetProps>;
  /** Which groups can use this widget */
  groups: DashboardGroup[];
  /** Size hint for grid layout */
  size?: "small" | "medium" | "large" | "full";
}

// ============================================================================
// METRIC CARD TYPES
// ============================================================================

/**
 * Metric card configuration
 */
export interface MetricConfig {
  id: MetricId;
  label: string;
  icon: LucideIcon;
  /** Value formatter */
  format?: "currency" | "number" | "percentage" | "rating";
  /** Trend display */
  showTrend?: boolean;
  /** Sparkline chart data key */
  chartKey?: string;
}

// ============================================================================
// DASHBOARD DATA TYPES
// ============================================================================

/**
 * Lead/Inquiry data
 */
export interface LeadData {
  id: string;
  name: string;
  project: string;
  budget: string;
  location: string;
  status: "new" | "contacted" | "proposal" | "won" | "lost";
  receivedAt: string;
  avatar?: string;
}

/**
 * Project data
 */
export interface ProjectData {
  id: string;
  title: string;
  client: string;
  progress: number;
  status: "on_track" | "attention" | "delayed" | "completed";
  dueDate: string;
}

/**
 * Store overview data
 */
export interface StoreData {
  id: string;
  name: string;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  views: number;
}

/**
 * Order data
 */
export interface OrderData {
  id: string;
  customerName: string;
  items: number;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
}

/**
 * Property listing data
 */
export interface PropertyListingData {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  status: "active" | "pending" | "sold" | "rented";
  views: number;
  inquiries: number;
  images: string[];
}

/**
 * Property inquiry data
 */
export interface PropertyInquiryData {
  id: string;
  propertyTitle: string;
  clientName: string;
  clientPhone: string;
  message: string;
  status: "new" | "contacted" | "viewing_scheduled" | "offer_made" | "closed";
  createdAt: string;
}

/**
 * Aggregated dashboard metrics
 */
export interface DashboardMetrics {
  // Service Provider
  totalRevenue?: number;
  revenueChange?: number;
  activeLeads?: number;
  leadsChange?: number;
  activeProjects?: number;
  projectsOnTrack?: number;
  clientRating?: number;
  totalReviews?: number;

  // Store
  totalSales?: number;
  salesChange?: number;
  pendingOrders?: number;
  totalProducts?: number;
  storeViews?: number;
  viewsChange?: number;

  // Property
  activeListings?: number;
  propertyInquiries?: number;
  inquiriesChange?: number;
  propertyViews?: number;
  closings?: number;
  closingsChange?: number;
}

/**
 * Complete dashboard data returned from useDashboardData
 */
export interface DashboardData {
  config: DashboardConfig;
  metrics: DashboardMetrics;
  leads?: LeadData[];
  projects?: ProjectData[];
  stores?: StoreData[];
  orders?: OrderData[];
  properties?: PropertyListingData[];
  propertyInquiries?: PropertyInquiryData[];
  agenda?: Array<{
    id: string;
    title: string;
    startDate: string;
    status: string;
  }>;
  isLoading: boolean;
  error?: Error;
}
