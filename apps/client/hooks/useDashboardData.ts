"use client";

import { useQuery } from "@tanstack/react-query";
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
import { API_ROUTES } from "@/lib/links";

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

interface InventoryAlert {
  id: string;
  productName: string;
  sku?: string;
  currentStock: number;
  threshold: number;
  status: "low" | "out_of_stock";
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
    "/api/professional-portal/leads?limit=5&status=new,contacted"
  );
  if (!res.ok) throw new Error("Failed to fetch leads");
  const json = await res.json();
  // API returns { success: true, data: { data: leads[], pagination: {...} } }
  const leadsArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return leadsArray;
}

async function fetchProjects(): Promise<ProjectData[]> {
  const res = await fetch(
    "/api/professional-portal/projects?limit=4&status=active"
  );
  if (!res.ok) throw new Error("Failed to fetch projects");
  const json = await res.json();
  // API returns { success: true, data: { data: projects[], pagination: {...} } }
  const projectsArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return projectsArray;
}

async function fetchStores(): Promise<StoreData[]> {
  const res = await fetch("/api/stores/my-stores");
  if (!res.ok) throw new Error("Failed to fetch stores");
  const json = await res.json();
  // API returns { success: true, data: { data: stores[], pagination: {...} } }
  const storesArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return storesArray;
}

async function fetchOrders(): Promise<OrderData[]> {
  const res = await fetch("/api/professional-portal/orders?limit=5");
  if (!res.ok) throw new Error("Failed to fetch orders");
  const json = await res.json();
  // API returns { success: true, data: { data: orders[], pagination: {...} } }
  const ordersArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return ordersArray;
}

async function fetchProperties(): Promise<PropertyListingData[]> {
  const res = await fetch("/api/properties/my-listings?limit=4");
  if (!res.ok) throw new Error("Failed to fetch properties");
  const json = await res.json();
  // API returns { success: true, data: { data: properties[], pagination: {...} } }
  const propertiesArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return propertiesArray;
}

async function fetchPropertyInquiries(): Promise<PropertyInquiryData[]> {
  const res = await fetch(
    "/api/professional-portal/inquiries?limit=4&type=property"
  );
  if (!res.ok) throw new Error("Failed to fetch inquiries");
  const json = await res.json();
  // API returns { success: true, data: { data: inquiries[], pagination: {...} } }
  const inquiriesArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return inquiriesArray;
}

async function fetchAgenda(): Promise<AgendaEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const res = await fetch(
    `${API_ROUTES.professionalPortalCalendar}?start=${start.toISOString()}&end=${end.toISOString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch agenda");
  const json = await res.json();
  // API returns { success: true, data: { data: events[], pagination: {...} } }
  const eventsArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return eventsArray;
}

async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const res = await fetch("/api/professional-portal/portfolio?limit=4");
  if (!res.ok) throw new Error("Failed to fetch portfolio");
  const json = await res.json();
  // API returns { success: true, data: { data: portfolio[], pagination: {...} } }
  const portfolioArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return portfolioArray;
}

async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  const res = await fetch("/api/professional-portal/inventory/alerts");
  if (!res.ok) throw new Error("Failed to fetch inventory alerts");
  const json = await res.json();
  // API returns { success: true, data: { data: alerts[], pagination: {...} } }
  const alertsArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return alertsArray;
}

async function fetchTopProducts(): Promise<TopProduct[]> {
  const res = await fetch("/api/professional-portal/products/top?limit=5");
  if (!res.ok) throw new Error("Failed to fetch top products");
  const json = await res.json();
  // API returns { success: true, data: { data: products[], pagination: {...} } }
  const productsArray = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data)
      ? json.data
      : [];
  return productsArray;
}

async function fetchPipeline(): Promise<{
  stages: PipelineStage[];
  totalValue: number;
}> {
  const res = await fetch("/api/professional-portal/pipeline");
  if (!res.ok) throw new Error("Failed to fetch pipeline");
  const data = await res.json();
  return data.data || { stages: [], totalValue: 0 };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDashboardData(): DashboardData {
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
    queryKey: ["dashboard-metrics", profession],
    queryFn: fetchDashboardMetrics,
    enabled: !profileLoading && !!profession,
    staleTime: 60000, // 1 minute
  });

  // Always fetch agenda
  const agendaQuery = useQuery({
    queryKey: ["dashboard-agenda"],
    queryFn: fetchAgenda,
    enabled: !profileLoading,
    staleTime: 60000,
  });

  // Service Provider data
  const leadsQuery = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: fetchLeads,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 30000, // 30 seconds
  });

  const projectsQuery = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: fetchProjects,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 60000,
  });

  const portfolioQuery = useQuery({
    queryKey: ["dashboard-portfolio"],
    queryFn: fetchPortfolio,
    enabled: !profileLoading && shouldFetchServiceProviderData,
    staleTime: 300000, // 5 minutes
  });

  // Store data
  const storesQuery = useQuery({
    queryKey: ["dashboard-stores"],
    queryFn: fetchStores,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 60000,
  });

  const ordersQuery = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: fetchOrders,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 30000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["dashboard-inventory-alerts"],
    queryFn: fetchInventoryAlerts,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 60000,
  });

  const topProductsQuery = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: fetchTopProducts,
    enabled: !profileLoading && shouldFetchStoreData,
    staleTime: 300000,
  });

  // Property data
  const propertiesQuery = useQuery({
    queryKey: ["dashboard-properties"],
    queryFn: fetchProperties,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 60000,
  });

  const propertyInquiriesQuery = useQuery({
    queryKey: ["dashboard-property-inquiries"],
    queryFn: fetchPropertyInquiries,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 30000,
  });

  const pipelineQuery = useQuery({
    queryKey: ["dashboard-pipeline"],
    queryFn: fetchPipeline,
    enabled: !profileLoading && shouldFetchPropertyData,
    staleTime: 60000,
  });

  // Determine overall loading state
  const isLoading =
    profileLoading ||
    metricsQuery.isLoading ||
    (shouldFetchServiceProviderData &&
      (leadsQuery.isLoading || projectsQuery.isLoading)) ||
    (shouldFetchStoreData &&
      (storesQuery.isLoading || ordersQuery.isLoading)) ||
    (shouldFetchPropertyData &&
      (propertiesQuery.isLoading || propertyInquiriesQuery.isLoading));

  // Collect any error
  const error =
    metricsQuery.error ||
    leadsQuery.error ||
    projectsQuery.error ||
    storesQuery.error ||
    ordersQuery.error ||
    propertiesQuery.error ||
    propertyInquiriesQuery.error;

  // Get primary store (first store)
  const stores = storesQuery.data || [];
  const primaryStore: StoreData | null = stores[0] ?? null;

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
  };
}

export default useDashboardData;
