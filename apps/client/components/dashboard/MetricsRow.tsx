"use client";

import {
  DollarSign,
  Users,
  Briefcase,
  Star,
  ShoppingCart,
  Package,
  Eye,
  Home,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { MetricCard } from "./widgets/shared/MetricCard";
import { MetricId, DashboardMetrics } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface MetricsRowProps {
  /** Which metrics to display */
  metrics: MetricId[];
  /** Metrics data */
  data: DashboardMetrics;
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// METRIC CONFIGURATION
// ============================================================================

interface MetricDisplayConfig {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  format: (value: number | undefined) => string;
  trendKey?: keyof DashboardMetrics;
  formatTrend?: (value: number | undefined) => string;
  chart?: number[];
}

const METRIC_CONFIGS: Record<MetricId, MetricDisplayConfig> = {
  // Service Provider metrics
  total_revenue: {
    title: "Total Revenue",
    icon: DollarSign,
    format: (v) => (v ? `KSh ${(v / 1000000).toFixed(1)}M` : "KSh 0"),
    trendKey: "revenueChange",
    formatTrend: (v) => (v ? `${v > 0 ? "+" : ""}${v}%` : "0%"),
    chart: [40, 60, 55, 70, 65, 80, 85],
  },
  active_leads: {
    title: "Active Leads",
    icon: Users,
    format: (v) => String(v ?? 0),
    trendKey: "leadsChange",
    formatTrend: (v) => (v ? `+${v} this week` : "No change"),
    chart: [20, 25, 30, 25, 35, 40, 45],
  },
  active_projects: {
    title: "Projects",
    icon: Briefcase,
    format: (v) => String(v ?? 0),
    formatTrend: (v) => (v ? `${v} on track` : "On Schedule"),
    chart: [50, 50, 50, 60, 60, 60, 60],
  },
  client_rating: {
    title: "Client Rating",
    icon: Star,
    format: (v) => (v ? v.toFixed(1) : "—"),
    formatTrend: () => "Top Rated",
    chart: [90, 92, 95, 95, 98, 98, 98],
  },

  // Store metrics
  total_sales: {
    title: "Total Sales",
    icon: DollarSign,
    format: (v) =>
      v
        ? v >= 1000000
          ? `KSh ${(v / 1000000).toFixed(1)}M`
          : `KSh ${(v / 1000).toFixed(0)}k`
        : "KSh 0",
    trendKey: "salesChange",
    formatTrend: (v) => (v ? `${v > 0 ? "+" : ""}${v}%` : "0%"),
    chart: [30, 45, 50, 55, 60, 70, 75],
  },
  pending_orders: {
    title: "Pending Orders",
    icon: ShoppingCart,
    format: (v) => String(v ?? 0),
    formatTrend: () => "Awaiting",
    chart: [10, 15, 12, 20, 18, 22, 25],
  },
  total_products: {
    title: "Products",
    icon: Package,
    format: (v) => String(v ?? 0),
    formatTrend: () => "In Stock",
    chart: [60, 60, 65, 65, 70, 70, 72],
  },
  store_views: {
    title: "Store Views",
    icon: Eye,
    format: (v) => (v ? v.toLocaleString() : "0"),
    trendKey: "viewsChange",
    formatTrend: (v) => (v ? `${v > 0 ? "+" : ""}${v}%` : "0%"),
    chart: [25, 30, 35, 40, 55, 60, 80],
  },

  // Property metrics
  active_listings: {
    title: "Active Listings",
    icon: Home,
    format: (v) => String(v ?? 0),
    formatTrend: () => "Listed",
    chart: [40, 45, 50, 48, 55, 60, 62],
  },
  property_inquiries: {
    title: "Inquiries",
    icon: MessageSquare,
    format: (v) => String(v ?? 0),
    trendKey: "inquiriesChange",
    formatTrend: (v) => (v ? `+${v} this week` : "No change"),
    chart: [15, 20, 25, 30, 28, 35, 40],
  },
  property_views: {
    title: "Property Views",
    icon: Eye,
    format: (v) => (v ? v.toLocaleString() : "0"),
    formatTrend: () => "This month",
    chart: [50, 55, 60, 70, 75, 85, 90],
  },
  closings: {
    title: "Closings",
    icon: CheckCircle2,
    format: (v) => String(v ?? 0),
    trendKey: "closingsChange",
    formatTrend: (v) => (v ? `+${v} this month` : "This month"),
    chart: [20, 25, 30, 35, 40, 45, 50],
  },
};

// ============================================================================
// HELPER: Get metric value from data
// ============================================================================

function getMetricValue(
  metricId: MetricId,
  data: DashboardMetrics
): number | undefined {
  const mapping: Record<MetricId, keyof DashboardMetrics | undefined> = {
    total_revenue: "totalRevenue",
    active_leads: "activeLeads",
    active_projects: "activeProjects",
    client_rating: "clientRating",
    total_sales: "totalSales",
    pending_orders: "pendingOrders",
    total_products: "totalProducts",
    store_views: "storeViews",
    active_listings: "activeListings",
    property_inquiries: "propertyInquiries",
    property_views: "propertyViews",
    closings: "closings",
  };

  const key = mapping[metricId];
  return key ? (data[key] as number | undefined) : undefined;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MetricsRow({
  metrics,
  data,
  isLoading = false,
  className,
}: MetricsRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",
        className
      )}
    >
      {metrics.map((metricId) => {
        const config = METRIC_CONFIGS[metricId];
        if (!config) return null;

        const value = getMetricValue(metricId, data);
        const trendValue = config.trendKey
          ? (data[config.trendKey] as number | undefined)
          : undefined;

        return (
          <MetricCard
            key={metricId}
            title={config.title}
            value={config.format(value)}
            trend={config.formatTrend?.(trendValue ?? value)}
            trendDirection={
              trendValue !== undefined
                ? trendValue > 0
                  ? "up"
                  : trendValue < 0
                    ? "down"
                    : "neutral"
                : "up"
            }
            icon={config.icon}
            chart={config.chart || []}
            highlight
            isLoading={isLoading}
          />
        );
      })}
    </div>
  );
}

export default MetricsRow;
