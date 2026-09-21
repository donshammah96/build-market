import { describe, expect, it } from "vitest";
import {
  computeCapabilities,
  computeNextRoute,
} from "@/app/lib/domains/professionals/readiness.service";

describe("ProfessionalReadinessService capability flags", () => {
  it("locks all capabilities when verification is REJECTED", () => {
    const caps = computeCapabilities("REJECTED", true);
    expect(caps.canAppearInSearch).toBe(false);
    expect(caps.canReceiveLeads).toBe(false);
    expect(caps.canCreateQuotes).toBe(false);
    expect(caps.canListProperties).toBe(false);
    expect(caps.canSellStoreItems).toBe(false);
    expect(caps.canWithdrawFunds).toBe(false);
    expect(caps.canEditProfile).toBe(false);
  });

  it("locks all capabilities when verification is SUSPENDED", () => {
    const caps = computeCapabilities("SUSPENDED", true);
    expect(caps.canAppearInSearch).toBe(false);
    expect(caps.canReceiveLeads).toBe(false);
    expect(caps.canCreateQuotes).toBe(false);
    expect(caps.canListProperties).toBe(false);
    expect(caps.canSellStoreItems).toBe(false);
    expect(caps.canWithdrawFunds).toBe(false);
    expect(caps.canEditProfile).toBe(false);
  });

  it("allows only canEditProfile when status is PENDING", () => {
    const caps = computeCapabilities("PENDING", false);
    expect(caps.canAppearInSearch).toBe(false);
    expect(caps.canReceiveLeads).toBe(false);
    expect(caps.canCreateQuotes).toBe(false);
    expect(caps.canListProperties).toBe(false);
    expect(caps.canSellStoreItems).toBe(false);
    expect(caps.canWithdrawFunds).toBe(false);
    expect(caps.canEditProfile).toBe(true);
  });

  it("allows only canEditProfile when status is NEEDS_CHANGES", () => {
    const caps = computeCapabilities("NEEDS_CHANGES", true);
    expect(caps.canAppearInSearch).toBe(false);
    expect(caps.canReceiveLeads).toBe(false);
    expect(caps.canEditProfile).toBe(true);
  });

  it("grants all capabilities when VERIFIED and profile is complete", () => {
    const caps = computeCapabilities("VERIFIED", true);
    expect(caps.canAppearInSearch).toBe(true);
    expect(caps.canReceiveLeads).toBe(true);
    expect(caps.canCreateQuotes).toBe(true);
    expect(caps.canListProperties).toBe(true);
    expect(caps.canSellStoreItems).toBe(true);
    expect(caps.canWithdrawFunds).toBe(true);
    expect(caps.canEditProfile).toBe(true);
  });

  it("restricts search and leads when VERIFIED but profile is incomplete", () => {
    const caps = computeCapabilities("VERIFIED", false);
    expect(caps.canAppearInSearch).toBe(false);
    expect(caps.canReceiveLeads).toBe(false);
    expect(caps.canCreateQuotes).toBe(true);
    expect(caps.canEditProfile).toBe(true);
  });

  describe("computeNextRoute", () => {
    it("routes VERIFIED professionals to dashboard", () => {
      expect(computeNextRoute("VERIFIED")).toBe(
        "/professional-portal/dashboard",
      );
    });

    it("routes PENDING professionals to pending verification page", () => {
      expect(computeNextRoute("PENDING")).toBe(
        "/professional-portal/pending-verification",
      );
    });

    it("routes NEEDS_CHANGES professionals to pending verification page", () => {
      expect(computeNextRoute("NEEDS_CHANGES")).toBe(
        "/professional-portal/pending-verification",
      );
    });
  });
});
