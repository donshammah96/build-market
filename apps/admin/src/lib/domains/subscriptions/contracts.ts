import type {
  SubscriptionTierKey,
  SubscriptionStatus,
  TrustTier,
  BadgeType,
  BoostType,
  LeadCreditTxnType,
} from "@build/db";
import type { AdminActor } from "@/lib/security/admin-actor";

export type SubscriptionsActor = AdminActor;

export type SubscriptionsDomainErrorCode =
  | "SUBSCRIPTIONS_POLICY_DENIED"
  | "PLAN_NOT_FOUND"
  | "PROFESSIONAL_NOT_FOUND"
  | "INVALID_INPUT"
  | "INSUFFICIENT_CREDITS"
  | "SUBSCRIPTIONS_DATABASE_ERROR";

export interface SubscriptionsDomainError {
  code: SubscriptionsDomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  priceMonthlyKES?: number;
  priceAnnualKES?: number;
  maxPortfolioProjects?: number | null;
  maxPortfolioImagesPerProject?: number | null;
  maxTeamMembers?: number | null;
  monthlyLeadCredits?: number;
  leadCreditDiscountPct?: number;
  boostsIncludedPerMonth?: number;
  platformFeePct?: number;
  featureFlags?: Record<string, unknown>;
  isActive?: boolean;
}

export interface OverrideSubscriptionInput {
  professionalId: string;
  planKey?: SubscriptionTierKey;
  status?: SubscriptionStatus;
  isFoundingPro?: boolean;
  foundingProDiscountPct?: number;
  foundingProUntil?: Date | null;
  extendGraceDays?: number;
  reason: string;
}

export interface OverrideTrustTierInput {
  professionalId: string;
  trustTier: TrustTier;
  reason: string;
}

export interface AdjustLeadCreditWalletInput {
  professionalId: string;
  amount: number; // positive = grant, negative = revoke
  type: LeadCreditTxnType;
  note: string;
}

export interface ManageBadgeInput {
  professionalId: string;
  badgeType: BadgeType;
  action: "AWARD" | "REVOKE";
  criteriaSnapshot?: Record<string, unknown>;
  reason: string;
}

export interface CreateProfileBoostInput {
  professionalId: string;
  type: BoostType;
  durationDays: number;
  includedInPlan?: boolean;
  reason: string;
}
