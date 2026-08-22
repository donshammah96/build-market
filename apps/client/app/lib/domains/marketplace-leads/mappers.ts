import type {
  MarketplaceLandOwnershipStatus,
  MarketplaceArchitecturalStage,
  MarketplaceBudgetReadiness,
  MarketplaceLeadStatus,
  MarketplaceLeadDocumentType,
} from "@build/db";
import type { QualificationBreakdown } from "@build/lead-qualification";
import type {
  ClientLeadStatusDTO,
  DisclosedMarketplaceLeadDTO,
  MaskedMarketplaceLeadDTO,
} from "./contracts.js";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toClientLeadStatusDto(
  lead: {
    id: string;
    status: MarketplaceLeadStatus;
    projectCounty: string;
    projectType: string;
    title?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    qualification?: {
      landOwnershipStatus?: MarketplaceLandOwnershipStatus | null;
      architecturalStage?: MarketplaceArchitecturalStage | null;
      budgetReadiness?: MarketplaceBudgetReadiness | null;
      budgetRangeMin?: number | null;
      budgetRangeMax?: number | null;
      confidenceScore?: number | null;
      confidenceLabel?: string | null;
    } | null;
    documents?: Array<unknown> | null;
    routingEvents?: Array<unknown> | null;
  },
  qualificationOverride?: {
    landOwnershipStatus?: MarketplaceLandOwnershipStatus | null;
    architecturalStage?: MarketplaceArchitecturalStage | null;
    budgetReadiness?: MarketplaceBudgetReadiness | null;
    budgetRangeMin?: number | null;
    budgetRangeMax?: number | null;
    confidenceScore?: number | null;
    confidenceLabel?: string | null;
  } | null,
  countsOverride?: {
    documentCount?: number;
    routingCount?: number;
  },
): ClientLeadStatusDTO {
  const qual = qualificationOverride ?? lead.qualification ?? null;

  return {
    leadId: lead.id,
    status: lead.status,
    projectCounty: lead.projectCounty,
    projectType: lead.projectType,
    title: lead.title ?? null,
    createdAt: toIsoString(lead.createdAt),
    updatedAt: toIsoString(lead.updatedAt),
    qualification: qual
      ? {
          landOwnershipStatus: qual.landOwnershipStatus ?? null,
          architecturalStage: qual.architecturalStage ?? null,
          budgetReadiness: qual.budgetReadiness ?? null,
          budgetRangeMin: qual.budgetRangeMin ?? null,
          budgetRangeMax: qual.budgetRangeMax ?? null,
          confidenceScore: qual.confidenceScore ?? null,
          confidenceLabel: qual.confidenceLabel ?? null,
        }
      : null,
    documentCount: countsOverride?.documentCount ?? lead.documents?.length ?? 0,
    routingCount:
      countsOverride?.routingCount ?? lead.routingEvents?.length ?? 0,
  };
}

export function toMaskedMarketplaceLeadDto(ev: {
  id: string;
  matchScore: number;
  confidenceLabel: string;
  routedAt: Date | string;
  outcome?: string | null;
  lead: {
    id: string;
    projectCounty: string;
    projectType: string;
    title?: string | null;
    description?: string | null;
    qualification?: {
      budgetReadiness?: MarketplaceBudgetReadiness | null;
      budgetRangeMin?: number | null;
      budgetRangeMax?: number | null;
      landOwnershipStatus?: MarketplaceLandOwnershipStatus | null;
      architecturalStage?: MarketplaceArchitecturalStage | null;
    } | null;
  };
}): MaskedMarketplaceLeadDTO {
  return {
    routingEventId: ev.id,
    leadId: ev.lead.id,
    projectCounty: ev.lead.projectCounty,
    projectType: ev.lead.projectType,
    title: ev.lead.title ?? null,
    description: ev.lead.description ?? null,
    matchScore: ev.matchScore,
    confidenceLabel: ev.confidenceLabel,
    budgetReadiness: ev.lead.qualification?.budgetReadiness ?? null,
    budgetRangeMin: ev.lead.qualification?.budgetRangeMin ?? null,
    budgetRangeMax: ev.lead.qualification?.budgetRangeMax ?? null,
    landOwnershipStatus: ev.lead.qualification?.landOwnershipStatus ?? null,
    architecturalStage: ev.lead.qualification?.architecturalStage ?? null,
    routedAt: toIsoString(ev.routedAt),
    outcome: ev.outcome ?? null,
    isContactDisclosed: false,
  };
}

export function toDisclosedMarketplaceLeadDto(fullRecord: {
  id: string;
  matchScore: number;
  routedAt: Date | string;
  contactDisclosedAt?: Date | string | null;
  lead: {
    id: string;
    projectCounty: string;
    projectType: string;
    title?: string | null;
    description?: string | null;
    status: MarketplaceLeadStatus;
    client: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      email: string;
      phone?: string | null;
    };
    qualification?: {
      landOwnershipStatus?: MarketplaceLandOwnershipStatus | null;
      architecturalStage?: MarketplaceArchitecturalStage | null;
      budgetReadiness?: MarketplaceBudgetReadiness | null;
      budgetRangeMin?: number | null;
      budgetRangeMax?: number | null;
      confidenceScore?: number | null;
      confidenceLabel?: string | null;
      scoringRuleVersion?: string | null;
      breakdownJson?: unknown;
    } | null;
    documents: Array<{
      id: string;
      type: MarketplaceLeadDocumentType;
      scanStatus: string;
      createdAt: Date | string;
    }>;
  };
}): DisclosedMarketplaceLeadDTO {
  const lead = fullRecord.lead;

  return {
    routingEventId: fullRecord.id,
    leadId: lead.id,
    projectCounty: lead.projectCounty,
    projectType: lead.projectType,
    title: lead.title ?? null,
    description: lead.description ?? null,
    status: lead.status,
    client: {
      id: lead.client.id,
      firstName: lead.client.firstName ?? null,
      lastName: lead.client.lastName ?? null,
      displayName: lead.client.displayName ?? null,
      email: lead.client.email,
      phone: lead.client.phone ?? null,
    },
    qualification: lead.qualification
      ? {
          landOwnershipStatus: lead.qualification.landOwnershipStatus ?? null,
          architecturalStage: lead.qualification.architecturalStage ?? null,
          budgetReadiness: lead.qualification.budgetReadiness ?? null,
          budgetRangeMin: lead.qualification.budgetRangeMin ?? null,
          budgetRangeMax: lead.qualification.budgetRangeMax ?? null,
          confidenceScore: lead.qualification.confidenceScore ?? null,
          confidenceLabel: lead.qualification.confidenceLabel ?? null,
          ruleVersion: lead.qualification.scoringRuleVersion ?? null,
          breakdown:
            (lead.qualification
              .breakdownJson as unknown as QualificationBreakdown) ?? null,
        }
      : null,
    documents: lead.documents.map((d) => ({
      id: d.id,
      type: d.type,
      scanStatus: d.scanStatus,
      createdAt: toIsoString(d.createdAt),
    })),
    matchScore: fullRecord.matchScore,
    routedAt: toIsoString(fullRecord.routedAt),
    acceptedAt: toIsoString(fullRecord.contactDisclosedAt || new Date()),
    isContactDisclosed: true,
  };
}
