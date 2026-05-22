import type { AdminRole } from "@build/db";

// ============================================================================
// Actor
// ============================================================================

export type DashboardActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// DTOs
// ============================================================================

export type DashboardStats = {
  userCount: number;
  professionalCount: number;
  verifiedProfessionalCount: number;
  activeProjectCount: number;
};

// ============================================================================
// Domain Errors
// ============================================================================

export type DashboardDomainError = {
  code: "DASHBOARD_POLICY_DENIED" | "DASHBOARD_FETCH_FAILED";
  message: string;
};
