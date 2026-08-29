import { prisma, Prisma, type MarketplaceLeadDocumentType } from "@build/db";
import type {
  CreateMarketplaceLeadInput,
  UpdateMarketplaceLeadQualificationInput,
} from "./contracts";

export const marketplaceLeadsRepository = {
  createLead(clientId: string, data: CreateMarketplaceLeadInput) {
    return prisma.marketplaceLead.create({
      data: {
        clientId,
        projectCounty: data.projectCounty,
        projectType: data.projectType,
        title: data.title,
        description: data.description,
        status: "DRAFT",
        qualification: {
          create: {},
        },
      },
      include: {
        qualification: true,
        documents: true,
      },
    });
  },

  findLeadById(leadId: string) {
    return prisma.marketplaceLead.findUnique({
      where: { id: leadId },
      include: {
        qualification: true,
        documents: true,
        routingEvents: true,
      },
    });
  },

  findLeadForClient(leadId: string, clientId: string) {
    return prisma.marketplaceLead.findFirst({
      where: { id: leadId, clientId },
      include: {
        qualification: true,
        documents: true,
        routingEvents: {
          select: {
            id: true,
            outcome: true,
            routedAt: true,
          },
        },
      },
    });
  },

  listLeadsForClient(clientId: string) {
    return prisma.marketplaceLead.findMany({
      where: { clientId },
      include: {
        qualification: true,
        documents: true,
        routingEvents: {
          select: {
            id: true,
            outcome: true,
            routedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  updateLead(leadId: string, data: Prisma.MarketplaceLeadUpdateInput) {
    return prisma.marketplaceLead.update({
      where: { id: leadId },
      data,
      include: {
        qualification: true,
        documents: true,
      },
    });
  },

  upsertQualification(
    leadId: string,
    data: UpdateMarketplaceLeadQualificationInput,
  ) {
    return prisma.marketplaceLeadQualification.upsert({
      where: { leadId },
      create: {
        leadId,
        landOwnershipStatus: data.landOwnershipStatus,
        architecturalStage: data.architecturalStage,
        budgetReadiness: data.budgetReadiness,
        budgetRangeMin: data.budgetRangeMin,
        budgetRangeMax: data.budgetRangeMax,
      },
      update: {
        landOwnershipStatus: data.landOwnershipStatus,
        architecturalStage: data.architecturalStage,
        budgetReadiness: data.budgetReadiness,
        budgetRangeMin: data.budgetRangeMin,
        budgetRangeMax: data.budgetRangeMax,
      },
    });
  },

  updateScoredQualification(
    leadId: string,
    scoreData: {
      confidenceScore: number;
      confidenceLabel: string;
      scoringRuleVersion: string;
      breakdownJson: Prisma.InputJsonValue;
      scoredAt: Date;
    },
  ) {
    return prisma.marketplaceLeadQualification.update({
      where: { leadId },
      data: scoreData,
    });
  },

  attachDocument(
    leadId: string,
    type: MarketplaceLeadDocumentType,
    fileKey: string,
  ) {
    return prisma.marketplaceLeadDocument.create({
      data: {
        leadId,
        type,
        fileKey,
        scanStatus: "pending",
      },
    });
  },

  updateDocumentScanStatus(
    documentId: string,
    scanStatus: "clean" | "infected" | "failed",
  ) {
    return prisma.marketplaceLeadDocument.update({
      where: { id: documentId },
      data: {
        scanStatus,
        scannedAt: new Date(),
      },
    });
  },

  listRoutingEventsForProfessional(professionalId: string) {
    return prisma.marketplaceLeadRoutingEvent.findMany({
      where: { professionalId },
      include: {
        lead: {
          include: {
            qualification: true,
          },
        },
      },
      orderBy: { routedAt: "desc" },
    });
  },

  findRoutingEventWithDisclosedLead(
    routingEventId: string,
    professionalId: string,
  ) {
    return prisma.marketplaceLeadRoutingEvent.findFirst({
      where: {
        id: routingEventId,
        professionalId,
      },
      include: {
        lead: {
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
            qualification: true,
            documents: {
              select: {
                id: true,
                type: true,
                scanStatus: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
  },

  async acceptRoutingEvent(routingEventId: string, professionalId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.marketplaceLeadRoutingEvent.findFirst({
        where: { id: routingEventId, professionalId },
        include: {
          lead: {
            include: {
              client: true,
              qualification: true,
            },
          },
        },
      });

      if (!existing) {
        return null;
      }

      const now = new Date();

      // Stamp acceptance & disclosure
      const updatedEvent = await tx.marketplaceLeadRoutingEvent.update({
        where: { id: routingEventId },
        data: {
          outcome: "accepted",
          outcomeAt: now,
          contactDisclosedAt: now,
        },
      });

      // Automatically bridge/create a CRM Lead entry for the professional's pipeline
      await tx.lead.create({
        data: {
          professionalId,
          clientId: existing.lead.clientId,
          clientName:
            `${existing.lead.client.firstName || ""} ${existing.lead.client.lastName || ""}`.trim() ||
            existing.lead.client.displayName ||
            "Client",
          clientEmail: existing.lead.client.email,
          clientPhone: existing.lead.client.phone,
          title:
            existing.lead.title ||
            `${existing.lead.projectType} in ${existing.lead.projectCounty}`,
          description: existing.lead.description,
          status: "NEW",
          source: "PLATFORM_SEARCH",
          county: (existing.lead.projectCounty as any) || undefined,
          budgetMin: existing.lead.qualification?.budgetRangeMin
            ? new Prisma.Decimal(existing.lead.qualification.budgetRangeMin)
            : undefined,
          budgetMax: existing.lead.qualification?.budgetRangeMax
            ? new Prisma.Decimal(existing.lead.qualification.budgetRangeMax)
            : undefined,
        },
      });

      return updatedEvent;
    });
  },

  declineRoutingEvent(routingEventId: string, professionalId: string) {
    return prisma.marketplaceLeadRoutingEvent.updateMany({
      where: { id: routingEventId, professionalId, outcome: null },
      data: {
        outcome: "declined",
        outcomeAt: new Date(),
      },
    });
  },
};
