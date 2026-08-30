"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  SubscriptionTierKey,
  SubscriptionStatus,
  TrustTier,
  BadgeType,
  BoostType,
} from "@build/db";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "@/_core/validation";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";
import { omitUndefined } from "@/lib/utils";
import { subscriptionsService } from "@/lib/domains/subscriptions/service";
import type {
  UpdateSubscriptionPlanInput,
  OverrideSubscriptionInput,
  OverrideTrustTierInput,
  ManageBadgeInput,
  CreateProfileBoostInput,
} from "@/lib/domains/subscriptions/contracts";

const UpdateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceMonthlyKES: z.number().min(0).optional(),
  priceAnnualKES: z.number().min(0).optional(),
  maxPortfolioProjects: z.number().min(0).nullable().optional(),
  maxPortfolioImagesPerProject: z.number().min(0).nullable().optional(),
  maxTeamMembers: z.number().min(0).nullable().optional(),
  monthlyLeadCredits: z.number().min(0).optional(),
  leadCreditDiscountPct: z.number().min(0).max(100).optional(),
  boostsIncludedPerMonth: z.number().min(0).optional(),
  platformFeePct: z.number().min(0).max(100).optional(),
  featureFlags: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const OverrideSubscriptionSchema = z.object({
  professionalId: z.string().min(1),
  planKey: z.nativeEnum(SubscriptionTierKey).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  isFoundingPro: z.boolean().optional(),
  foundingProDiscountPct: z.number().min(0).max(100).optional(),
  foundingProUntil: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  extendGraceDays: z.number().min(0).max(90).optional(),
  reason: z.string().min(5, "A clear reason is required for audit trail"),
});

const OverrideTrustTierSchema = z.object({
  professionalId: z.string().min(1),
  trustTier: z.nativeEnum(TrustTier),
  reason: z.string().min(5, "A clear reason is required for audit trail"),
});

const ManageBadgeSchema = z.object({
  professionalId: z.string().min(1),
  badgeType: z.nativeEnum(BadgeType),
  action: z.enum(["AWARD", "REVOKE"]),
  criteriaSnapshot: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(5, "A clear reason is required for audit trail"),
});

const CreateProfileBoostSchema = z.object({
  professionalId: z.string().min(1),
  type: z.nativeEnum(BoostType),
  durationDays: z.number().min(1).max(365),
  includedInPlan: z.boolean().optional(),
  reason: z.string().min(5, "A clear reason is required for audit trail"),
});

// ============================================================================
// Actions
// ============================================================================

export async function getSubscriptionPlans() {
  return safeAction(
    AdminOperationName.GET_SUBSCRIPTION_PLANS,
    async ({ actor }) => {
      const result = await subscriptionsService.listSubscriptionPlans(actor);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
  );
}

export async function updateSubscriptionPlan(
  planId: string,
  data: UpdateSubscriptionPlanInput,
) {
  return safeAction(
    AdminOperationName.UPDATE_SUBSCRIPTION_PLAN,
    async ({ actor }) => {
      const parsedPlanId = parseActionInput(
        z.string().min(1),
        planId,
        "Plan ID is required",
      );
      const validated = parseActionInput(
        UpdateSubscriptionPlanSchema,
        data,
        "Invalid plan data",
      );
      const result = await subscriptionsService.updateSubscriptionPlan(
        actor,
        parsedPlanId,
        omitUndefined(validated) as UpdateSubscriptionPlanInput,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath("/admin/subscriptions");
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.UPDATE_SUBSCRIPTION_PLAN,
        resourceType: "subscription_plan",
        getTargetId: () => planId,
      },
    },
  );
}

export async function getProfessionalSubscription(professionalId: string) {
  return safeAction(
    AdminOperationName.GET_PROFESSIONAL_SUBSCRIPTION,
    async ({ actor }) => {
      const parsedId = parseActionInput(
        z.string().min(1),
        professionalId,
        "Professional ID is required",
      );
      const result = await subscriptionsService.getProfessionalSubscription(
        actor,
        parsedId,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
  );
}

/**
 * Manual pro subscription override (Comp Founding Pro, force tier, grace extension).
 * Required for Phase 2 Pilot Cohort Onboarding.
 */
export async function overrideProfessionalSubscription(
  data: OverrideSubscriptionInput,
) {
  return safeAction(
    AdminOperationName.OVERRIDE_PROFESSIONAL_SUBSCRIPTION,
    async ({ actor }) => {
      const validated = parseActionInput(
        OverrideSubscriptionSchema,
        data,
        "Invalid override data",
      );
      const result =
        await subscriptionsService.overrideProfessionalSubscription(
          actor,
          omitUndefined(validated) as OverrideSubscriptionInput,
        );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath(`/admin/professionals/${validated.professionalId}`);
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.OVERRIDE_PROFESSIONAL_SUBSCRIPTION,
        resourceType: "professional_subscription",
        getTargetId: () => data.professionalId,
        getReason: () => data.reason,
      },
    },
  );
}

/**
 * Manual Trust Tier override (with mandatory reason).
 */
export async function overrideTrustTier(data: OverrideTrustTierInput) {
  return safeAction(
    AdminOperationName.OVERRIDE_TRUST_TIER,
    async ({ actor }) => {
      const validated = parseActionInput(
        OverrideTrustTierSchema,
        data,
        "Invalid trust tier override",
      );
      const result = await subscriptionsService.overrideTrustTier(
        actor,
        validated,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath(`/admin/professionals/${validated.professionalId}`);
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.OVERRIDE_TRUST_TIER,
        resourceType: "professional_profile",
        getTargetId: () => data.professionalId,
        getReason: () => data.reason,
      },
    },
  );
}

/**
 * Award or revoke badge manually.
 */
export async function manageProfessionalBadge(data: ManageBadgeInput) {
  return safeAction(
    AdminOperationName.MANAGE_PROFESSIONAL_BADGE,
    async ({ actor }) => {
      const validated = parseActionInput(
        ManageBadgeSchema,
        data,
        "Invalid badge data",
      );
      const result = await subscriptionsService.manageBadge(
        actor,
        omitUndefined(validated) as ManageBadgeInput,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath(`/admin/professionals/${validated.professionalId}`);
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.MANAGE_PROFESSIONAL_BADGE,
        resourceType: "professional_badge",
        getTargetId: () => data.professionalId,
        getReason: () => data.reason,
      },
    },
  );
}

/**
 * Create profile boost manually.
 */
export async function createProfileBoost(data: CreateProfileBoostInput) {
  return safeAction(
    AdminOperationName.CREATE_PROFILE_BOOST,
    async ({ actor }) => {
      const validated = parseActionInput(
        CreateProfileBoostSchema,
        data,
        "Invalid boost data",
      );
      const result = await subscriptionsService.createProfileBoost(
        actor,
        omitUndefined(validated) as CreateProfileBoostInput,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath(`/admin/professionals/${validated.professionalId}`);
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.CREATE_PROFILE_BOOST,
        resourceType: "profile_boost",
        getTargetId: () => data.professionalId,
        getReason: () => data.reason,
      },
    },
  );
}
