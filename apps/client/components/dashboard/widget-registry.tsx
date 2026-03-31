"use client";

import { memo } from "react";
import type {
  WidgetId,
  LeadData,
  OrderData,
  PropertyInquiryData,
} from "@/lib/dashboard";
import { envConfig } from "@/lib/env";
import type { DashboardData } from "@/hooks/useDashboardData";
import {
  ProfileStrengthWidget,
  AgendaWidget,
  LeadsWidget,
  ProjectsWidget,
  PortfolioWidget,
  StoreOverviewWidget,
  OrdersWidget,
  ProductsWidget,
  InventoryAlertsWidget,
  ListingsWidget,
  InquiriesWidget,
  PipelineWidget,
} from "./widgets";

// ============================================================================
// SAFE ARRAY HELPER
// ============================================================================

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

// ============================================================================
// WIDGET REGISTRY
// ============================================================================

export type WidgetRendererFn = (data: DashboardData) => React.ReactNode;

const WIDGET_REGISTRY: Record<WidgetId, WidgetRendererFn> = {
  profile_strength: () => <ProfileStrengthWidget />,

  agenda: (data) => (
    <AgendaWidget
      events={safeArray<{
        id: string;
        title: string;
        startDate: string;
        status: string;
      }>(data.agenda)}
    />
  ),

  leads: (data) => {
    const leads = safeArray<LeadData>(data.leads);
    return (
      <LeadsWidget
        leads={leads}
        newLeadsCount={leads.filter((l) => l.status === "new").length}
      />
    );
  },

  projects: (data) => <ProjectsWidget projects={safeArray(data.projects)} />,

  portfolio: (data) => <PortfolioWidget items={safeArray(data.portfolio)} />,

  store_overview: (data) => (
    <StoreOverviewWidget store={data.primaryStore ?? undefined} />
  ),

  orders: (data) => {
    const orders = safeArray<OrderData>(data.orders);
    return (
      <OrdersWidget
        orders={orders}
        pendingCount={orders.filter((o) => o.status === "pending").length}
      />
    );
  },

  products: (data) => <ProductsWidget products={safeArray(data.topProducts)} />,

  inventory_alerts: (data) => (
    <InventoryAlertsWidget alerts={safeArray(data.inventoryAlerts)} />
  ),

  property_listings: (data) => (
    <ListingsWidget properties={safeArray(data.properties)} />
  ),

  property_inquiries: (data) => {
    const inquiries = safeArray<PropertyInquiryData>(data.propertyInquiries);
    return (
      <InquiriesWidget
        inquiries={inquiries}
        newCount={inquiries.filter((i) => i.status === "new").length}
      />
    );
  },

  sales_pipeline: (data) => (
    <PipelineWidget
      stages={data.pipeline?.stages ?? []}
      totalValue={data.pipeline?.totalValue ?? 0}
    />
  ),

  development_projects: (data) => (
    <ProjectsWidget projects={safeArray(data.projects)} />
  ),
};

// ============================================================================
// WIDGET RENDERER
// ============================================================================

export interface WidgetRendererProps {
  widgetId: WidgetId;
  data: DashboardData;
}

function WidgetRendererComponent({ widgetId, data }: WidgetRendererProps) {
  const render = WIDGET_REGISTRY[widgetId];
  if (!render) {
    if (envConfig.isDev) {
      console.warn(`[Dashboard] Unknown widget ID: ${widgetId}`);
    }
    return null;
  }
  return <>{render(data)}</>;
}

export const WidgetRenderer = memo(WidgetRendererComponent);
