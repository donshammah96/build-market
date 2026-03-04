"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfileStatus } from "./useProfileStatus";
import {
  getDashboardConfig,
  getDashboardGroup,
  DashboardConfig,
  DashboardGroup,
  DashboardMetrics,
  LeadData,
  ProjectData,
  StoreData,
  OrderData,
  PropertyListingData,
  PropertyInquiryData,
} from "@/lib/dashboard";
import type { InventoryAlert } from "@/lib/services/inventory";
import { API_ROUTES } from "@/lib/links";
import { storesClient } from "@/lib/stores-client";
import { projectsClient } from "@/lib/projects-client";
import { propertiesClient } from "@/lib/properties-client";

// ============================================================================
// TYPES
// ============================================================================

interface AgendaEvent {
  id: string;
  title: string;
  startDate: string;
  status: string;
}

interface PortfolioItem {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
}

interface TopProduct {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  soldCount: number;
  revenue: number;
}

interface PipelineStage {
  id: string;
  label: string;
  count: number;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export interface DashboardData {
  // Configuration
  config: DashboardConfig;
  group: DashboardGroup;

  // Metrics
  metrics: DashboardMetrics;

  // Service Provider data
  leads: LeadData[];
  projects: ProjectData[];
  portfolio: PortfolioItem[];

  // Store data
  stores: StoreData[];
  primaryStore: StoreData | null;
  orders: OrderData[];
  inventoryAlerts: InventoryAlert[];
  topProducts: TopProduct[];

  // Property data
  properties: PropertyListingData[];
  propertyInquiries: PropertyInquiryData[];
  pipeline: {
    stages: PipelineStage[];
    totalValue: number;
  };

  // Shared data
  agenda: AgendaEvent[];

  // State
  isLoading: boolean;
  error?: Error;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const dashboardKeys = {
  all: ["dashboard"] as const,
  metrics: (profession?: string) =>
    [...dashboardKeys.all, "metrics", profession] as const,
  agenda: () => [...dashboardKeys.all, "agenda"] as const,
  leads: () => [...dashboardKeys.all, "leads"] as const,
  projects: () => [...dashboardKeys.all, "projects"] as const,
  portfolio: () => [...dashboardKeys.all, "portfolio"] as const,
  stores: () => [...dashboardKeys.all, "stores"] as const,
  orders: () => [...dashboardKeys.all, "orders"] as const,
  inventoryAlerts: () => [...dashboardKeys.all, "inventory-alerts"] as const,
  topProducts: () => [...dashboardKeys.all, "top-products"] as const,
  properties: () => [...dashboardKeys.all, "properties"] as const,
  propertyInquiries: () =>
    [...dashboardKeys.all, "property-inquiries"] as const,
  pipeline: () => [...dashboardKeys.all, "pipeline"] as const,
};

// ============================================================================
// API FETCHERS
// ============================================================================

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch("/api/professional-portal/dashboard/metrics");
  if (!res.ok) throw new Error("Failed to fetch metrics");
  const data = await res.json();
  return data.data || {};
}

async function fetchLeads(): Promise<LeadData[]> {
  const res = await fetch(
    "/api/professional-portal/leads?limit=5&status=new,contacted",
  );
  if (!res.ok) throw new Error("Failed to fetch leads");
  const json = await res.json();
  const leads = json.data?.leads;
  return Array.isArray(leads) ? leads : [];
}

async function fetchProjects(): Promise<ProjectData[]> {
  const res = await projectsClient.getProjects({
    limit: 4,
    status: "active",
  });
  if (!res.success) throw new Error(res.error);
  const projects = res.data?.projects;
  return (Array.isArray(projects) ? projects : []) as ProjectData[];
}

async function fetchStores(): Promise<StoreData[]> {
  const res = await storesClient.getMyStores();
  if (!res.success) throw new Error(res.error);
  return res.data ?? [];
}

async function fetchOrders(): Promise<OrderData[]> {
  const res = await fetch("/api/professional-portal/orders?limit=5");
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  const orders = json.data?.data;
  return Array.isArray(orders) ? orders : [];
}

async function fetchProperties(): Promise<PropertyListingData[]> {
  const res = await propertiesClient.getMyProperties({ limit: 4 });
  if (!res.success) throw new Error(res.error);
  return (res.data ?? []) as PropertyListingData[];
}

async function fetchPropertyInquiries(): Promise<PropertyInquiryData[]> {
  const res = await fetch(
    "/api/professional-portal/inquiries?limit=4&type=property",
  );
  if (!res.ok) throw new Error("Failed to fetch inquiries");
  const json = await res.json();
  const inquiries = json.data?.data;
  return Array.isArray(inquiries) ? inquiries : [];
}

async function fetchAgenda(): Promise<AgendaEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const res = await fetch(
    `${API_ROUTES.professionalPortalCalendar}?start=${start.toISOString()}&end=${end.toISOString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch agenda");
  const json = await res.json();
  const events = json.data;
  return Array.isArray(events) ? events : [];
}

async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const res = await fetch("/api/professional-portal/portfolio?limit=4");
  if (!res.ok) throw new Error("Failed to fetch portfolio");
  const json = await res.json();
  const portfolios = json.data?.portfolios;
  return Array.isArray(portfolios) ? portfolios : [];
}

async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  const res = await fetch("/api/professional-portal/inventory/alerts");
  if (!res.ok) throw new Error("Failed to fetch inventory alerts");
  const json = await res.json();
  const alerts = json.data?.data;
  return Array.isArray(alerts) ? alerts : [];
}

async function fetchTopProducts(): Promise<TopProduct[]> {
  const res = await fetch("/api/professional-portal/products/top?limit=5");
  if (!res.ok) throw new Error("Failed to fetch top products");
  const json = await res.json();
  const products = json.data;
  return Array.isArray(products) ? products : [];
}

async function fetchPipeline(): Promise<{
  stages: PipelineStage[];
  totalValue: number;
}> {
  const res = await fetch("/api/professional-portal/pipeline");
  if (!res.ok) throw new Error("Failed to fetch pipeline");
  const json = await res.json();
  const data = json.data;
  return data && typeof data === "object"
    ? {
        stages: Array.isArray(data.stages) ? data.stages : [],
        totalValue: typeof data.totalValue === "number" ? data.totalValue : 0,
      }
    : { stages: [], totalValue: 0 };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDashboardData(): DashboardData & {
  refetch: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const { profile, isLoading: profileLoading } = useProfileStatus();

  // Only professional profiles have a profession field
  const profession =
    profile && "profession" in profile
      ? (profile.profession as string)
      : undefined;
  const config = getDashboardConfig(profession);
  const group = getDashboardGroup(profession ?? "");

  // Determine which data to fetch based on group
  const shouldFetchServiceProviderData =
    group === "service_provider" || group === "hybrid";
  const shouldFetchStoreData = group === "seller_store";
  const shouldFetchPropertyData =
    group === "seller_property" || group === "hybrid";

  // Always fetch metrics
  const metricsQuery = useQuery({
    queryKey: dashboardKeys.metrics(profession),
    queryFn: fetchDashboardMetrics,
    enabled: !profileLoading && !!profession,
    staleTime: 60000, // 1 minute
  });

  // Always fetch agenda
  const agendaQuery = useQuery({
    queryKey: dashboardKeys.agenda(),
    queryFn: fetchAgenda,
    enabled: !profileLoading,
    staleTime: 60000,
  });

  // Service Provider data
  const leadsQuery = useQuery({
    queryKey: dashboardKeys.leads(),
    queryFn: fetchLeads,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 30000, // 30 seconds
  });

  const projectsQuery = useQuery({
    queryKey: dashboardKeys.projects(),
    queryFn: fetchProjects,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 60000,
  });

  const portfolioQuery = useQuery({
    queryKey: dashboardKeys.portfolio(),
    queryFn: fetchPortfolio,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 300000, // 5 minutes
  });

  // Store data
  const storesQuery = useQuery({
    queryKey: dashboardKeys.stores(),
    queryFn: fetchStores,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 60000,
  });

  const ordersQuery = useQuery({
    queryKey: dashboardKeys.orders(),
    queryFn: fetchOrders,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 30000,
  });

  const inventoryQuery = useQuery({
    queryKey: dashboardKeys.inventoryAlerts(),
    queryFn: fetchInventoryAlerts,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 60000,
  });

  const topProductsQuery = useQuery({
    queryKey: dashboardKeys.topProducts(),
    queryFn: fetchTopProducts,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 300000,
  });

  // Property data
  const propertiesQuery = useQuery({
    queryKey: dashboardKeys.properties(),
    queryFn: fetchProperties,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 60000,
  });

  const propertyInquiriesQuery = useQuery({
    queryKey: dashboardKeys.propertyInquiries(),
    queryFn: fetchPropertyInquiries,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 30000,
  });

  const pipelineQuery = useQuery({
    queryKey: dashboardKeys.pipeline(),
    queryFn: fetchPipeline,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 60000,
  });

  // Determine overall loading state (core data per group)
  const isLoading =
    profileLoading ||
    metricsQuery.isLoading ||
    (shouldFetchServiceProviderData &&
      (leadsQuery.isLoading || projectsQuery.isLoading)) ||
    (shouldFetchStoreData &&
      (storesQuery.isLoading || ordersQuery.isLoading)) ||
    (shouldFetchPropertyData &&
      (propertiesQuery.isLoading ||
        propertyInquiriesQuery.isLoading ||
        pipelineQuery.isLoading));

  // Collect any error from enabled queries
  const error =
    metricsQuery.error ||
    agendaQuery.error ||
    leadsQuery.error ||
    projectsQuery.error ||
    portfolioQuery.error ||
    storesQuery.error ||
    ordersQuery.error ||
    inventoryQuery.error ||
    topProductsQuery.error ||
    propertiesQuery.error ||
    propertyInquiriesQuery.error ||
    pipelineQuery.error;

  // Get primary store (first store)
  const stores = storesQuery.data || [];
  const primaryStore: StoreData | null = stores[0] ?? null;

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };

  return {
    config,
    group,
    metrics: metricsQuery.data || {},

    // Service Provider
    leads: leadsQuery.data || [],
    projects: projectsQuery.data || [],
    portfolio: portfolioQuery.data || [],

    // Store
    stores,
    primaryStore,
    orders: ordersQuery.data || [],
    inventoryAlerts: inventoryQuery.data || [],
    topProducts: topProductsQuery.data || [],

    // Property
    properties: propertiesQuery.data || [],
    propertyInquiries: propertyInquiriesQuery.data || [],
    pipeline: pipelineQuery.data || { stages: [], totalValue: 0 },

    // Shared
    agenda: agendaQuery.data || [],

    isLoading,
    error: error as Error | undefined,
    refetch,
  };
}

export default useDashboardData;
