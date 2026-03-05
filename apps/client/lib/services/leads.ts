/**
 * Leads Service Layer
 *
 * Core business logic for professional-portal lead operations.
 * Used by both API routes and Server Actions.
 */
import { prisma } from "../db";
import { LeadStatus } from "@prisma/client";
import {
  leadListSelect,
  leadDetailSelect,
} from "@/lib/validation/leads-validation";
import type {
  LeadQueryInput,
  CreateLeadInput,
  UpdateLeadInput,
} from "@/lib/validation/leads-validation";

export type { LeadQueryInput, CreateLeadInput, UpdateLeadInput };

export type LeadListResult = {
  leads: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getProfessionalLeads(
  dbUserId: string,
  query: LeadQueryInput,
): Promise<LeadListResult> {
  const { page, limit, status, priority, source } = query;
  const skip = (page - 1) * limit;

  let statusFilter: LeadStatus | { in: LeadStatus[] } | undefined;
  if (status && status.length === 1) {
    statusFilter = status[0];
  } else if (status && status.length > 1) {
    statusFilter = { in: status };
  }

  const where = {
    professionalId: dbUserId,
    ...(statusFilter && { status: statusFilter }),
    ...(priority && { priority }),
    ...(source && { source }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadListSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createProfessionalLead(
  dbUserId: string,
  data: CreateLeadInput,
) {
  return prisma.lead.create({
    data: {
      professionalId: dbUserId,
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
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    },
    select: leadListSelect,
  });
}

export type GetLeadResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function getProfessionalLeadById(
  dbUserId: string,
  leadId: string,
): Promise<GetLeadResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      ...leadDetailSelect,
      professionalId: true,
    },
  });

  if (!lead) return { success: false, error: "not_found" };
  if (lead.professionalId !== dbUserId)
    return { success: false, error: "forbidden" };

  const { professionalId: _pid, ...data } = lead;
  return { success: true, data };
}

export type UpdateLeadResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function updateProfessionalLead(
  dbUserId: string,
  leadId: string,
  data: UpdateLeadInput,
): Promise<UpdateLeadResult> {
  const existing = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { professionalId: true, status: true },
  });

  if (!existing) return { success: false, error: "not_found" };
  if (existing.professionalId !== dbUserId)
    return { success: false, error: "forbidden" };

  const isWinning = data.status === "WON" && existing.status !== "WON";

  const lead = await prisma.lead.update({
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

  return { success: true, data: lead };
}

export type DeleteLeadResult =
  | { success: true; data: { message: string; leadId: string } }
  | { success: false; error: "not_found" | "forbidden" };

export async function deleteProfessionalLead(
  dbUserId: string,
  leadId: string,
): Promise<DeleteLeadResult> {
  const existing = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { professionalId: true },
  });

  if (!existing) return { success: false, error: "not_found" };
  if (existing.professionalId !== dbUserId)
    return { success: false, error: "forbidden" };

  await prisma.lead.delete({ where: { id: leadId } });

  return {
    success: true,
    data: { message: "Lead deleted successfully", leadId },
  };
}
