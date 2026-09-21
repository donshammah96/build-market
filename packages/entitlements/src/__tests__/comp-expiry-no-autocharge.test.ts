import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SubscriptionTierKey,
  SubscriptionStatus,
  TrustTier,
  BillingInterval,
} from "@build/db";

vi.mock("@build/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    prisma: {
      professionalProfile: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@build/redis", () => {
  return {
    RedisCache: class MockRedisCache {
      get = vi.fn().mockResolvedValue(null);
      set = vi.fn().mockResolvedValue(undefined);
      delete = vi.fn().mockResolvedValue(undefined);
      clear = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { prisma } from "@build/db";
import { resolveEntitlements } from "../resolver.js";

describe("Comp Expiry No-AutoCharge & Free-Tier Degradation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("degrades to inactive comp state when foundingProUntil has passed without initiating payment", async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7); // 7 days expired

    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-comp-expired",
      trustTier: TrustTier.LICENSE_VERIFIED,
      subscription: {
        id: "sub-expired-comp",
        status: SubscriptionStatus.PAST_DUE, // Expired comp period transitions status
        billingInterval: BillingInterval.MONTHLY,
        isFoundingPro: true,
        foundingProDiscountPct: 15,
        foundingProUntil: pastDate,
        plan: {
          key: SubscriptionTierKey.BUSINESS,
          name: "Bora (Business)",
          maxPortfolioProjects: null,
          maxPortfolioImagesPerProject: null,
          maxTeamMembers: null,
          monthlyLeadCredits: 15,
          leadCreditDiscountPct: 35,
          boostsIncludedPerMonth: 2,
          platformFeePct: 5.0,
          featureFlags: {},
        },
        boosts: [],
        badges: [],
      },
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-comp-expired", {
      skipCache: true,
    });

    // Assert: Comp period is marked inactive
    expect(entitlements.isCompedPeriodActive).toBe(false);

    // Assert: Account retains lifetime 15% discount for future voluntary renewals
    expect(entitlements.isFoundingPro).toBe(true);
    expect(entitlements.discounts.foundingProDiscountPct).toBe(15);

    // Assert: Effective tier degrades to FREE (no silent auto-charge or active entitlements)
    expect(entitlements.subscriptionTier).toBe(SubscriptionTierKey.FREE);
    expect(entitlements.limits.maxPortfolioProjects).toBe(3); // Free tier limit
  });

  it("maintains active comp period while foundingProUntil is in the future", async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // 90 days remaining

    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-comp-active",
      trustTier: TrustTier.LICENSE_VERIFIED,
      subscription: {
        id: "sub-active-comp",
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        isFoundingPro: true,
        foundingProDiscountPct: 15,
        foundingProUntil: futureDate,
        plan: {
          key: SubscriptionTierKey.BUSINESS,
          name: "Bora (Business)",
          maxPortfolioProjects: null,
          maxPortfolioImagesPerProject: null,
          maxTeamMembers: null,
          monthlyLeadCredits: 15,
          leadCreditDiscountPct: 35,
          boostsIncludedPerMonth: 2,
          platformFeePct: 5.0,
          featureFlags: {},
        },
        boosts: [],
        badges: [],
      },
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-comp-active", {
      skipCache: true,
    });

    expect(entitlements.isCompedPeriodActive).toBe(true);
    expect(entitlements.isFoundingPro).toBe(true);
    expect(entitlements.subscriptionTier).toBe(SubscriptionTierKey.BUSINESS);
  });
});
