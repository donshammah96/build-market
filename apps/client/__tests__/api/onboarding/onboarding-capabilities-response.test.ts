import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    professionalProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  computeCapabilities,
  computeNextRoute,
} from "@/app/lib/domains/professionals/readiness.service";

describe("Onboarding response capabilities and routing contract", () => {
  it("computes capabilities and nextRoute for pending professional", () => {
    const caps = computeCapabilities("PENDING", false);
    const route = computeNextRoute("PENDING");

    expect(caps).toEqual({
      canAppearInSearch: false,
      canReceiveLeads: false,
      canCreateQuotes: false,
      canListProperties: false,
      canSellStoreItems: false,
      canWithdrawFunds: false,
      canEditProfile: true,
    });
    expect(route).toBe("/professional-portal/pending-verification");
  });

  it("computes capabilities and nextRoute for verified professional with complete profile", () => {
    const caps = computeCapabilities("VERIFIED", true);
    const route = computeNextRoute("VERIFIED");

    expect(caps).toEqual({
      canAppearInSearch: true,
      canReceiveLeads: true,
      canCreateQuotes: true,
      canListProperties: true,
      canSellStoreItems: true,
      canWithdrawFunds: true,
      canEditProfile: true,
    });
    expect(route).toBe("/professional-portal/dashboard");
  });
});
