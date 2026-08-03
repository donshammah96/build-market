import type { AdminRole } from "@build/enums";

// ============================================================================
// Actor
// ============================================================================

export type FinanceActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// Finance Overview (existing)
// ============================================================================

export type FinancePeriod = "7d" | "30d" | "90d" | "1y" | "all";

export type FinanceOverviewInput = Partial<{
  period: FinancePeriod;
}>;

export type FinanceOverviewQuery = {
  period: FinancePeriod;
  range?: {
    start: Date;
    end: Date;
  };
};

export type FinanceOverview = {
  period: FinancePeriod;
  revenue: {
    total: number;
    inPeriod: number;
  };
  orders: {
    paidOrDelivered: number;
    averageValue: number;
  };
  payouts: {
    pending: number;
  };
};

// ============================================================================
// Analytics types (new)
// ============================================================================

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "1y";

export type AnalyticsInput = Partial<{
  period: AnalyticsPeriod;
}>;

export type PlatformAnalyticsResult = {
  overview: {
    totalUsers: number;
    totalProfessionals: number;
    verifiedProfessionals: number;
    totalStores: number;
    totalProperties: number;
    totalProjects: number;
    totalLeads: number;
    totalOrders: number;
  };
  growth: {
    usersThisMonth: number;
    usersLastMonth: number;
    userGrowthRate: number;
    professionalsThisMonth: number;
    professionalsLastMonth: number;
    professionalGrowthRate: number;
    leadsThisMonth: number;
    leadsLastMonth: number;
    leadGrowthRate: number;
  };
  revenue: {
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueGrowthRate: number;
    avgOrderValue: number;
    pendingPayouts: number;
  };
  engagement: {
    activeUsersToday: number;
    activeUsersThisWeek: number;
    /** Placeholder — sourced from external analytics service in production. */
    avgSessionDuration: number;
    /** Placeholder — sourced from external analytics service in production. */
    bounceRate: number;
  };
  verification: {
    pendingProfessionals: number;
    pendingStores: number;
    pendingProperties: number;
    /** Placeholder — calculated from audit logs in production. */
    avgVerificationTime: number;
  };
};

export type TimeSeriesMetric =
  "users" | "professionals" | "leads" | "orders" | "revenue";

export type TimeSeriesEntry = {
  date: string;
  value: number;
  label?: string;
};

export type GeoEntityType = "users" | "professionals" | "stores" | "properties";

export type GeoDistributionEntry = {
  county: string;
  count: number;
};

export type TopProfessionalMetric =
  "leads" | "reviews" | "revenue" | "projects";

export type TopProfessionalEntry = {
  userId: string;
  companyName: string;
  verified: boolean;
  value: number;
};

// ============================================================================
// Error types
// ============================================================================

export type FinanceDomainErrorCode =
  | "FINANCE_INVALID_FILTER"
  | "FINANCE_POLICY_DENIED"
  | "FINANCE_ANALYTICS_POLICY_DENIED"
  | "FINANCE_ANALYTICS_INVALID_PERIOD";

export type FinanceDomainError = {
  code: FinanceDomainErrorCode;
  message: string;
};
