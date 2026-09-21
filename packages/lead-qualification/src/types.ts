/**
 * @build/lead-qualification
 *
 * Types and interfaces for the Pre-Qualified Leads Confidence Scoring Engine.
 */

export type LandOwnershipStatus =
  | "OWNED_TITLED"
  | "OWNED_ALLOTMENT_LETTER"
  | "FAMILY_LAND"
  | "LEASED"
  | "PURCHASING_IN_PROGRESS"
  | "NONE";

export type ArchitecturalStage =
  | "NO_PLANS"
  | "CONCEPT_ONLY"
  | "APPROVED_DRAWINGS"
  | "COUNTY_APPROVED"
  | "UNDER_CONSTRUCTION";

export type BudgetReadiness =
  | "UNVERIFIED_ESTIMATE"
  | "SELF_DECLARED_WITH_RANGE"
  | "PROOF_OF_FUNDS"
  | "FINANCING_APPROVED"
  | "FINANCING_PENDING";

export type ConfidenceLabel = "high" | "medium" | "low";

export interface QualificationInput {
  landOwnershipStatus?: LandOwnershipStatus | null;
  landOwnershipVerified?: boolean | null; // document passed scanning + manual verification
  architecturalStage?: ArchitecturalStage | null;
  architecturalVerified?: boolean | null; // drawings uploaded and verified
  budgetReadiness?: BudgetReadiness | null;
  budgetVerified?: boolean | null; // proof of funds verified
  budgetRangeMin?: number | null;
  budgetRangeMax?: number | null;
  projectType?: string | null; // e.g. "residential", "commercial", "fit_out"
}

export interface QualificationBreakdown {
  landScore: number;
  landWeight: number;
  landWeightedScore: number;
  archScore: number;
  archWeight: number;
  archWeightedScore: number;
  budgetScore: number;
  budgetWeight: number;
  budgetWeightedScore: number;
}

export interface QualificationResult {
  confidenceScore: number; // 0.0 – 1.0 (clamped, rounded to 3 decimal places)
  confidenceLabel: ConfidenceLabel;
  ruleVersion: string; // e.g. "leads-v3"
  breakdown: QualificationBreakdown;
  summaryReasons: string[];
}
