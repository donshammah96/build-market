"use server";

import { headers } from "next/headers";
import { auditService } from "@/lib/domains/audit/service";
import type { AdminActor } from "@/lib/security/admin-actor";
import type { SafeActionOptions } from "./safe-action";
import { getHighRiskAdminAction } from "@/lib/security/high-risk-admin-registry";

export async function recordDeclarativeAudit(
  actor: AdminActor,
  auditLog: SafeActionOptions["auditLog"],
  data: unknown,
  outcome:
    | "success"
    | "domain_error"
    | "internal_error"
    | "unauthorized"
    | "forbidden"
    | "rate_limited"
    | "session_stale",
  correlationId: string,
  errorMessage?: string,
) {
  if (!auditLog) {
    return;
  }

  const targetId = auditLog.getTargetId?.({ actor, data }) ?? actor.dbUserId;
  const details = auditLog.getDetails?.({ actor, data });
  const reason = auditLog.getReason?.({ actor, data }) ?? errorMessage;

  let ipAddress: string | undefined;
  let userAgent: string | undefined;
  try {
    const headersList = await headers();
    ipAddress =
      headersList.get("x-forwarded-for") ??
      headersList.get("x-real-ip") ??
      undefined;
    userAgent = headersList.get("user-agent") ?? undefined;
  } catch {
    // Ignore context failure in test suite.
  }

  const mergedDetails = {
    ...(details ?? {}),
    ...(errorMessage ? { errorMessage } : {}),
  };

  const isHighRisk = getHighRiskAdminAction(auditLog.operation) !== undefined;

  try {
    await auditService.recordAdminAuditEvent({
      actor,
      operationName: auditLog.operation,
      correlationId,
      targetResourceType: auditLog.resourceType ?? "admin_action",
      targetResourceId: targetId,
      outcome,
      details:
        Object.keys(mergedDetails).length > 0 ? mergedDetails : undefined,
      reason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    if (isHighRisk) {
      throw new Error(
        `Audit logging failed for high-risk operation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
