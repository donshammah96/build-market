/**
 * Project domain operations service.
 *
 * Encapsulates business logic for project sub-resources:
 * - Ownership verification (project, milestone, asset)
 * - State machine guards for milestone and escrow transitions
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
import { getClientLogger } from "@/lib/api/resilient-api";

const logger = getClientLogger();

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
    logger.warn("Invalid escrow transition attempted", {
      correlationId: context.correlationId,
      escrowId,
      currentStatus: escrow.status,
      attemptedStatus: newStatus,
    });
    return {
      success: false,
      error: "invalid_transition",
      message: `Cannot transition from ${escrow.status} to ${newStatus}`,
    };
  }

  // Build update data based on the target status
  // eslint-disable-next-line /typescript-eslint/no-explicit-any
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
