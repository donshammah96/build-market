import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ComplianceQueueFilters,
  ComplianceQueueResult,
  GdprActor,
  GdprDomainError,
  LogAdminActionInput,
} from "./contracts";
import { gdprRepository } from "./repository";

function requireExportData(actor: GdprActor): Result<true, GdprDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.EXPORT_DATA);
  if (!policy.ok) {
    return err({
      code: "GDPR_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

export const gdprService = {
  /**
   * Fetches GDPR compliance audit logs with optional filtering.
   * Requires EXPORT_DATA capability (SUPER_ADMIN, DATA_PRIVACY_OFFICER, AUDITOR).
   */
  async getComplianceQueue(
    actor: GdprActor,
    filters: ComplianceQueueFilters = {},
  ): Promise<Result<ComplianceQueueResult, GdprDomainError>> {
    const policy = requireExportData(actor);
    if (!policy.ok) return policy;

    try {
      const logs = await gdprRepository.findAuditLogs(filters);
      return ok(logs);
    } catch {
      return err({
        code: "GDPR_FETCH_FAILED",
        message: "Failed to fetch compliance audit logs",
      });
    }
  },

  /**
   * Records an admin data-access event in the compliance audit trail.
   * Non-blocking — audit write failures are surfaced as errors but do not
   * prevent the triggering operation from completing (ADR-ADMIN-008).
   */
  async logAdminDataAccess(
    actor: GdprActor,
    input: LogAdminActionInput,
  ): Promise<Result<void, GdprDomainError>> {
    try {
      await gdprRepository.logAdminAction(
        actor.dbUserId,
        input.action,
        input.entityType,
        input.entityId,
        input.details,
      );
      return ok(undefined);
    } catch {
      return err({
        code: "GDPR_AUDIT_WRITE_FAILED",
        message: "Failed to write compliance audit entry",
      });
    }
  },
};
