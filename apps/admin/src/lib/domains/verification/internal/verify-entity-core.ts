/**
 * Verification Entity Core
 * Shared implementation pipeline (fetch -> validate -> transaction -> audit -> log -> return)
 * for entity verification operations (professional, store, property).
 */

import { prisma, type Prisma, type VerificationStatus } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import { omitUndefined } from "@/lib/utils";
import { createAuditLog } from "./audit-service";
import {
  mapActionToStatus,
  validateTransition,
  type EntityType,
  type VerificationRequest,
  type VerificationResult,
} from "./types";

export interface NormalizedEntity {
  currentStatus: VerificationStatus;
  displayName: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface VerifyEntityAdapterData {
  verificationStatus: VerificationStatus;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedById: string | null;
  notes?: string | undefined;
  rejectionReason?: string | null | undefined;
}

export interface VerifyEntityAdapter {
  entityType: EntityType;
  entityTypeLabel: string;
  notFoundMessage: string;
  auditActionSuffix: string;
  auditPrismaEntityType: string;
  loggerName: string;
  fetchEntity(entityId: string): Promise<NormalizedEntity | null>;
  updateEntity(
    tx: Prisma.TransactionClient,
    entityId: string,
    data: VerifyEntityAdapterData,
  ): Promise<{ verifiedAt?: Date | null | undefined }>;
}

export async function verifyEntityCore(
  request: VerificationRequest,
  adapter: VerifyEntityAdapter,
): Promise<VerificationResult> {
  const { entityId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;
  const logger = new StructuredLogger(adapter.loggerName);

  const entity = await adapter.fetchEntity(entityId);
  if (!entity) {
    throw new Error(adapter.notFoundMessage);
  }

  const currentStatus = entity.currentStatus;
  const newStatus = mapActionToStatus(action);

  // Validate state transition
  const validation = validateTransition(currentStatus, action, reason);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Update entity status and write audit log inside a transaction to guarantee atomicity
  const updated = await prisma.$transaction(async (tx) => {
    const res = await adapter.updateEntity(tx, entityId, {
      verificationStatus: newStatus,
      verified: newStatus === "VERIFIED",
      verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
      verifiedById: newStatus === "VERIFIED" ? adminId : null,
      ...(notes !== undefined ? { notes } : {}),
      rejectionReason: action === "REJECT" ? (reason ?? null) : null,
    });

    // Create audit log using transaction client
    await createAuditLog(
      {
        adminId,
        action: `${action}_${adapter.auditActionSuffix}`,
        entityType: adapter.auditPrismaEntityType,
        entityId,
        oldStatus: currentStatus,
        newStatus,
        reason: notes || reason,
        metadata: entity.metadata,
        ipAddress,
        userAgent,
      },
      tx,
    );

    return res;
  });

  logger.info(`${adapter.entityTypeLabel} verification completed`, {
    [`${adapter.entityType}Id`]: entityId,
    action,
    previousStatus: currentStatus,
    newStatus,
    adminId,
  });

  return {
    success: true,
    entityType: adapter.entityType,
    entityId,
    previousStatus: currentStatus,
    newStatus,
    message: `${adapter.entityTypeLabel} "${entity.displayName}" has been ${action.toLowerCase()}ed`,
    ...omitUndefined({
      verifiedAt: updated.verifiedAt ?? undefined,
      reason: action === "REJECT" ? reason : undefined,
      notes,
    }),
  };
}
