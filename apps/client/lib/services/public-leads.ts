/**
 * Public Leads Service Layer
 *
 * Business logic for public lead submission and status lookup.
 * No authentication required — used by contact forms on professional profiles.
 */
import { prisma } from "../db";
import { createNotification } from "../notifications";
import {
  publicLeadCreateSelect,
  publicLeadStatusSelect,
  LEAD_STATUS_LABELS,
} from "@/lib/validation/leads-validation";
import type { CreatePublicLeadInput } from "@/lib/validation/leads-validation";

export type { CreatePublicLeadInput };

export interface PublicLeadStatusResult {
  id: string;
  title: string;
  projectType: string;
  location: string | null;
  status: string;
  statusLabel: string;
  professionalName: string;
  submittedAt: Date;
  lastUpdated: Date;
}

export async function createPublicLead(input: CreatePublicLeadInput) {
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: input.professionalId },
    select: { userId: true, companyName: true, verified: true },
  });

  if (!professional) {
    return { error: "professional_not_found" as const };
  }

  const lead = await prisma.lead.create({
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

  createNotification({
    userId: input.professionalId,
    title: "New Lead Received",
    message: `New inquiry from ${input.clientName}: ${input.title}`,
    type: "LEAD",
    link: "/professional-portal/leads",
  }).catch(() => {
    // Swallowed — notification failure should not break lead creation
  });

  return {
    data: {
      message: "Inquiry sent successfully",
      lead,
    },
  };
}

export async function getPublicLeadStatus(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: publicLeadStatusSelect,
  });

  if (!lead) {
    return { error: "not_found" as const };
  }

  const professionalName =
    lead.professional.companyName ||
    `${lead.professional.user.firstName} ${lead.professional.user.lastName}`.trim();

  return {
    data: {
      id: lead.id,
      title: lead.title,
      projectType: lead.projectType,
      location: lead.location,
      status: lead.status,
      statusLabel: LEAD_STATUS_LABELS[lead.status] ?? lead.status,
      professionalName,
      submittedAt: lead.createdAt,
      lastUpdated: lead.updatedAt,
    } satisfies PublicLeadStatusResult,
  };
}
