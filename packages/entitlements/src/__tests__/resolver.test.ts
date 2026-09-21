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

describe("resolveEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strictly enforces T0 Trust Invariant (cannot receive marketplace leads even on BUSINESS plan)", async () => {
    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-1",
      trustTier: TrustTier.UNVERIFIED,
      subscription: {
        id: "sub-1",
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        isFoundingPro: false,
        foundingProDiscountPct: null,
        foundingProUntil: null,
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
          featureFlags: { canReceiveMarketplaceLeads: true },
        },
      },
      boosts: [],
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-1", {
      skipCache: true,
    });

    expect(entitlements.trustTier).toBe(TrustTier.UNVERIFIED);
    expect(entitlements.subscriptionTier).toBe(SubscriptionTierKey.BUSINESS);
    // HARD INVARIANT:
    expect(entitlements.features.canReceiveMarketplaceLeads).toBe(false);
    // But other business features are active:
    expect(entitlements.limits.maxPortfolioProjects).toBe(null);
    expect(entitlements.features.crmPipelineLevel).toBe("TEAM");
    expect(entitlements.features.analyticsDepthDays).toBe(365);
  });

  it("allows verified trades (T2 Skills Verified) with GROWTH plan to receive marketplace leads and enforces limits", async () => {
    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-2",
      trustTier: TrustTier.SKILLS_VERIFIED,
      subscription: {
        id: "sub-2",
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        isFoundingPro: false,
        foundingProDiscountPct: null,
        foundingProUntil: null,
        plan: {
          key: SubscriptionTierKey.GROWTH,
          name: "Kuza (Growth)",
          maxPortfolioProjects: 15,
          maxPortfolioImagesPerProject: 15,
          maxTeamMembers: 3,
          monthlyLeadCredits: 3,
          leadCreditDiscountPct: 20,
          boostsIncludedPerMonth: 1,
          platformFeePct: 7.5,
          featureFlags: { canReceiveMarketplaceLeads: true },
        },
      },
      boosts: [],
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-2", {
      skipCache: true,
    });

    expect(entitlements.trustTier).toBe(TrustTier.SKILLS_VERIFIED);
    expect(entitlements.features.canReceiveMarketplaceLeads).toBe(true);
    expect(entitlements.limits.maxPortfolioProjects).toBe(15);
    expect(entitlements.limits.maxPortfolioImagesPerProject).toBe(15);
    expect(entitlements.limits.maxTeamMembers).toBe(3);
    expect(entitlements.features.crmPipelineLevel).toBe("FULL");
    expect(entitlements.discounts.leadCreditDiscountPct).toBe(20);
  });

  it("correctly calculates Founding Pro active comp period and permanent discount", async () => {
    const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months in future

    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-3",
      trustTier: TrustTier.LICENSE_VERIFIED,
      subscription: {
        id: "sub-3",
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        isFoundingPro: true,
        foundingProDiscountPct: 15,
        foundingProUntil: futureDate,
        plan: {
          key: SubscriptionTierKey.GROWTH,
          name: "Kuza (Growth)",
          maxPortfolioProjects: 15,
          maxPortfolioImagesPerProject: 15,
          maxTeamMembers: 3,
          monthlyLeadCredits: 3,
          leadCreditDiscountPct: 20,
          boostsIncludedPerMonth: 1,
          platformFeePct: 7.5,
          featureFlags: { canReceiveMarketplaceLeads: true },
        },
      },
      boosts: [],
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-3", {
      skipCache: true,
    });

    expect(entitlements.isFoundingPro).toBe(true);
    expect(entitlements.isCompedPeriodActive).toBe(true);
    expect(entitlements.discounts.foundingProDiscountPct).toBe(15);
  });

  it("defaults to FREE plan limits if pro has no active subscription", async () => {
    (prisma.professionalProfile.findUnique as any).mockResolvedValue({
      userId: "pro-4",
      trustTier: TrustTier.ID_VERIFIED,
      subscription: null,
      boosts: [],
      badges: [],
    });

    const entitlements = await resolveEntitlements("pro-4", {
      skipCache: true,
    });

    expect(entitlements.subscriptionTier).toBe(SubscriptionTierKey.FREE);
    expect(entitlements.limits.maxPortfolioProjects).toBe(3);
    expect(entitlements.limits.maxPortfolioImagesPerProject).toBe(5);
    expect(entitlements.limits.maxQuotesPerMonth).toBe(5);
    expect(entitlements.limits.maxTeamMembers).toBe(1);
    expect(entitlements.features.analyticsDepthDays).toBe(7);
  });
});
