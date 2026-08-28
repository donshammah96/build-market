import type { QualificationInput } from "../types.js";

/**
 * Score budget readiness and financial solvency (0.0 – 1.0).
 *
 * Verifies financial backing or realistic estimation before routing to professionals.
 */
export function scoreBudgetReadiness(input: QualificationInput): {
  score: number;
  reason: string;
} {
  const readiness = input.budgetReadiness;
  const isVerified = Boolean(input.budgetVerified);
  const hasRange =
    typeof input.budgetRangeMin === "number" &&
    typeof input.budgetRangeMax === "number" &&
    input.budgetRangeMax > input.budgetRangeMin &&
    input.budgetRangeMin > 0;

  switch (readiness) {
    case "FINANCING_APPROVED":
      return {
        score: 1.0,
        reason: "Bank / institution construction financing approved",
      };

    case "PROOF_OF_FUNDS":
      if (isVerified) {
        return { score: 0.95, reason: "Proof of funds document verified" };
      }
      return {
        score: 0.8,
        reason: "Self-declared proof of funds (pending verification)",
      };

    case "FINANCING_PENDING":
      return {
        score: 0.6,
        reason: "Construction loan application pending approval",
      };

    case "SELF_DECLARED_WITH_RANGE":
      if (hasRange) {
        return {
          score: 0.5,
          reason: `Realistic budget range declared (KES ${input.budgetRangeMin?.toLocaleString()} - ${input.budgetRangeMax?.toLocaleString()})`,
        };
      }
      return { score: 0.4, reason: "Self-declared budget estimate" };

    case "UNVERIFIED_ESTIMATE":
      return { score: 0.25, reason: "Rough unverified estimate provided" };

    default:
      return { score: 0.0, reason: "Budget readiness not specified" };
  }
}
