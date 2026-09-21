import {
  prisma,
  SubscriptionTierKey,
  SubscriptionStatus,
  TrustTier,
  type BoostType,
  type BadgeType,
} from "@build/db";
import { entitlementsCache } from "./cache.js";
import type {
  ResolvedEntitlements,
  EntitlementLimits,
  EntitlementFeatures,
  EntitlementDiscounts,
  CrmPipelineLevel,
} from "./types.js";

export interface ResolveEntitlementsOptions {
  skipCache?: boolean;
}

export async function resolveEntitlements(
  professionalId: string,
  options?: ResolveEntitlementsOptions,
): Promise<ResolvedEntitlements> {
  // 1. Check Redis Cache unless explicitly skipped
  if (!options?.skipCache) {
    const cached = await entitlementsCache.get(professionalId);
    if (cached) {
      return cached;
    }
  }

  const now = new Date();

  // 2. Fetch pro, active subscription, plan, active boosts, and unrevoked badges
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: professionalId },
    select: {
      userId: true,
      trustTier: true,
      subscription: {
        select: {
          id: true,
          status: true,
          billingInterval: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          graceEndsAt: true,
          isFoundingPro: true,
          foundingProDiscountPct: true,
          foundingProUntil: true,
          plan: {
            select: {
              key: true,
              name: true,
              maxPortfolioProjects: true,
              maxPortfolioImagesPerProject: true,
              maxTeamMembers: true,
              monthlyLeadCredits: true,
              leadCreditDiscountPct: true,
              boostsIncludedPerMonth: true,
              platformFeePct: true,
              featureFlags: true,
            },
          },
        },
      },
      boosts: {
        where: {
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        select: { type: true },
      },
      badges: {
        where: {
          revokedAt: null,
        },
        select: { type: true },
      },
    },
  });

  const trustTier = profile?.trustTier ?? TrustTier.UNVERIFIED;
  const sub = profile?.subscription;

  // Determine effective subscription status and tier
  const isSubActive =
    sub &&
    (sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.TRIALING ||
      sub.status === SubscriptionStatus.GRACE_PERIOD);

  const effectiveTierKey =
    isSubActive && sub.plan ? sub.plan.key : SubscriptionTierKey.FREE;
  const plan = sub?.plan;

  // Founding Pro economics:
  // - Comp period is active if isFoundingPro is true and current date is before foundingProUntil
  // - Permanent discount applies to renewals/purchases (default 15% if comped)
  const isFoundingPro = sub?.isFoundingPro ?? false;
  const isCompedPeriodActive = Boolean(
    isFoundingPro && sub?.foundingProUntil && now < sub.foundingProUntil,
  );
  const foundingProDiscountPct = isFoundingPro
    ? (sub?.foundingProDiscountPct ?? 15)
    : 0;

  // Derive feature flags JSON if present
  const rawFlags = (plan?.featureFlags as Record<string, unknown>) ?? {};

  // Construct limits
  const limits: EntitlementLimits = {
    maxPortfolioProjects:
      plan?.maxPortfolioProjects ??
      (effectiveTierKey === SubscriptionTierKey.FREE
        ? 3
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 15
          : null),
    maxPortfolioImagesPerProject:
      plan?.maxPortfolioImagesPerProject ??
      (effectiveTierKey === SubscriptionTierKey.FREE
        ? 5
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 15
          : null),
    maxTeamMembers:
      plan?.maxTeamMembers ??
      (effectiveTierKey === SubscriptionTierKey.FREE
        ? 1
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 3
          : null),
    maxQuotesPerMonth: effectiveTierKey === SubscriptionTierKey.FREE ? 5 : null,
  };

  // Base plan routing flag
  const planAllowsLeads =
    typeof rawFlags.canReceiveMarketplaceLeads === "boolean"
      ? rawFlags.canReceiveMarketplaceLeads
      : effectiveTierKey !== SubscriptionTierKey.FREE;

  // HARD INVARIANT: Trust tier gates marketplace lead routing regardless of paid subscription tier
  const canReceiveMarketplaceLeads =
    trustTier !== TrustTier.UNVERIFIED && planAllowsLeads;

  const crmPipelineLevel: CrmPipelineLevel =
    (rawFlags.crmPipelineLevel as CrmPipelineLevel) ??
    (effectiveTierKey === SubscriptionTierKey.BUSINESS
      ? "TEAM"
      : effectiveTierKey === SubscriptionTierKey.GROWTH
        ? "FULL"
        : "BASIC");

  const analyticsDepthDays =
    typeof rawFlags.analyticsDepthDays === "number"
      ? (rawFlags.analyticsDepthDays as number)
      : effectiveTierKey === SubscriptionTierKey.BUSINESS
        ? 365
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 90
          : 7;

  const features: EntitlementFeatures = {
    canReceiveMarketplaceLeads,
    crmPipelineLevel,
    analyticsDepthDays,
    priorityVerificationSla: effectiveTierKey !== SubscriptionTierKey.FREE,
    whatsappLeadAlerts: effectiveTierKey !== SubscriptionTierKey.FREE,
    brandedQuoteTemplates: effectiveTierKey === SubscriptionTierKey.BUSINESS,
    directCallRouting: effectiveTierKey === SubscriptionTierKey.BUSINESS,
  };

  const discounts: EntitlementDiscounts = {
    leadCreditDiscountPct:
      plan?.leadCreditDiscountPct ??
      (effectiveTierKey === SubscriptionTierKey.BUSINESS
        ? 35
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 20
          : 0),
    platformFeeDiscountPct:
      effectiveTierKey === SubscriptionTierKey.BUSINESS
        ? 50
        : effectiveTierKey === SubscriptionTierKey.GROWTH
          ? 25
          : 0,
    foundingProDiscountPct,
  };

  const activeBoosts: BoostType[] = profile?.boosts?.map((b) => b.type) ?? [];
  const badges: BadgeType[] = profile?.badges?.map((b) => b.type) ?? [];

  const resolved: ResolvedEntitlements = {
    professionalId,
    trustTier,
    subscriptionTier: effectiveTierKey,
    subscriptionStatus: sub?.status ?? SubscriptionStatus.ACTIVE,
    isFoundingPro,
    isCompedPeriodActive,
    limits,
    features,
    discounts,
    activeBoosts,
    badges,
    resolvedAt: now.toISOString(),
  };

  // Cache resolved outcome
  await entitlementsCache.set(professionalId, resolved);

  return resolved;
}
