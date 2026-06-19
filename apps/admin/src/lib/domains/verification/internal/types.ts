/**
 * Verification Service Types
 * Type definitions for the admin verification system
 */

import { VerificationStatus } from "@build/db";

export type EntityType =
  | "professional"
  | "store"
  | "property"
  | "certificate"
  | "license";

export type VerificationAction =
  | "VERIFY"
  | "REJECT"
  | "REQUEST_CORRECTION"
  | "SUBMIT"
  | "RESUBMIT";

export interface VerificationRequest {
  entityType: EntityType;
  entityId: string;
  action: VerificationAction;
  notes?: string | undefined;
  reason?: string | undefined;
  adminId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface VerificationResult {
  success: boolean;
  entityType: EntityType;
  entityId: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  verifiedAt?: Date | undefined;
  message: string;
  /** Rejection reason or correction notes from admin */
  reason?: string | undefined;
  /** Additional admin notes */
  notes?: string | undefined;
}

export interface VerificationValidation {
  isValid: boolean;
  errors: string[];
}

export interface StatusTransition {
  from: VerificationStatus;
  to: VerificationStatus;
  action: VerificationAction;
  requiresReason: boolean;
}

// Valid status transitions using Finite State Machine pattern
export const VALID_TRANSITIONS: StatusTransition[] = [
  // ============================================================================
  // USER ACTIONS (SUBMIT/RESUBMIT) - Initial submission or resubmission by user
  // ============================================================================

  // From NEEDS_CORRECTION - User resubmits after making corrections
  {
    from: "NEEDS_CORRECTION",
    to: "PENDING",
    action: "RESUBMIT",
    requiresReason: false,
  },

  // From REJECTED - User resubmits after rejection (appeals process)
  {
    from: "REJECTED",
    to: "PENDING",
    action: "RESUBMIT",
    requiresReason: false,
  },

  // ============================================================================
  // ADMIN ACTIONS (VERIFY/REJECT/REQUEST_CORRECTION)
  // ============================================================================

  // From PENDING - Admin reviews and takes action
  {
    from: "PENDING",
    to: "VERIFIED",
    action: "VERIFY",
    requiresReason: false,
  },
  {
    from: "PENDING",
    to: "REJECTED",
    action: "REJECT",
    requiresReason: true,
  },
  {
    from: "PENDING",
    to: "NEEDS_CORRECTION",
    action: "REQUEST_CORRECTION",
    requiresReason: true,
  },

  // From NEEDS_CORRECTION - Admin can still verify/reject while user is making corrections
  {
    from: "NEEDS_CORRECTION",
    to: "VERIFIED",
    action: "VERIFY",
    requiresReason: false,
  },
  {
    from: "NEEDS_CORRECTION",
    to: "REJECTED",
    action: "REJECT",
    requiresReason: true,
  },

  // From REJECTED - Admin can overturn rejection
  {
    from: "REJECTED",
    to: "VERIFIED",
    action: "VERIFY",
    requiresReason: false,
  },

  // From VERIFIED - Admin can revoke verification
  {
    from: "VERIFIED",
    to: "REJECTED",
    action: "REJECT",
    requiresReason: true,
  },
  {
    from: "VERIFIED",
    to: "NEEDS_CORRECTION",
    action: "REQUEST_CORRECTION",
    requiresReason: true,
  },
];

export function mapActionToStatus(
  action: VerificationAction,
): VerificationStatus {
  switch (action) {
    case "VERIFY":
      return "VERIFIED";
    case "REJECT":
      return "REJECTED";
    case "REQUEST_CORRECTION":
      return "NEEDS_CORRECTION";
    case "SUBMIT":
    case "RESUBMIT":
      return "PENDING";
  }
}

export function validateTransition(
  currentStatus: VerificationStatus,
  action: VerificationAction,
  reason?: string,
): VerificationValidation {
  const errors: string[] = [];
  const targetStatus = mapActionToStatus(action);

  const transition = VALID_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!transition) {
    errors.push(
      `Invalid transition from ${currentStatus} to ${targetStatus} via ${action}`,
    );
    return { isValid: false, errors };
  }

  if (transition.requiresReason && !reason) {
    errors.push(`Reason is required for ${action} action`);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}
