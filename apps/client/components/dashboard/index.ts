/**
 * Dashboard Components
 *
 * Central export for all dashboard-related components.
 */

// Layout components
export { DashboardHeader } from "./DashboardHeader";
export type { DashboardHeaderProps } from "./DashboardHeader";

export { MetricsRow } from "./MetricsRow";
export type { MetricsRowProps } from "./MetricsRow";

export { WidgetRenderer } from "./widget-registry";
export type { WidgetRendererProps } from "./widget-registry";

// All widgets
export * from "./widgets";
