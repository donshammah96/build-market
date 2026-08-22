/**
 * Marketplace Leads Verification Queue Adapter
 *
 * Provides data access and manual review capabilities for marketplace leads
 * in UNDER_REVIEW, NEEDS_INFO, or low-confidence states.
 */

import { prisma, type MarketplaceLeadStatus } from "@build/db";

export interface MarketplaceLeadReviewItem {
  id: string;
  clientId: string;
  projectCounty: string;
  projectType: string;
  title: string | null;
  status: MarketplaceLeadStatus;
  createdAt: string;
  qualification: {
    landOwnershipStatus: string | null;
    architecturalStage: string | null;
    budgetReadiness: string | null;
    budgetRangeMin: number | null;
    budgetRangeMax: number | null;
    confidenceScore: number | null;
    confidenceLabel: string | null;
    scoringRuleVersion: string | null;
    reviewedBy: string | null;
    reviewNotes: string | null;
  } | null;
  cleanDocumentCount: number;
  pendingDocumentCount: number;
  infectedDocumentCount: number;
}

export async function fetchMarketplaceLeadsReviewQueue(params?: {
  status?: MarketplaceLeadStatus;
  page?: number;
  pageSize?: number;
}): Promise<{
  leads: MarketplaceLeadReviewItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params?.page || 1);
  const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where = {
    status: params?.status || {
      in: ["UNDER_REVIEW", "NEEDS_INFO", "DRAFT"] as MarketplaceLeadStatus[],
    },
  };

  const [records, total] = await Promise.all([
    prisma.marketplaceLead.findMany({
      where,
      include: {
        qualification: true,
        documents: {
          select: {
            id: true,
            scanStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.marketplaceLead.count({ where }),
  ]);

  const leads: MarketplaceLeadReviewItem[] = records.map((lead) => ({
    id: lead.id,
    clientId: lead.clientId,
    projectCounty: lead.projectCounty,
    projectType: lead.projectType,
    title: lead.title,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
    qualification: lead.qualification
      ? {
          landOwnershipStatus: lead.qualification.landOwnershipStatus,
          architecturalStage: lead.qualification.architecturalStage,
          budgetReadiness: lead.qualification.budgetReadiness,
          budgetRangeMin: lead.qualification.budgetRangeMin,
          budgetRangeMax: lead.qualification.budgetRangeMax,
          confidenceScore: lead.qualification.confidenceScore,
          confidenceLabel: lead.qualification.confidenceLabel,
          scoringRuleVersion: lead.qualification.scoringRuleVersion,
          reviewedBy: lead.qualification.reviewedBy,
          reviewNotes: lead.qualification.reviewNotes,
        }
      : null,
    cleanDocumentCount: lead.documents.filter((d) => d.scanStatus === "clean")
      .length,
    pendingDocumentCount: lead.documents.filter(
      (d) => d.scanStatus === "pending",
    ).length,
    infectedDocumentCount: lead.documents.filter(
      (d) => d.scanStatus === "infected",
    ).length,
  }));

  return {
    leads,
    total,
    page,
    pageSize,
  };
}

export async function reviewMarketplaceLead(
  leadId: string,
  reviewerId: string,
  decision: {
    status: "QUALIFIED" | "NEEDS_INFO" | "DISQUALIFIED";
    reviewNotes?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.marketplaceLeadQualification.update({
      where: { leadId },
      data: {
        reviewedBy: reviewerId,
        reviewNotes: decision.reviewNotes,
        updatedAt: new Date(),
      },
    });

    return tx.marketplaceLead.update({
      where: { id: leadId },
      data: {
        status: decision.status,
      },
    });
  });
}
