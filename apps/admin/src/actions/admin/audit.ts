"use server";

import { safeAction } from "@/_core/safe-action";
import { auditService } from "@/lib/domains/audit/service";
import type { AuditLogInput } from "@/lib/domains/audit/contracts";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";

/**
 * Fetches a paginated, filtered list of audit log entries.
 * Capability: VIEW_FINANCIALS (SUPER_ADMIN, FINANCE_MANAGER, AUDITOR).
 */
export async function getAuditLogs(filters: AuditLogInput = {}) {
  return safeAction(AdminOperationName.QUERY_AUDIT_LOG, async ({ actor }) => {
    const result = await auditService.listAuditLogPage(
      {
        dbUserId: actor.dbUserId,
        clerkId: actor.clerkId,
        adminRole: actor.adminRole,
      },
      filters,
    );

    if (!result.ok) {
      throw new Error(result.message ?? "Audit log query failed");
    }

    return result.data;
  });
}

/**
 * Returns audit log statistics for the dashboard.
 * Capability: VIEW_FINANCIALS.
 */
export async function getAuditLogStats() {
  return safeAction(AdminOperationName.GET_AUDIT_STATS, async ({ actor }) => {
    const result = await auditService.getAuditLogStats({
      dbUserId: actor.dbUserId,
      clerkId: actor.clerkId,
      adminRole: actor.adminRole,
    });

    if (!result.ok) {
      throw new Error(result.message ?? "Audit stats query failed");
    }

    return result.data;
  });
}

/**
 * Returns distinct action strings for filter dropdown population.
 * Capability: VIEW_FINANCIALS.
 */
export async function getAuditLogActions() {
  return safeAction(AdminOperationName.GET_AUDIT_ACTIONS, async ({ actor }) => {
    const result = await auditService.getDistinctActions({
      dbUserId: actor.dbUserId,
      clerkId: actor.clerkId,
      adminRole: actor.adminRole,
    });

    if (!result.ok) {
      throw new Error(result.message ?? "Audit actions query failed");
    }

    return result.data;
  });
}

/**
 * Exports audit logs as a structured payload (max 5000 rows).
 * Capability: EXPORT_DATA (Tier 1) — requires recentAuth within 300 s.
 * Declarative audit entry is emitted by safeAction on success.
 */
export async function exportAuditLogs(filters: AuditLogInput = {}) {
  return safeAction(
    AdminOperationName.EXPORT_AUDIT_LOG,
    async ({ actor }) => {
      const result = await auditService.exportAuditLogs(
        {
          dbUserId: actor.dbUserId,
          clerkId: actor.clerkId,
          adminRole: actor.adminRole,
        },
        filters,
      );

      if (!result.ok) {
        throw new Error(result.message ?? "Audit export failed");
      }

      return result.data;
    },
    {
      recentAuth: { maxAgeSeconds: 300 }, // Tier 2 — export is high-sensitivity
      auditLog: {
        operation: AdminOperationName.EXPORT_AUDIT_LOG,
        resourceType: "audit_log",
        getTargetId: ({ actor }) => actor.dbUserId,
        getDetails: () => ({
          filters: JSON.stringify(filters),
        }),
      },
    },
  );
}
