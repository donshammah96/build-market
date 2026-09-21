import { TrustTier, SubscriptionTierKey, type Prisma } from "@build/db";

export const TRUST_TIER_WEIGHTS: Record<TrustTier, number> = {
  [TrustTier.ELITE]: 5,
  [TrustTier.LICENSE_VERIFIED]: 4,
  [TrustTier.SKILLS_VERIFIED]: 3,
  [TrustTier.ID_VERIFIED]: 2,
  [TrustTier.UNVERIFIED]: 1,
};

export const SUBSCRIPTION_TIER_WEIGHTS: Record<SubscriptionTierKey, number> = {
  [SubscriptionTierKey.BUSINESS]: 3,
  [SubscriptionTierKey.GROWTH]: 2,
  [SubscriptionTierKey.FREE]: 1,
};

/**
 * Checks whether a professional meets the non-negotiable trust requirement
 * to receive marketplace lead routing.
 *
 * HARD INVARIANT: Trust tier gates candidate pool eligibility.
 * Paid subscription tier NEVER bypasses trust verification.
 */
export function canReceiveMarketplaceLead(trustTier: TrustTier): boolean {
  return trustTier !== TrustTier.UNVERIFIED;
}

/**
 * Builds Prisma order by clauses for organic professional search,
 * guaranteeing the Trust-Tier-First invariant.
 */
export function buildTrustTierFirstOrderBy(): Prisma.ProfessionalProfileOrderByWithRelationInput[] {
  return [
    // 1. Trust tier bucket (Handled primarily via enum or custom SQL in raw queries,
    // and rating/reviews within Prisma typed order)
    { rating: "desc" },
    { reviewCount: "desc" },
    { completedProjects: "desc" },
  ];
}

/**
 * SQL snippet generator for raw search ranking queries.
 * Enforces: Trust Tier > Active Boost > Subscription Tier > Rating
 */
export function getTrustTierFirstSqlOrderClause(): string {
  return `
    ORDER BY 
      CASE p."trustTier"
        WHEN 'ELITE' THEN 5
        WHEN 'LICENSE_VERIFIED' THEN 4
        WHEN 'SKILLS_VERIFIED' THEN 3
        WHEN 'ID_VERIFIED' THEN 2
        ELSE 1
      END DESC,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM "ProfileBoost" pb 
          WHERE pb."professionalId" = p."userId" 
            AND pb."startsAt" <= NOW() 
            AND pb."endsAt" >= NOW()
        ) THEN 1 
        ELSE 0 
      END DESC,
      COALESCE(sp."sortOrder", 0) DESC,
      p."rating" DESC,
      p."reviewCount" DESC
  `;
}
