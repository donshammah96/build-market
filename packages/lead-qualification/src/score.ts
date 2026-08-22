import type {
  ConfidenceLabel,
  QualificationInput,
  QualificationResult,
} from "./types.js";
import { scoreLandOwnership } from "./rules/land-ownership.js";
import { scoreArchitecturalStage } from "./rules/architectural-stage.js";
import { scoreBudgetReadiness } from "./rules/budget-readiness.js";

export const LEADS_RULE_VERSION_V3 = "leads-v3";

export const WEIGHTS_V3 = {
  landOwnership: 0.4,
  architectural: 0.25,
  budget: 0.35,
} as const;

export const CONFIDENCE_THRESHOLDS_V3 = {
  HIGH: 0.75,
  MEDIUM: 0.45,
} as const;

/**
 * Categorize a normalized confidence score into confidence label.
 */
export function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= CONFIDENCE_THRESHOLDS_V3.HIGH) return "high";
  if (score >= CONFIDENCE_THRESHOLDS_V3.MEDIUM) return "medium";
  return "low";
}

/**
 * Pure confidence scoring engine for Pre-Qualified Leads (v3).
 *
 * Combines weighted signals across land ownership, architectural stage,
 * and financial budget readiness into a 0.0 - 1.0 confidence score.
 */
export function scoreLeadV3(input: QualificationInput): QualificationResult {
  const land = scoreLandOwnership(input);
  const arch = scoreArchitecturalStage(input);
  const budget = scoreBudgetReadiness(input);

  const landWeightedScore = land.score * WEIGHTS_V3.landOwnership;
  const archWeightedScore = arch.score * WEIGHTS_V3.architectural;
  const budgetWeightedScore = budget.score * WEIGHTS_V3.budget;

  const rawScore = landWeightedScore + archWeightedScore + budgetWeightedScore;
  const clampedScore = Math.min(1.0, Math.max(0.0, rawScore));
  const confidenceScore = Math.round(clampedScore * 1000) / 1000;

  const confidenceLabel = getConfidenceLabel(confidenceScore);

  const summaryReasons: string[] = [
    land.reason,
    arch.reason,
    budget.reason,
  ].filter(Boolean);

  return {
    confidenceScore,
    confidenceLabel,
    ruleVersion: LEADS_RULE_VERSION_V3,
    breakdown: {
      landScore: land.score,
      landWeight: WEIGHTS_V3.landOwnership,
      landWeightedScore: Math.round(landWeightedScore * 1000) / 1000,
      archScore: arch.score,
      archWeight: WEIGHTS_V3.architectural,
      archWeightedScore: Math.round(archWeightedScore * 1000) / 1000,
      budgetScore: budget.score,
      budgetWeight: WEIGHTS_V3.budget,
      budgetWeightedScore: Math.round(budgetWeightedScore * 1000) / 1000,
    },
    summaryReasons,
  };
}

/**
 * Default scoring dispatcher.
 */
export function scoreLead(
  input: QualificationInput,
  version: string = LEADS_RULE_VERSION_V3,
): QualificationResult {
  switch (version) {
    case LEADS_RULE_VERSION_V3:
    default:
      return scoreLeadV3(input);
  }
}
