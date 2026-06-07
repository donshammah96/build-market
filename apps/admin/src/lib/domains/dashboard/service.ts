import { AdminRole } from "@build/db";
import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  DashboardActor,
  DashboardDomainError,
  DashboardStats,
} from "./contracts";
import { dashboardRepository } from "./repository";

function requireViewStats(
  actor: DashboardActor,
): Result<true, DashboardDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_FINANCIALS);
  if (!policy.ok && actor.adminRole !== AdminRole.SUPPORT_AGENT) {
    return err({
      code: "DASHBOARD_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

export const dashboardService = {
  /**
   * Fetches platform-wide statistics for the admin dashboard.
   * Requires VIEW_FINANCIALS capability (SUPER_ADMIN, FINANCE_MANAGER, SUPPORT_AGENT).
   */
  async getDashboardStats(
    actor: DashboardActor,
  ): Promise<Result<DashboardStats, DashboardDomainError>> {
    const policy = requireViewStats(actor);
    if (!policy.ok) return policy;

    try {
      const stats = await dashboardRepository.getDashboardStats();
      return ok(stats);
    } catch {
      return err({
        code: "DASHBOARD_FETCH_FAILED",
        message: "Failed to fetch dashboard statistics",
      });
    }
  },
};
