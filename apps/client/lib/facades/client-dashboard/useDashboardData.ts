"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, CheckCircle2 } from "lucide-react";
import { useProfileStatus } from "../user-profile/useProfileStatus";
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
import type { SellerInventoryAlert } from "@/domains/seller-insights";
import type { InquiryListItem } from "@/domains/inquiries/contracts";
import { calendarClient } from "@/lib/facades/calendar/calendar-client";
import { dashboardMetricsClient } from "@/lib/facades/client-dashboard/dashboard-metrics-client";
import { inventoryClient } from "@/lib/facades/stores/inventory-client";
import { leadsClient } from "@/lib/facades/leads/leads-client";
import { ordersClient } from "@/lib/facades/stores/orders-client";
import { storesClient } from "@/lib/facades/stores/stores-client";
import { propertiesClient } from "@/lib/facades/properties/properties-client";
import { inquiriesClient } from "@/lib/facades/inquiries/inquiries-client";
import { pipelineClient } from "@/lib/facades/pipeline/pipeline-client";
import { portfolioClient } from "@/lib/facades/portfolio/portfolio-client";
import {
  productsClient,
  type TopProduct,
} from "@/lib/facades/stores/products-client";
import { projectsClient } from "@/lib/facades/projects/projects-client";

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

interface PipelineStage {
  id: string;
  label: string;
  count: number;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const DASHBOARD_PIPELINE_STAGE_META: Record<
  string,
  Omit<PipelineStage, "count" | "value">
> = {
  viewing: {
    id: "viewing",
    label: "Viewings Scheduled",
    icon: Eye,
    color: "text-blue-500 bg-blue-50",
  },
  offer: {
    id: "offer",
    label: "Offers Pending",
    icon: FileText,
    color: "text-amber-500 bg-amber-50",
  },
  closing: {
    id: "closing",
    label: "Ready to Close",
    icon: CheckCircle2,
    color: "text-emerald-500 bg-emerald-50",
  },
};

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
  inventoryAlerts: SellerInventoryAlert[];
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
  const res = await dashboardMetricsClient.getMetrics();
  if (!res.success) throw new Error(res.error);
  return res.data ?? {};
}

function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return "Unknown";
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
  });
}

function titleize(value?: string | null, fallback = "Unknown"): string {
  if (!value) {
    return fallback;
  }

  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapLeadStatus(status?: string): LeadData["status"] {
  switch ((status ?? "").toUpperCase()) {
    case "CONTACTED":
      return "contacted";
    case "PROPOSAL":
      return "proposal";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    default:
      return "new";
  }
}

function extractPortfolioImageUrl(
  images:
    | string
    | string[]
    | Array<{
        url?: string;
        asset?: { cdnUrl?: string; thumbnailUrl?: string };
      }>,
): string {
  if (Array.isArray(images)) {
    const first = images[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object") {
      if ("url" in first && typeof first.url === "string") return first.url;
      return (
        first.asset?.thumbnailUrl ?? first.asset?.cdnUrl ?? "/placeholder.svg"
      );
    }
  }

  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0];
      }
    } catch {
      return images || "/placeholder.svg";
    }

    return images || "/placeholder.svg";
  }

  return "/placeholder.svg";
}

async function fetchLeads(): Promise<LeadData[]> {
  const res = await leadsClient.getLeads({
    limit: 5,
    status: ["NEW", "CONTACTED"],
  });
  if (!res.success) throw new Error(res.error);

  const leads = res.data?.leads ?? [];
  return leads.map((lead) => {
    const normalizedBudget =
      lead.budget == null ? "" : String(lead.budget).trim();

    return {
      id: lead.id,
      name: lead.clientName,
      project: titleize(lead.projectType, "General Inquiry"),
      budget: normalizedBudget || "Budget TBD",
      location: lead.location?.trim() || "Location TBD",
      status: mapLeadStatus(lead.status),
      receivedAt: formatRelativeTime(lead.createdAt),
    };
  });
}

function mapDashboardProjectStatus(status?: string): ProjectData["status"] {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "ON_HOLD":
    case "CANCELLED":
      return "delayed";
    case "IN_PROGRESS":
      return "on_track";
    default:
      return "attention";
  }
}

function mapDashboardProjectProgress(status?: string): number {
  switch (status) {
    case "COMPLETED":
      return 100;
    case "IN_PROGRESS":
      return 60;
    case "PLANNING":
      return 20;
    case "ON_HOLD":
      return 40;
    case "CANCELLED":
      return 0;
    default:
      return 0;
  }
}

function normalizeProjectDueDate(
  endDate?: string | null,
  startDate?: string | null,
  createdAt?: string | null,
): string {
  const source = endDate ?? startDate ?? createdAt;
  if (!source) {
    return new Date().toISOString();
  }
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

export function normalizeProjectClientLabel(project: {
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}): string {
  const firstName = project.client?.firstName?.trim() ?? "";
  const lastName = project.client?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return project.client?.email?.trim() || "Client TBD";
}

async function fetchProjects(): Promise<ProjectData[]> {
  const res = await projectsClient.getProjects();
  if (!res.success) throw new Error(res.error);

  const projects = res.data?.items ?? [];

  return projects.map((project) => ({
    id: project.id,
    title: project.title ?? "Untitled project",
    client: normalizeProjectClientLabel(project),
    progress: mapDashboardProjectProgress(project.status ?? undefined),
    status: mapDashboardProjectStatus(project.status ?? undefined),
    dueDate: normalizeProjectDueDate(
      project.endDate,
      project.startDate,
      project.createdAt,
    ),
  }));
}

async function fetchStores(): Promise<StoreData[]> {
  const res = await storesClient.getMyStores();
  if (!res.success) throw new Error(res.error);
  return res.data ?? [];
}

async function fetchOrders(): Promise<OrderData[]> {
  const res = await ordersClient.getOrders({ limit: 5 });
  if (!res.success) throw new Error(res.error);
  return res.data?.items ?? [];
}

async function fetchProperties(): Promise<PropertyListingData[]> {
  const res = await propertiesClient.getMyProperties({ limit: 4 });
  if (!res.success) throw new Error(res.error);
  return (res.data?.properties ?? []) as PropertyListingData[];
}

async function fetchPropertyInquiries(): Promise<PropertyInquiryData[]> {
  const res = await inquiriesClient.getInquiries({ limit: 4 });
  if (!res.success) throw new Error(res.error);
  const inquiryPage = res.data;
  if (!inquiryPage) return [];

  return inquiryPage.data.map((inquiry: InquiryListItem) => ({
    id: inquiry.id,
    propertyTitle: inquiry.property.title,
    clientName: inquiry.clientName,
    clientPhone: inquiry.clientPhone ?? "",
    message: inquiry.message ?? "",
    status: inquiry.status.toLowerCase() as PropertyInquiryData["status"],
    createdAt: inquiry.createdAt,
  }));
}

async function fetchAgenda(): Promise<AgendaEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const res = await calendarClient.getEvents({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  if (!res.success) throw new Error(res.error);

  const events = res.data ?? [];
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    status: event.status,
  }));
}

async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const res = await portfolioClient.getPortfolios({ limit: 4 });
  if (!res.success) throw new Error(res.error);

  return (res.data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: extractPortfolioImageUrl(item.images),
    category: titleize(item.projectType, undefined),
  }));
}

async function fetchInventoryAlerts(): Promise<SellerInventoryAlert[]> {
  const res = await inventoryClient.getAlerts();
  if (!res.success) throw new Error(res.error);
  return res.data?.data ?? [];
}

async function fetchTopProducts(): Promise<TopProduct[]> {
  const res = await productsClient.getTopProducts({ limit: 5 });
  if (!res.success) throw new Error(res.error);
  return res.data ?? [];
}

async function fetchPipeline(): Promise<{
  stages: PipelineStage[];
  totalValue: number;
}> {
  const res = await pipelineClient.getPipelineSummary();
  if (!res.success) throw new Error(res.error);

  const summary = res.data;
  if (!summary) {
    return { stages: [], totalValue: 0 };
  }

  return {
    stages: summary.stages.map((stage) => ({
      ...(DASHBOARD_PIPELINE_STAGE_META[stage.id] ?? {
        id: stage.id,
        label: titleize(stage.id, "Pipeline"),
        icon: Eye,
        color: "text-zinc-500 bg-zinc-50",
      }),
      count: stage.count,
      value: stage.value,
    })),
    totalValue: summary.totalValue,
  };
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
