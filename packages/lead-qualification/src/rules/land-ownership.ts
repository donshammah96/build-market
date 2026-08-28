import type { QualificationInput } from "../types.js";

/**
 * Score land ownership readiness (0.0 – 1.0).
 *
 * Land ownership is the highest-risk factor for construction projects in Kenya.
 * Titled land with verified deed represents highest certainty (1.0).
 * Family land and purchasing-in-progress carry actionable value and must not be zeroed out.
 */
export function scoreLandOwnership(input: QualificationInput): {
  score: number;
  reason: string;
} {
  const status = input.landOwnershipStatus;
  const isVerified = Boolean(input.landOwnershipVerified);
  const projectType = (input.projectType || "").toLowerCase();

  switch (status) {
    case "OWNED_TITLED":
      if (isVerified) {
        return { score: 1.0, reason: "Title deed uploaded and verified" };
      }
      return {
        score: 0.85,
        reason: "Self-declared titled land (pending document verification)",
      };

    case "OWNED_ALLOTMENT_LETTER":
      if (isVerified) {
        return {
          score: 0.75,
          reason: "Allotment letter uploaded and verified",
        };
      }
      return {
        score: 0.6,
        reason:
          "Self-declared allotment letter (pending document verification)",
      };

    case "PURCHASING_IN_PROGRESS":
      return {
        score: 0.4,
        reason:
          "Land purchase in progress (fundable for preliminary architectural work)",
      };

    case "FAMILY_LAND":
      return {
        score: 0.35,
        reason:
          "Family land (viable for planning, carries succession/consent timeline risks)",
      };

    case "LEASED":
      if (
        projectType.includes("commercial") ||
        projectType.includes("fit_out") ||
        projectType.includes("renovation")
      ) {
        return {
          score: 0.7,
          reason: "Leased property viable for commercial fit-out / renovation",
        };
      }
      return { score: 0.3, reason: "Leased land for development" };

    case "NONE":
      return {
        score: 0.05,
        reason: "No land secured yet (preliminary design/feasibility inquiry)",
      };

    default:
      return { score: 0.0, reason: "Land ownership status not specified" };
  }
}
