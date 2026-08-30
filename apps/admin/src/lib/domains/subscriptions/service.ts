import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import { omitUndefined } from "@/lib/utils";
import type {
  SubscriptionPlan,
  ProfessionalSubscription,
  LeadCreditWallet,
  LeadCreditLedgerEntry,
  ProfessionalProfile,
  ProfessionalBadge,
  ProfileBoost,
  Profession,
  TrustTier,
  Prisma,
} from "@build/db";
import { subscriptionsRepository } from "./repository.js";
import type {
  SubscriptionsActor,
  SubscriptionsDomainError,
  UpdateSubscriptionPlanInput,
  OverrideSubscriptionInput,
  OverrideTrustTierInput,
  AdjustLeadCreditWalletInput,
  ManageBadgeInput,
  CreateProfileBoostInput,
} from "./contracts.js";

function requireManageUsers(
  actor: SubscriptionsActor,
): Result<true, SubscriptionsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_USERS);
  if (!policy.ok) {
    return err({
      code: "SUBSCRIPTIONS_POLICY_DENIED",
      message: "Admin capability MANAGE_USERS denied",
    });
  }
  return ok(true);
}

function requireViewFinancials(
  actor: SubscriptionsActor,
): Result<true, SubscriptionsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_FINANCIALS);
  if (!policy.ok) {
    return err({
      code: "SUBSCRIPTIONS_POLICY_DENIED",
      message: "Admin capability VIEW_FINANCIALS denied",
    });
  }
  return ok(true);
}

function requireManageVerification(
  actor: SubscriptionsActor,
): Result<true, SubscriptionsDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );
  if (!policy.ok) {
    return err({
      code: "SUBSCRIPTIONS_POLICY_DENIED",
      message: "Admin capability MANAGE_VERIFICATION denied",
    });
  }
  return ok(true);
}

export interface ProfessionalSubscriptionDetails {
  subscription:
    | (ProfessionalSubscription & {
        plan: SubscriptionPlan;
        professional: {
          userId: string;
          companyName: string;
          profession: Profession | null;
          trustTier: TrustTier;
        };
      })
    | null;
  wallet: (LeadCreditWallet & { ledger: LeadCreditLedgerEntry[] }) | null;
}

export interface WalletAdjustmentResult {
  wallet: LeadCreditWallet;
  ledgerEntry: LeadCreditLedgerEntry;
}

export interface BadgeRevocationResult {
  success: boolean;
  revoked: string;
}

export class SubscriptionsService {
  async listSubscriptionPlans(
    actor: SubscriptionsActor,
  ): Promise<Result<SubscriptionPlan[], SubscriptionsDomainError>> {
    const cap = requireViewFinancials(actor);
    if (!cap.ok) return cap;

    try {
      const plans = await subscriptionsRepository.listPlans();
      return ok(plans);
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to list subscription plans",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async updateSubscriptionPlan(
    actor: SubscriptionsActor,
    planId: string,
    input: UpdateSubscriptionPlanInput,
  ): Promise<Result<SubscriptionPlan, SubscriptionsDomainError>> {
    const cap = requireManageUsers(actor);
    if (!cap.ok) return cap;

    try {
      const existing = await subscriptionsRepository.findPlanById(planId);
      if (!existing) {
        return err({
          code: "PLAN_NOT_FOUND",
          message: `Subscription plan with ID ${planId} not found`,
        });
      }

      const updateData = omitUndefined({
        name: input.name,
        description: input.description,
        priceMonthlyKES: input.priceMonthlyKES,
        priceAnnualKES: input.priceAnnualKES,
        maxPortfolioProjects: input.maxPortfolioProjects,
        maxPortfolioImagesPerProject: input.maxPortfolioImagesPerProject,
        maxTeamMembers: input.maxTeamMembers,
        monthlyLeadCredits: input.monthlyLeadCredits,
        leadCreditDiscountPct: input.leadCreditDiscountPct,
        boostsIncludedPerMonth: input.boostsIncludedPerMonth,
        platformFeePct: input.platformFeePct,
        featureFlags: input.featureFlags as Prisma.InputJsonValue | undefined,
        isActive: input.isActive,
      }) as Prisma.SubscriptionPlanUpdateInput;

      const updated = await subscriptionsRepository.updatePlan(
        planId,
        updateData,
      );

      return ok(updated);
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to update subscription plan",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async getProfessionalSubscription(
    actor: SubscriptionsActor,
    professionalId: string,
  ): Promise<
    Result<ProfessionalSubscriptionDetails, SubscriptionsDomainError>
  > {
    const cap = requireViewFinancials(actor);
    if (!cap.ok) return cap;

    try {
      const sub =
        await subscriptionsRepository.findSubscriptionByProfessionalId(
          professionalId,
        );
      const wallet = await subscriptionsRepository.findWallet(professionalId);
      return ok({ subscription: sub, wallet });
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to get professional subscription",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Manual override: comp Founding Pro, change tier, extend grace period.
   * Enables 100% manual pilot cohort onboarding with zero automated billing dependence.
   */
  async overrideProfessionalSubscription(
    actor: SubscriptionsActor,
    input: OverrideSubscriptionInput,
  ): Promise<Result<ProfessionalSubscription, SubscriptionsDomainError>> {
    const cap = requireManageUsers(actor);
    if (!cap.ok) return cap;

    try {
      let planConnect: { connect: { id: string } } | undefined;
      if (input.planKey) {
        const plan = await subscriptionsRepository.findPlanByKey(input.planKey);
        if (!plan) {
          return err({
            code: "PLAN_NOT_FOUND",
            message: `Plan ${input.planKey} not found`,
          });
        }
        planConnect = { connect: { id: plan.id } };
      }

      let graceEndsAt: Date | undefined;
      if (input.extendGraceDays && input.extendGraceDays > 0) {
        graceEndsAt = new Date(
          Date.now() + input.extendGraceDays * 24 * 60 * 60 * 1000,
        );
      }

      const updateData = omitUndefined({
        plan: planConnect,
        status: input.status,
        isFoundingPro: input.isFoundingPro,
        foundingProDiscountPct: input.foundingProDiscountPct,
        foundingProUntil: input.foundingProUntil,
        graceEndsAt,
      }) as Prisma.ProfessionalSubscriptionUpdateInput;

      const updated = await subscriptionsRepository.updateSubscription(
        input.professionalId,
        updateData,
      );

      return ok(updated);
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to override professional subscription",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Manual Trust Tier override (with mandatory reason for audit trail).
   */
  async overrideTrustTier(
    actor: SubscriptionsActor,
    input: OverrideTrustTierInput,
  ): Promise<Result<ProfessionalProfile, SubscriptionsDomainError>> {
    const cap = requireManageVerification(actor);
    if (!cap.ok) return cap;

    try {
      const updated = await subscriptionsRepository.updateTrustTier(
        input.professionalId,
        input.trustTier,
      );
      return ok(updated);
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to override trust tier",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Adjust pro lead credit wallet with atomic ledger append.
   */
  async adjustLeadCreditWallet(
    actor: SubscriptionsActor,
    input: AdjustLeadCreditWalletInput,
  ): Promise<Result<WalletAdjustmentResult, SubscriptionsDomainError>> {
    const cap = requireManageUsers(actor);
    if (!cap.ok) return cap;

    try {
      const result = await subscriptionsRepository.adjustWalletWithLedger(
        input.professionalId,
        input.amount,
        input.type,
        `Admin (${actor.dbUserId}) adjustment: ${input.note}`,
      );
      return ok(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "INSUFFICIENT_CREDITS") {
        return err({
          code: "INSUFFICIENT_CREDITS",
          message: "Wallet balance cannot be negative",
        });
      }
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to adjust lead credit wallet",
        details: { error: message },
      });
    }
  }

  async manageBadge(
    actor: SubscriptionsActor,
    input: ManageBadgeInput,
  ): Promise<
    Result<ProfessionalBadge | BadgeRevocationResult, SubscriptionsDomainError>
  > {
    const cap = requireManageVerification(actor);
    if (!cap.ok) return cap;

    try {
      if (input.action === "AWARD") {
        const badge = await subscriptionsRepository.awardBadge(
          input.professionalId,
          input.badgeType,
          input.criteriaSnapshot,
        );
        return ok(badge);
      } else {
        await subscriptionsRepository.revokeBadge(
          input.professionalId,
          input.badgeType,
        );
        return ok({ success: true, revoked: input.badgeType });
      }
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to manage badge",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async createProfileBoost(
    actor: SubscriptionsActor,
    input: CreateProfileBoostInput,
  ): Promise<Result<ProfileBoost, SubscriptionsDomainError>> {
    const cap = requireManageUsers(actor);
    if (!cap.ok) return cap;

    try {
      const startsAt = new Date();
      const endsAt = new Date(
        Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
      );

      const boost = await subscriptionsRepository.createProfileBoost(
        input.professionalId,
        input.type,
        startsAt,
        endsAt,
        input.includedInPlan ?? false,
      );

      return ok(boost);
    } catch (error) {
      return err({
        code: "SUBSCRIPTIONS_DATABASE_ERROR",
        message: "Failed to create profile boost",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

export const subscriptionsService = new SubscriptionsService();
