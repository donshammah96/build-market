import { z } from "zod";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  MarketplaceLandOwnershipStatus,
  MarketplaceArchitecturalStage,
  MarketplaceBudgetReadiness,
  MarketplaceLeadStatus,
  MarketplaceLeadDocumentType,
} from "@build/db";
import type { QualificationBreakdown } from "@build/lead-qualification";

export const CreateMarketplaceLeadSchema = z.object({
  projectCounty: z.string().min(2, "County is required").max(100),
  projectType: z.string().min(2, "Project type is required").max(100),
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
});

export const UpdateMarketplaceLeadQualificationSchema = z.object({
  landOwnershipStatus: z
    .enum([
      "OWNED_TITLED",
      "OWNED_ALLOTMENT_LETTER",
      "FAMILY_LAND",
      "LEASED",
      "PURCHASING_IN_PROGRESS",
      "NONE",
    ])
    .optional(),
  architecturalStage: z
    .enum([
      "NO_PLANS",
      "CONCEPT_ONLY",
      "APPROVED_DRAWINGS",
      "COUNTY_APPROVED",
      "UNDER_CONSTRUCTION",
    ])
    .optional(),
  budgetReadiness: z
    .enum([
      "UNVERIFIED_ESTIMATE",
      "SELF_DECLARED_WITH_RANGE",
      "PROOF_OF_FUNDS",
      "FINANCING_APPROVED",
      "FINANCING_PENDING",
    ])
    .optional(),
  budgetRangeMin: z.number().int().nonnegative().optional(),
  budgetRangeMax: z.number().int().nonnegative().optional(),
});

export const AttachMarketplaceLeadDocumentSchema = z.object({
  type: z.enum([
    "TITLE_DEED",
    "ALLOTMENT_LETTER",
    "PROOF_OF_FUNDS",
    "APPROVED_DRAWINGS",
    "COUNTY_APPROVAL",
  ]),
  fileKey: z.string().min(5, "Valid file storage key required"),
});

export type CreateMarketplaceLeadInput = z.infer<
  typeof CreateMarketplaceLeadSchema
>;
export type UpdateMarketplaceLeadQualificationInput = z.infer<
  typeof UpdateMarketplaceLeadQualificationSchema
>;
export type AttachMarketplaceLeadDocumentInput = z.infer<
  typeof AttachMarketplaceLeadDocumentSchema
>;

export type MarketplaceLeadErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_state"
  | "invalid_input"
  | "already_accepted"
  | "scan_in_progress"
  | "internal";

export type MarketplaceLeadError = DomainError<MarketplaceLeadErrorCode>;

export type MarketplaceLeadResult<T> = Result<T, MarketplaceLeadError>;

export interface MaskedMarketplaceLeadDTO {
  routingEventId: string;
  leadId: string;
  projectCounty: string;
  projectType: string;
  title: string | null;
  description: string | null;
  matchScore: number;
  confidenceLabel: string;
  budgetReadiness: MarketplaceBudgetReadiness | null;
  budgetRangeMin: number | null;
  budgetRangeMax: number | null;
  landOwnershipStatus: MarketplaceLandOwnershipStatus | null;
  architecturalStage: MarketplaceArchitecturalStage | null;
  routedAt: string;
  outcome: string | null;
  isContactDisclosed: false;
}

export interface DisclosedMarketplaceLeadDTO {
  routingEventId: string;
  leadId: string;
  projectCounty: string;
  projectType: string;
  title: string | null;
  description: string | null;
  status: MarketplaceLeadStatus;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    email: string;
    phone: string | null;
  };
  qualification: {
    landOwnershipStatus: MarketplaceLandOwnershipStatus | null;
    architecturalStage: MarketplaceArchitecturalStage | null;
    budgetReadiness: MarketplaceBudgetReadiness | null;
    budgetRangeMin: number | null;
    budgetRangeMax: number | null;
    confidenceScore: number | null;
    confidenceLabel: string | null;
    ruleVersion: string | null;
    breakdown: QualificationBreakdown | null;
  } | null;
  documents: Array<{
    id: string;
    type: MarketplaceLeadDocumentType;
    scanStatus: string;
    createdAt: string;
  }>;
  matchScore: number;
  routedAt: string;
  acceptedAt: string;
  isContactDisclosed: true;
}

export interface ClientLeadStatusDTO {
  leadId: string;
  status: MarketplaceLeadStatus;
  projectCounty: string;
  projectType: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  qualification: {
    landOwnershipStatus: MarketplaceLandOwnershipStatus | null;
    architecturalStage: MarketplaceArchitecturalStage | null;
    budgetReadiness: MarketplaceBudgetReadiness | null;
    budgetRangeMin: number | null;
    budgetRangeMax: number | null;
    confidenceScore: number | null;
    confidenceLabel: string | null;
  } | null;
  documentCount: number;
  routingCount: number;
}
