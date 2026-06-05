"use server";

import { safeAction } from "./shared";
import { AdminOperationName } from "@/lib/observability/operation-names";
import { financeService } from "@/lib/domains/finance/service";
import type {
  AnalyticsPeriod,
  GeoEntityType,
  TimeSeriesMetric,
  TopProfessionalMetric,
} from "@/lib/domains/finance/contracts";

// ============================================================================
// Actions
// ============================================================================

/**
 * Gets comprehensive platform analytics.
 * Requires VIEW_FINANCIALS capability (SUPER_ADMIN, FINANCE_MANAGER, AUDITOR).
 */
export async function getPlatformAnalytics() {
  return safeAction(AdminOperationName.GET_ANALYTICS, async ({ actor }) => {
    const result = await financeService.getPlatformAnalytics(actor);
    if (!result.ok) throw new Error(result.message ?? result.code);
    return result.data;
  });
}

/**
 * Gets time series data for a specific metric.
 * Requires VIEW_FINANCIALS capability.
 */
export async function getMetricTimeSeries(
  metric: TimeSeriesMetric,
  period: AnalyticsPeriod = "30d",
) {
  return safeAction(
    AdminOperationName.GET_METRIC_TIMESERIES,
    async ({ actor }) => {
      const result = await financeService.getMetricTimeSeries(
        actor,
        metric,
        period,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);
      return result.data;
    },
  );
}

/**
 * Gets geographic distribution of users/professionals/stores/properties.
 * Requires VIEW_FINANCIALS capability.
 */
export async function getGeographicDistribution(entityType: GeoEntityType) {
  return safeAction(
    AdminOperationName.GET_GEO_DISTRIBUTION,
    async ({ actor }) => {
      const result = await financeService.getGeoDistribution(actor, entityType);
      if (!result.ok) throw new Error(result.message ?? result.code);
      return result.data;
    },
  );
}

/**
 * Gets top performing professionals by a metric.
 * Requires VIEW_FINANCIALS capability.
 */
export async function getTopProfessionals(
  metric: TopProfessionalMetric,
  limit = 10,
) {
  return safeAction(
    AdminOperationName.GET_TOP_PROFESSIONALS,
    async ({ actor }) => {
      const result = await financeService.getTopProfessionals(
        actor,
        metric,
        limit,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);
      return result.data;
    },
  );
}
