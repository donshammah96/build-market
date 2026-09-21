import { describe, it, expect } from "vitest";
import { TrustTier } from "@build/db";
import {
  canReceiveMarketplaceLead,
  TRUST_TIER_WEIGHTS,
  getTrustTierFirstSqlOrderClause,
} from "../../../app/lib/domains/professionals/ranking";

describe("Trust-Tier-First Ranking Engine", () => {
  it("strictly prohibits UNVERIFIED (T0) from receiving marketplace leads", () => {
    expect(canReceiveMarketplaceLead(TrustTier.UNVERIFIED)).toBe(false);
  });

  it("permits ID_VERIFIED (T1), SKILLS_VERIFIED (T2), LICENSE_VERIFIED (T3), and ELITE (T4) to receive leads", () => {
    expect(canReceiveMarketplaceLead(TrustTier.ID_VERIFIED)).toBe(true);
    expect(canReceiveMarketplaceLead(TrustTier.SKILLS_VERIFIED)).toBe(true);
    expect(canReceiveMarketplaceLead(TrustTier.LICENSE_VERIFIED)).toBe(true);
    expect(canReceiveMarketplaceLead(TrustTier.ELITE)).toBe(true);
  });

  it("guarantees Trust Tier weight ordering is strictly monotonically increasing", () => {
    expect(TRUST_TIER_WEIGHTS[TrustTier.ELITE]).toBeGreaterThan(
      TRUST_TIER_WEIGHTS[TrustTier.LICENSE_VERIFIED],
    );
    expect(TRUST_TIER_WEIGHTS[TrustTier.LICENSE_VERIFIED]).toBeGreaterThan(
      TRUST_TIER_WEIGHTS[TrustTier.SKILLS_VERIFIED],
    );
    expect(TRUST_TIER_WEIGHTS[TrustTier.SKILLS_VERIFIED]).toBeGreaterThan(
      TRUST_TIER_WEIGHTS[TrustTier.ID_VERIFIED],
    );
    expect(TRUST_TIER_WEIGHTS[TrustTier.ID_VERIFIED]).toBeGreaterThan(
      TRUST_TIER_WEIGHTS[TrustTier.UNVERIFIED],
    );
  });

  it("generates SQL ordering that prioritizes trustTier CASE statement above boosts and subscriptions", () => {
    const clause = getTrustTierFirstSqlOrderClause();
    expect(clause).toContain('CASE p."trustTier"');
    expect(clause).toContain("ProfileBoost");
    expect(clause).toContain('sp."sortOrder"');
  });
});
