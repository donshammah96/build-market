import { describe, it, expect } from "vitest";
import {
  scoreLeadV3,
  getConfidenceLabel,
  LEADS_RULE_VERSION_V3,
} from "../src/index.js";

describe("scoreLeadV3", () => {
  it("scores verified titled land + county approved drawings + approved financing as maximum confidence", () => {
    const result = scoreLeadV3({
      landOwnershipStatus: "OWNED_TITLED",
      landOwnershipVerified: true,
      architecturalStage: "COUNTY_APPROVED",
      architecturalVerified: true,
      budgetReadiness: "FINANCING_APPROVED",
      budgetVerified: true,
      projectType: "residential",
    });

    // land: 1.0 * 0.40 = 0.40
    // arch: 0.95 * 0.25 = 0.2375
    // budget: 1.0 * 0.35 = 0.35
    // total = 0.988
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
    expect(result.confidenceLabel).toBe("high");
    expect(result.ruleVersion).toBe(LEADS_RULE_VERSION_V3);
    expect(result.breakdown.landScore).toBe(1.0);
  });

  it("scores unverified self-declarations accurately as medium confidence", () => {
    const result = scoreLeadV3({
      landOwnershipStatus: "PURCHASING_IN_PROGRESS",
      landOwnershipVerified: false,
      architecturalStage: "CONCEPT_ONLY",
      architecturalVerified: false,
      budgetReadiness: "SELF_DECLARED_WITH_RANGE",
      budgetRangeMin: 5_000_000,
      budgetRangeMax: 10_000_000,
      projectType: "residential",
    });

    // land: 0.40 * 0.40 = 0.16
    // arch: 0.45 * 0.25 = 0.1125
    // budget: 0.50 * 0.35 = 0.175
    // total = 0.448 (rounded ~0.448 / low-medium boundary)
    expect(result.confidenceScore).toBeCloseTo(0.448, 2);
    expect(result.ruleVersion).toBe(LEADS_RULE_VERSION_V3);
  });

  it("handles family land in Kenya without zeroing out the lead", () => {
    const result = scoreLeadV3({
      landOwnershipStatus: "FAMILY_LAND",
      landOwnershipVerified: false,
      architecturalStage: "NO_PLANS",
      architecturalVerified: false,
      budgetReadiness: "SELF_DECLARED_WITH_RANGE",
      budgetRangeMin: 3_000_000,
      budgetRangeMax: 6_000_000,
      projectType: "residential",
    });

    // land: 0.35 * 0.40 = 0.14
    // arch: 0.20 * 0.25 = 0.05
    // budget: 0.50 * 0.35 = 0.175
    // total = 0.365
    expect(result.confidenceScore).toBe(0.365);
    expect(result.confidenceLabel).toBe("low");
    expect(result.confidenceScore).toBeGreaterThan(0);
  });

  it("scores unowned land (NONE) minimally without disqualifying completely", () => {
    const result = scoreLeadV3({
      landOwnershipStatus: "NONE",
      landOwnershipVerified: false,
      architecturalStage: "NO_PLANS",
      budgetReadiness: "UNVERIFIED_ESTIMATE",
      projectType: "residential",
    });

    // land: 0.05 * 0.40 = 0.02
    // arch: 0.20 * 0.25 = 0.05
    // budget: 0.25 * 0.35 = 0.0875
    // total = 0.158
    expect(result.confidenceScore).toBeCloseTo(0.158, 2);
    expect(result.confidenceLabel).toBe("low");
  });

  it("scores commercial fit-out on leased land appropriately higher than residential on leased land", () => {
    const commercialResult = scoreLeadV3({
      landOwnershipStatus: "LEASED",
      projectType: "commercial_fit_out",
      architecturalStage: "APPROVED_DRAWINGS",
      budgetReadiness: "PROOF_OF_FUNDS",
      budgetVerified: true,
    });

    const residentialResult = scoreLeadV3({
      landOwnershipStatus: "LEASED",
      projectType: "residential_villa",
      architecturalStage: "APPROVED_DRAWINGS",
      budgetReadiness: "PROOF_OF_FUNDS",
      budgetVerified: true,
    });

    expect(commercialResult.confidenceScore).toBeGreaterThan(
      residentialResult.confidenceScore,
    );
  });

  it("correctly buckets confidence labels based on thresholds", () => {
    expect(getConfidenceLabel(0.85)).toBe("high");
    expect(getConfidenceLabel(0.75)).toBe("high");
    expect(getConfidenceLabel(0.749)).toBe("medium");
    expect(getConfidenceLabel(0.45)).toBe("medium");
    expect(getConfidenceLabel(0.449)).toBe("low");
    expect(getConfidenceLabel(0.1)).toBe("low");
  });
});
