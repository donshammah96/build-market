/**
 * Project domain operations.
 *
 * Encapsulates business logic for project sub-resources:
 * - Ownership verification (project, milestone, asset)
 * - State machine guards for milestone and escrow transitions
 * - Optimistic locking for Project and ProjectMilestone (If-Match)
 *
 * Route handlers become thin HTTP adapters that delegate here.
 */
import { prisma } from "@build/db";
import {
  Prisma,
  MilestoneStatus,
  ApprovalStatus,
  EscrowStatus,
} from "@prisma/client";
import {
  projectDetailSelect,
  milestoneDetailSelect,
} from "@/validation/projects-validation";
import type {
  UpdateProjectInput,
  UpdateMilestoneInput,
} from "@/validation/projects-validation";

// ─── Types ───────────────────────────────────────────────────────────

export type ProjectOperationContext = {
  correlationId: string;
  userId: string;
  projectId: string;
  ipAddress?: string;
  userAgent?: string;
  idempotencyKey?: string;
};

export type ProjectOperationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error:
        | "not_found"
        | "forbidden"
        | "invalid_transition"
        | "limit_exceeded";
      message?: string;
    };

export type OptimisticLockResult<T> =
  | { success: true; data: T; newVersion: number }
  | { success: false; error: "conflict" | "not_found" | "forbidden" };

// ─── Ownership Verification ─────────────────────────────────────────

/**
 * Verify that a user is the professional owner of a project (soft-delete aware).
 * Also returns the clientId for dual-party endpoints (e.g. milestone approval).
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<
  ProjectOperationResult<{
    id: string;
    professionalId: string | null;
    clientId: string;
    title: string;
  }>
> {
  const project = await tx.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      professionalId: true,
      clientId: true,
      title: true,
    },
  });

  if (!project) {
    return { success: false, error: "not_found", message: "Project not found" };
  }

  if (project.professionalId !== userId) {
    return {
      success: false,
      error: "forbidden",
      message: "You do not have permission to access this project",
    };
  }

  return { success: true, data: project };
}

/**
 * Verify that a user is a participant (professional OR client) of a project.
 * Used for endpoints accessible to both parties (e.g. milestone approval by client).
 */
export async function verifyProjectParticipant(
  projectId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<
  ProjectOperationResult<{
    id: string;
    professionalId: string | null;
    clientId: string;
    title: string;
    role: "professional" | "client";
  }>
> {
  const project = await tx.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      professionalId: true,
      clientId: true,
      title: true,
    },
  });

  if (!project) {
    return { success: false, error: "not_found", message: "Project not found" };
  }

  if (project.professionalId === userId) {
    return { success: true, data: { ...project, role: "professional" } };
  }

  if (project.clientId === userId) {
    return { success: true, data: { ...project, role: "client" } };
  }

  return {
    success: false,
    error: "forbidden",
    message: "You are not a participant of this project",
  };
}

/**
 * Verify milestone exists and belongs to the given project.
 */
export async function verifyMilestoneOwnership(
  milestoneId: string,
  projectId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<
  ProjectOperationResult<{
    id: string;
    projectId: string;
    status: MilestoneStatus;
    approvalStatus: ApprovalStatus;
    escrowId: string | null;
  }>
> {
  const milestone = await tx.projectMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      id: true,
      projectId: true,
      status: true,
      approvalStatus: true,
      escrowId: true,
    },
  });

  if (!milestone || milestone.projectId !== projectId) {
    return {
      success: false,
      error: "not_found",
      message: "Milestone not found in this project",
    };
  }

  return { success: true, data: milestone };
}

/**
 * Verify that an asset exists and is owned by the user.
 */
export async function verifyAssetOwnership(
  assetId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<ProjectOperationResult<{ id: string; uploaderId: string }>> {
  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: { id: true, uploaderId: true },
  });

  if (!asset) {
    return { success: false, error: "not_found", message: "Asset not found" };
  }

  if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
    return {
      success: false,
      error: "forbidden",
      message: "Unauthorized access to asset",
    };
  }

  return { success: true, data: asset };
}

// ─── State Machine: Milestone Status ────────────────────────────────

const VALID_MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> =
  {
    [MilestoneStatus.PENDING]: [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.DELAYED,
    ],
    [MilestoneStatus.IN_PROGRESS]: [
      MilestoneStatus.IN_REVIEW,
      MilestoneStatus.DELAYED,
    ],
    [MilestoneStatus.IN_REVIEW]: [
      MilestoneStatus.COMPLETED,
      MilestoneStatus.DELAYED,
      MilestoneStatus.IN_PROGRESS, // Rejected back
    ],
    [MilestoneStatus.COMPLETED]: [],
    [MilestoneStatus.DELAYED]: [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.PENDING,
    ],
  };

/**
 * Check if a milestone status transition is valid.
 */
export function isValidMilestoneTransition(
  current: MilestoneStatus,
  next: MilestoneStatus,
): boolean {
  return VALID_MILESTONE_TRANSITIONS[current]?.includes(next) ?? false;
}

// ─── State Machine: Approval Status ─────────────────────────────────

const VALID_APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  [ApprovalStatus.PENDING]: [
    ApprovalStatus.APPROVED,
    ApprovalStatus.REJECTED,
    ApprovalStatus.REQUESTED_CHANGE,
  ],
  [ApprovalStatus.APPROVED]: [],
  [ApprovalStatus.REJECTED]: [ApprovalStatus.PENDING],
  [ApprovalStatus.REQUESTED_CHANGE]: [ApprovalStatus.PENDING],
};

/**
 * Check if an approval status transition is valid.
 */
export function isValidApprovalTransition(
  current: ApprovalStatus,
  next: ApprovalStatus,
): boolean {
  return VALID_APPROVAL_TRANSITIONS[current]?.includes(next) ?? false;
}

// ─── State Machine: Escrow Status ───────────────────────────────────

const VALID_ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  [EscrowStatus.PENDING_FUNDING]: [EscrowStatus.FUNDS_HELD],
  [EscrowStatus.FUNDS_HELD]: [EscrowStatus.RELEASED, EscrowStatus.DISPUTED],
  [EscrowStatus.RELEASED]: [],
  [EscrowStatus.DISPUTED]: [EscrowStatus.REFUNDED, EscrowStatus.RELEASED],
  [EscrowStatus.REFUNDED]: [],
};

/**
 * Check if an escrow status transition is valid.
 */
export function isValidEscrowTransition(
  current: EscrowStatus,
  next: EscrowStatus,
): boolean {
  return VALID_ESCROW_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Transition escrow status with validation, ledger entry creation,
 * and metadata updates.
 */
export async function transitionEscrowStatus(
  escrowId: string,
  newStatus: EscrowStatus,
  context: {
    correlationId: string;
    userId: string;
    reason?: string;
    referenceCode?: string;
    releasedToId?: string;
    platformFee?: number;
    vatAmount?: number;
    withholdingTax?: number;
  },
  tx: Prisma.TransactionClient = prisma,
): Promise<ProjectOperationResult<{ id: string; status: EscrowStatus }>> {
  const escrow = await tx.escrowTransaction.findUnique({
    where: { id: escrowId },
    select: { id: true, status: true, amount: true, milestoneId: true },
  });

  if (!escrow) {
    return {
      success: false,
      error: "not_found",
      message: "Escrow transaction not found",
    };
  }

  if (!isValidEscrowTransition(escrow.status, newStatus)) {
    console.warn(
      "Invalid escrow transition attempted",
      JSON.stringify({
        correlationId: context.correlationId,
        escrowId,
        currentStatus: escrow.status,
        attemptedStatus: newStatus,
      }),
    );
    return {
      success: false,
      error: "invalid_transition",
      message: `Cannot transition from ${escrow.status} to ${newStatus}`,
    };
  }

  // Build update data based on the target status
  const updateData: Record<string, any> = { status: newStatus };

  if (newStatus === EscrowStatus.FUNDS_HELD) {
    updateData.fundedAt = new Date();
    if (context.referenceCode) updateData.fundingRef = context.referenceCode;
  } else if (newStatus === EscrowStatus.RELEASED) {
    updateData.releasedAt = new Date();
    if (context.releasedToId) updateData.releasedToId = context.releasedToId;
    if (context.referenceCode) updateData.releaseRef = context.referenceCode;
  } else if (newStatus === EscrowStatus.DISPUTED) {
    updateData.disputedAt = new Date();
    if (context.reason) updateData.disputeReason = context.reason;
  } else if (newStatus === EscrowStatus.REFUNDED) {
    updateData.resolvedAt = new Date();
  }

  const updated = await tx.escrowTransaction.update({
    where: { id: escrowId },
    data: updateData,
    select: { id: true, status: true },
  });

  return { success: true, data: updated };
}

// ─── Optimistic Locking: Project ────────────────────────────────────

/**
 * Update a project with optimistic locking.
 * Verifies ownership, checks version, applies update, increments version.
 */
export async function updateProjectWithOptimisticLock(
  projectId: string,
  userId: string,
  updateData: UpdateProjectInput,
  context: ProjectOperationContext,
  expectedVersion: number,
): Promise<OptimisticLockResult<{ project: unknown; newVersion: number }>> {
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId, deletedAt: null },
        select: { id: true, professionalId: true, title: true, version: true },
      });

      if (!project) return { success: false, error: "not_found" };
      if (project.professionalId !== userId)
        return { success: false, error: "forbidden" };
      if ((project.version ?? 0) !== expectedVersion)
        return { success: false, error: "conflict" };

      const newVersion = expectedVersion + 1;
      const payload: Prisma.ProjectUpdateInput = {
        ...updateData,
        startDate: updateData.startDate
          ? new Date(updateData.startDate)
          : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
        version: { increment: 1 },
      };

      const updated = await tx.project.update({
        where: { id: projectId, version: expectedVersion },
        data: payload,
        select: projectDetailSelect,
      });

      return {
        success: true,
        data: { project: updated, newVersion },
        newVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}

/**
 * Soft-delete a project with optimistic locking.
 */
export async function deleteProjectWithOptimisticLock(
  projectId: string,
  userId: string,
  context: ProjectOperationContext,
  expectedVersion: number,
): Promise<
  OptimisticLockResult<{
    projectId: string;
    projectTitle: string;
    newVersion: number;
  }>
> {
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId, deletedAt: null },
        select: { id: true, professionalId: true, title: true, version: true },
      });

      if (!project) return { success: false, error: "not_found" };
      if (project.professionalId !== userId)
        return { success: false, error: "forbidden" };
      if ((project.version ?? 0) !== expectedVersion)
        return { success: false, error: "conflict" };

      const newVersion = expectedVersion + 1;
      await tx.project.update({
        where: { id: projectId, version: expectedVersion },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });

      return {
        success: true,
        data: {
          projectId,
          projectTitle: project.title,
          newVersion,
        },
        newVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

/**
 * Build 409 Conflict response with current version header.
 * @deprecated Implementation moved to @/app/lib/api/conflict-response.
 */
export { buildProjectConflictResponse } from "@/app/lib/api/conflict-response";

// ─── Optimistic Locking: Milestone ───────────────────────────────────

/**
 * Update a milestone with optimistic locking.
 * Verifies ownership, checks version, validates status transition, applies update.
 */
export async function updateMilestoneWithOptimisticLock(
  milestoneId: string,
  projectId: string,
  userId: string,
  updateData: UpdateMilestoneInput,
  context: ProjectOperationContext,
  expectedVersion: number,
): Promise<OptimisticLockResult<{ milestone: unknown; newVersion: number }>> {
  return prisma.$transaction(
    async (tx) => {
      const ownership = await verifyProjectOwnership(projectId, userId, tx);
      if (!ownership.success) {
        return {
          success: false,
          error: ownership.error === "not_found" ? "not_found" : "forbidden",
        };
      }

      const milestone = await tx.projectMilestone.findUnique({
        where: { id: milestoneId, projectId },
        select: { id: true, status: true, version: true },
      });

      if (!milestone) return { success: false, error: "not_found" };
      if ((milestone.version ?? 1) !== expectedVersion)
        return { success: false, error: "conflict" };

      if (
        updateData.status &&
        updateData.status !== milestone.status &&
        !isValidMilestoneTransition(milestone.status, updateData.status)
      ) {
        return { success: false, error: "forbidden" };
      }

      const newVersion = expectedVersion + 1;
      const payload: Prisma.ProjectMilestoneUpdateInput = {
        ...updateData,
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
        completedAt:
          updateData.status === MilestoneStatus.COMPLETED
            ? new Date()
            : undefined,
        version: { increment: 1 },
      };

      const updated = await tx.projectMilestone.update({
        where: { id: milestoneId, version: expectedVersion },
        data: payload,
        select: milestoneDetailSelect,
      });

      return {
        success: true,
        data: { milestone: updated, newVersion },
        newVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

/**
 * Delete a milestone with optimistic locking.
 * Cannot delete if escrow is linked.
 */
export async function deleteMilestoneWithOptimisticLock(
  milestoneId: string,
  projectId: string,
  userId: string,
  context: ProjectOperationContext,
  expectedVersion: number,
): Promise<
  OptimisticLockResult<{
    milestoneId: string;
    newVersion: number;
  }>
> {
  return prisma.$transaction(
    async (tx) => {
      const ownership = await verifyProjectOwnership(projectId, userId, tx);
      if (!ownership.success) {
        return {
          success: false,
          error: ownership.error === "not_found" ? "not_found" : "forbidden",
        };
      }

      const milestone = await tx.projectMilestone.findUnique({
        where: { id: milestoneId, projectId },
        select: { id: true, escrowId: true, version: true },
      });

      if (!milestone) return { success: false, error: "not_found" };
      if (milestone.escrowId) return { success: false, error: "forbidden" }; // escrow_linked - treat as forbidden for this API
      if ((milestone.version ?? 1) !== expectedVersion)
        return { success: false, error: "conflict" };

      const newVersion = expectedVersion + 1;
      await tx.projectMilestone.delete({
        where: { id: milestoneId },
      });

      return {
        success: true,
        data: { milestoneId, newVersion },
        newVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

/**
 * Check if client requests optimistic lock retries (x-optimistic-retry: true).
 */
export function isOptimisticRetryEnabled(req: {
  headers: { get(name: string): string | null };
}): boolean {
  const headerValue = req.headers.get("x-optimistic-retry");
  return headerValue === "true" || headerValue === "1";
}

/**
 * Build 409 Conflict response for milestone.
 * @deprecated Implementation moved to @/app/lib/api/conflict-response.
 */
export { buildMilestoneConflictResponse } from "@/app/lib/api/conflict-response";
