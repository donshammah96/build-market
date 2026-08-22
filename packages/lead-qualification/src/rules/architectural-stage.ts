import type { QualificationInput } from "../types.js";

/**
 * Score architectural readiness (0.0 – 1.0).
 *
 * Measures progress through planning, statutory county approvals, and construction state.
 */
export function scoreArchitecturalStage(input: QualificationInput): {
  score: number;
  reason: string;
} {
  const stage = input.architecturalStage;
  const isVerified = Boolean(input.architecturalVerified);

  switch (stage) {
    case "UNDER_CONSTRUCTION":
      return {
        score: 1.0,
        reason:
          "Site under active construction (immediate QS / engineer / contractor engagement)",
      };

    case "COUNTY_APPROVED":
      if (isVerified) {
        return { score: 0.95, reason: "County statutory approvals verified" };
      }
      return { score: 0.85, reason: "Self-declared county approved drawings" };

    case "APPROVED_DRAWINGS":
      if (isVerified) {
        return {
          score: 0.8,
          reason: "Architectural drawings uploaded and verified",
        };
      }
      return { score: 0.7, reason: "Self-declared approved drawings" };

    case "CONCEPT_ONLY":
      return {
        score: 0.45,
        reason:
          "Concept sketch / idea stage (requires full architectural package)",
      };

    case "NO_PLANS":
      return {
        score: 0.2,
        reason:
          "No plans yet (greenfield client requiring preliminary design & scoping)",
      };

    default:
      return { score: 0.0, reason: "Architectural stage not specified" };
  }
}
