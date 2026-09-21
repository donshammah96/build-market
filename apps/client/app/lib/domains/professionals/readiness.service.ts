/**
 * ProfessionalReadinessService
 *
 * Computes professional capability flags from database state.
 * Determines what a professional can and cannot do based on their
 * verification status and profile completeness.
 *
 * This is a pure domain service — no HTTP, no framework, no side effects.
 */

import { prisma } from "@build/db";
import {
  ok,
  err,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";

// ============================================================================
// TYPES
// ============================================================================

export type VerificationStatus =
  "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" | "NEEDS_CHANGES";

export type ProfessionalCapabilities = {
  /** Whether the professional appears in search results */
  canAppearInSearch: boolean;
  /** Whether the professional can receive new leads */
  canReceiveLeads: boolean;
  /** Whether the professional can create and send quotes */
  canCreateQuotes: boolean;
  /** Whether the professional can list properties (real estate only) */
  canListProperties: boolean;
  /** Whether the professional can sell items in their store (suppliers only) */
  canSellStoreItems: boolean;
  /** Whether the professional can withdraw funds */
  canWithdrawFunds: boolean;
  /** Whether the professional can edit their own profile */
  canEditProfile: boolean;
};

export type ProfessionalReadinessResult = {
  capabilities: ProfessionalCapabilities;
  verificationStatus: VerificationStatus;
  isProfileComplete: boolean;
  /** The recommended next route for the professional after onboarding */
  nextRoute: string;
};

type ReadinessErrorCode = "not_found" | "internal";

// ============================================================================
// CAPABILITY COMPUTATION (pure function, testable)
// ============================================================================

/**
 * Compute capabilities from verification status and profile completeness.
 * This is deliberately a pure function — no DB, no side effects — so it
 * can be unit tested exhaustively.
 */
export function computeCapabilities(
  verificationStatus: VerificationStatus,
  isProfileComplete: boolean,
): ProfessionalCapabilities {
  // REJECTED / SUSPENDED: all capabilities locked
  if (verificationStatus === "REJECTED" || verificationStatus === "SUSPENDED") {
    return {
      canAppearInSearch: false,
      canReceiveLeads: false,
      canCreateQuotes: false,
      canListProperties: false,
      canSellStoreItems: false,
      canWithdrawFunds: false,
      canEditProfile: false,
    };
  }

  // PENDING / NEEDS_CHANGES: can only edit profile
  if (
    verificationStatus === "PENDING" ||
    verificationStatus === "NEEDS_CHANGES"
  ) {
    return {
      canAppearInSearch: false,
      canReceiveLeads: false,
      canCreateQuotes: false,
      canListProperties: false,
      canSellStoreItems: false,
      canWithdrawFunds: false,
      canEditProfile: true,
    };
  }

  // VERIFIED: full capabilities if profile is complete
  if (verificationStatus === "VERIFIED") {
    if (isProfileComplete) {
      return {
        canAppearInSearch: true,
        canReceiveLeads: true,
        canCreateQuotes: true,
        canListProperties: true,
        canSellStoreItems: true,
        canWithdrawFunds: true,
        canEditProfile: true,
      };
    }

    // VERIFIED but incomplete profile: most capabilities, but not search/leads
    return {
      canAppearInSearch: false,
      canReceiveLeads: false,
      canCreateQuotes: true,
      canListProperties: true,
      canSellStoreItems: true,
      canWithdrawFunds: false,
      canEditProfile: true,
    };
  }

  // Fallback: treat unknown status as pending
  return {
    canAppearInSearch: false,
    canReceiveLeads: false,
    canCreateQuotes: false,
    canListProperties: false,
    canSellStoreItems: false,
    canWithdrawFunds: false,
    canEditProfile: true,
  };
}

/**
 * Determine the recommended next route for a professional based on their
 * verification status.
 */
export function computeNextRoute(
  verificationStatus: VerificationStatus,
): string {
  switch (verificationStatus) {
    case "VERIFIED":
      return "/professional-portal/dashboard";
    case "PENDING":
    case "NEEDS_CHANGES":
      return "/professional-portal/pending-verification";
    case "REJECTED":
    case "SUSPENDED":
      return "/professional-portal/pending-verification";
    default:
      return "/professional-portal/pending-verification";
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export const professionalReadinessService = {
  /**
   * Resolve the full readiness state for a professional by their internal userId.
   */
  async getReadiness(
    userId: string,
  ): Promise<
    Result<ProfessionalReadinessResult, DomainError<ReadinessErrorCode>>
  > {
    try {
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId },
        select: {
          verificationStatus: true,
          verified: true,
          user: {
            select: {
              isProfileComplete: true,
            },
          },
        },
      });

      if (!profile) {
        return err({
          error: "not_found",
          message: "Professional profile not found",
          status: 404,
        });
      }

      const verificationStatus =
        (profile.verificationStatus as VerificationStatus) ?? "PENDING";
      const isProfileComplete = profile.user.isProfileComplete;
      const capabilities = computeCapabilities(
        verificationStatus,
        isProfileComplete,
      );
      const nextRoute = computeNextRoute(verificationStatus);

      return ok({
        capabilities,
        verificationStatus,
        isProfileComplete,
        nextRoute,
      });
    } catch {
      return err({
        error: "internal",
        message: "Failed to resolve professional readiness",
        status: 500,
      });
    }
  },
};
