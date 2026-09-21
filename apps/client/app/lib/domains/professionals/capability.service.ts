/**
 * ProfessionalPortalCapabilityService
 *
 * Single source of truth for professional portal capability resolution,
 * route entitlement, and verification-status-aware access controls.
 *
 * Layer: app/lib/domains/professionals/ (Pure Domain Service per ADR-002)
 */

import {
  professionalReadinessService,
  type ProfessionalCapabilities,
  type VerificationStatus,
} from "./readiness.service";
import {
  ok,
  err,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";

export type PortalCapabilityErrorCode =
  | "not_found"
  | "forbidden"
  | "account_suspended"
  | "account_rejected"
  | "internal";

export type ExtendedProfessionalCapabilities = ProfessionalCapabilities & {
  /** Whether the professional can view analytics and reports */
  canViewAnalytics: boolean;
  /** Whether the professional can manage projects */
  canManageProjects: boolean;
  /** Whether the professional can view/manage calendar */
  canManageCalendar: boolean;
  /** Whether the professional can access messages and inquiries */
  canAccessMessages: boolean;
};

export type ProfessionalCapabilityContext = {
  userId: string;
  professionalId?: string;
  verificationStatus: VerificationStatus;
  isProfileComplete: boolean;
  capabilities: ExtendedProfessionalCapabilities;
  restrictedReason?: string;
};

export class ProfessionalPortalCapabilityService {
  /**
   * Resolve full capability context for a professional given their user ID.
   */
  async getCapabilityContext(
    userId: string,
  ): Promise<
    Result<
      ProfessionalCapabilityContext,
      DomainError<PortalCapabilityErrorCode>
    >
  > {
    const readinessRes =
      await professionalReadinessService.getReadiness(userId);

    if (!readinessRes.ok) {
      if (readinessRes.error === "not_found") {
        return err({
          error: "not_found",
          message: "Professional profile not found for user",
          status: 404,
        });
      }
      return err({
        error: "internal",
        message: "Failed to resolve professional capability context",
        status: 500,
      });
    }

    const { capabilities, verificationStatus, isProfileComplete } =
      readinessRes.data;

    // Build extended capability matrix based on verification status & completeness
    const extendedCapabilities = this.computeExtendedCapabilities(
      capabilities,
      verificationStatus,
      isProfileComplete,
    );

    let restrictedReason: string | undefined;
    if (verificationStatus === "SUSPENDED") {
      restrictedReason =
        "Account has been suspended due to compliance or policy violation.";
    } else if (verificationStatus === "REJECTED") {
      restrictedReason =
        "Application was rejected. Please contact support or submit an appeal.";
    } else if (verificationStatus === "PENDING") {
      restrictedReason =
        "Verification is pending review. Core interactions are locked until approved.";
    } else if (verificationStatus === "NEEDS_CHANGES") {
      restrictedReason =
        "Action required: additional verification documents or details are needed.";
    }

    return ok({
      userId,
      verificationStatus,
      isProfileComplete,
      capabilities: extendedCapabilities,
      restrictedReason,
    });
  }

  /**
   * Verify if a professional has a specific capability enabled.
   */
  async hasCapability(
    userId: string,
    capability: keyof ExtendedProfessionalCapabilities,
  ): Promise<Result<boolean, DomainError<PortalCapabilityErrorCode>>> {
    const contextRes = await this.getCapabilityContext(userId);
    if (!contextRes.ok) {
      return contextRes;
    }

    const isAllowed = Boolean(contextRes.data.capabilities[capability]);
    return ok(isAllowed);
  }

  /**
   * Assert route authorization for a specific capability, returning domain error if forbidden.
   */
  async assertCapabilityAccess(
    userId: string,
    requiredCapability: keyof ExtendedProfessionalCapabilities,
  ): Promise<
    Result<
      ProfessionalCapabilityContext,
      DomainError<PortalCapabilityErrorCode>
    >
  > {
    const contextRes = await this.getCapabilityContext(userId);
    if (!contextRes.ok) {
      return contextRes;
    }

    const context = contextRes.data;
    if (!context.capabilities[requiredCapability]) {
      if (context.verificationStatus === "SUSPENDED") {
        return err({
          error: "account_suspended",
          message: context.restrictedReason || "Account suspended",
          status: 403,
        });
      }
      if (context.verificationStatus === "REJECTED") {
        return err({
          error: "account_rejected",
          message: context.restrictedReason || "Account application rejected",
          status: 403,
        });
      }
      return err({
        error: "forbidden",
        message: `Capability '${requiredCapability}' is restricted under ${context.verificationStatus} status`,
        status: 403,
      });
    }

    return ok(context);
  }

  /**
   * Compute extended capabilities combining base readiness with portal modules.
   */
  private computeExtendedCapabilities(
    base: ProfessionalCapabilities,
    status: VerificationStatus,
    isProfileComplete: boolean,
  ): ExtendedProfessionalCapabilities {
    const isVerifiedAndComplete = status === "VERIFIED" && isProfileComplete;

    return {
      ...base,
      canViewAnalytics: isVerifiedAndComplete,
      canManageProjects:
        status === "VERIFIED" ||
        status === "NEEDS_CHANGES" ||
        status === "PENDING",
      canManageCalendar: status === "VERIFIED",
      canAccessMessages:
        status === "VERIFIED" ||
        status === "NEEDS_CHANGES" ||
        status === "PENDING",
    };
  }
}

export const professionalPortalCapabilityService =
  new ProfessionalPortalCapabilityService();
