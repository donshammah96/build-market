import { prisma } from "@build/db";
import type { Prisma } from "@prisma/client";
import {
  leadDetailSelect,
  leadListSelect,
  publicLeadCreateSelect,
  publicLeadStatusSelect,
} from "@/app/lib/validation/leads-validation";
import type {
  CreateLeadInput,
  CreatePublicLeadInput,
  UpdateLeadInput,
} from "@/app/lib/domains/leads/contracts";

export const leadsRepository = {
  listProfessionalLeads(
    where: Prisma.LeadWhereInput,
    skip: number,
    take: number,
  ) {
    return Promise.all([
      prisma.lead.findMany({
        where,
        select: leadListSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.lead.count({ where }),
    ]);
  },

  findProfessionalLeadById(leadId: string) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ...leadDetailSelect,
        professionalId: true,
      },
    });
  },

  createProfessionalLead(userId: string, data: CreateLeadInput) {
    return prisma.lead.create({
      data: {
        professionalId: userId,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        clientId: data.clientId || null,
        title: data.title,
        description: data.description,
        projectType: data.projectType,
        location: data.location,
        county: data.county,
        budget: data.budget,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        currency: data.currency,
        status: data.status,
        priority: data.priority,
        source: data.source,
        notes: data.notes,
        followUpDate: data.followUpDate
          ? new Date(data.followUpDate)
          : undefined,
      },
      select: leadListSelect,
    });
  },

  updateProfessionalLead(leadId: string, data: UpdateLeadInput) {
    const isWinning = data.status === "WON";

    return prisma.lead.update({
      where: { id: leadId },
      data: {
        ...data,
        clientEmail: data.clientEmail === "" ? null : data.clientEmail,
        clientId: data.clientId === null ? null : data.clientId || undefined,
        followUpDate:
          data.followUpDate === null
            ? null
            : data.followUpDate
              ? new Date(data.followUpDate)
              : undefined,
        lastContactedAt: data.lastContactedAt
          ? new Date(data.lastContactedAt)
          : undefined,
        ...(isWinning && { wonAt: new Date() }),
      },
      select: leadDetailSelect,
    });
  },

  deleteProfessionalLead(leadId: string) {
    return prisma.lead.delete({ where: { id: leadId } });
  },

  findProfessionalProfileForPublicLead(userId: string) {
    return prisma.professionalProfile.findUnique({
      where: { userId },
      select: { userId: true, companyName: true, verified: true },
    });
  },

  createPublicLead(input: CreatePublicLeadInput) {
    return prisma.lead.create({
      data: {
        professional: { connect: { userId: input.professionalId } },
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone ?? null,
        title: input.title,
        description: input.message,
        projectType: input.projectType,
        location: input.location ?? null,
        county: input.county,
        budget: input.budget,
        source: input.source,
        notes: input.message,
      },
      select: publicLeadCreateSelect,
    });
  },

  findPublicLeadStatus(leadId: string) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      select: publicLeadStatusSelect,
    });
  },
};
