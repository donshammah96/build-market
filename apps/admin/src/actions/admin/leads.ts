"use server";

import { revalidatePath } from "next/cache";
import { LeadSource, LeadStatus, Prisma, ProjectType, prisma } from "@build/db";
import { safeAction, logAdminAction } from "./shared";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type LeadListItem = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  projectType: string;
  status: string;
  source: string | null;
  location: string | null;
  budget: string | null;
  createdAt: Date;
  updatedAt: Date;
  professional: {
    userId: string;
    companyName: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

export type LeadDetails = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectType: string;
  status: string;
  source: string | null;
  location: string | null;
  budget: string | null;
  notes: string | null;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  professional: {
    userId: string;
    companyName: string;
    profession: string | null;
    verified: boolean;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
      phone: string | null;
    };
  };
};

// ============================================================================
// Schemas
// ============================================================================

const LeadFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  professionalId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "clientName", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const UpdateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional(),
  followUpDate: z.string().datetime().optional().nullable(),
});

export type LeadFilterInput = z.infer<typeof LeadFilterSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of leads with filtering and sorting.
 */
export async function getLeads(filters: Partial<LeadFilterInput> = {}) {
  return safeAction("getLeads", async () => {
    const validatedFilters = LeadFilterSchema.parse(filters);
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build where clause
    const where: Prisma.LeadWhereInput = {};

    if (validatedFilters.search) {
      where.OR = [
        {
          clientName: {
            contains: validatedFilters.search,
            mode: "insensitive",
          },
        },
        {
          clientEmail: {
            contains: validatedFilters.search,
            mode: "insensitive",
          },
        },
        {
          professional: {
            companyName: {
              contains: validatedFilters.search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (validatedFilters.status) where.status = validatedFilters.status;
    if (validatedFilters.source) where.source = validatedFilters.source;
    if (validatedFilters.projectType)
      where.projectType = validatedFilters.projectType;
    if (validatedFilters.professionalId)
      where.professionalId = validatedFilters.professionalId;

    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {};
      if (validatedFilters.dateFrom)
        where.createdAt.gte = new Date(validatedFilters.dateFrom);
      if (validatedFilters.dateTo)
        where.createdAt.lte = new Date(validatedFilters.dateTo);
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: validatedFilters.limit,
        orderBy: { [validatedFilters.sortBy]: validatedFilters.sortOrder },
        select: {
          id: true,
          clientName: true,
          clientEmail: true,
          clientPhone: true,
          projectType: true,
          status: true,
          source: true,
          location: true,
          budget: true,
          createdAt: true,
          updatedAt: true,
          professional: {
            select: {
              userId: true,
              companyName: true,
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    // Transform to flatten professional info
    const formattedLeads: LeadListItem[] = leads.map((lead) => ({
      ...lead,
      budget: lead.budget ? lead.budget.toString() : null,
      professional: {
        userId: lead.professional.userId,
        companyName: lead.professional.companyName,
        email: lead.professional.user.email,
        firstName: lead.professional.user.firstName,
        lastName: lead.professional.user.lastName,
      },
    }));

    return {
      leads: formattedLeads,
      meta: {
        total,
        page: validatedFilters.page,
        limit: validatedFilters.limit,
        totalPages: Math.ceil(total / validatedFilters.limit),
      },
      filters: validatedFilters,
    };
  });
}

/**
 * Fetches complete lead details.
 */
export async function getLeadDetails(leadId: string) {
  return safeAction("getLeadDetails", async () => {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!lead) throw new Error("Lead not found");

    const result: LeadDetails = {
      id: lead.id,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail ?? "",
      clientPhone: lead.clientPhone,
      projectType: lead.projectType,
      status: lead.status,
      source: lead.source,
      location: lead.location,
      budget: lead.budget ? lead.budget.toString() : null,
      notes: lead.notes,
      followUpDate: lead.followUpDate,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      professional: {
        userId: lead.professional.userId,
        companyName: lead.professional.companyName,
        profession: lead.professional.profession,
        verified: lead.professional.verified,
        user: lead.professional.user,
      },
    };

    return result;
  });
}

/**
 * Updates lead information.
 */
export async function updateLead(leadId: string, data: UpdateLeadInput) {
  return safeAction("updateLead", async ({ adminUserId }) => {
    const validated = UpdateLeadSchema.parse(data);

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...validated,
        followUpDate: validated.followUpDate
          ? new Date(validated.followUpDate)
          : null,
      },
      select: {
        id: true,
        clientName: true,
        status: true,
        updatedAt: true,
      },
    });

    // Log audit event
    await logAdminAction({
      userId: adminUserId,
      action: "UPDATE_LEAD",
      targetType: "lead",
      targetId: leadId,
      details: validated,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return {
      updated: true,
      lead,
    };
  });
}

/**
 * Deletes a lead.
 */
export async function deleteLead(leadId: string) {
  return safeAction("deleteLead", async () => {
    const lead = await prisma.lead.delete({
      where: { id: leadId },
      select: { id: true, clientName: true },
    });

    revalidatePath("/leads");

    return {
      deleted: true,
      leadId: lead.id,
      clientName: lead.clientName,
    };
  });
}

/**
 * Gets lead statistics for dashboard.
 */
export async function getLeadStats() {
  return safeAction("getLeadStats", async () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalLeads,
      byStatus,
      bySource,
      byProjectType,
      thisWeek,
      thisMonth,
      conversionRate,
      recentLeads,
      topProfessionals,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.lead.groupBy({
        by: ["projectType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      Promise.all([
        prisma.lead.count({ where: { status: "WON" } }),
        prisma.lead.count({ where: { status: { in: ["WON", "LOST"] } } }),
      ]).then(([won, total]) => (total > 0 ? (won / total) * 100 : 0)),
      prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clientName: true,
          projectType: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.lead.groupBy({
        by: ["professionalId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    // Get professional names for top performers
    const professionalIds = topProfessionals.map((p) => p.professionalId);
    const professionals = await prisma.professionalProfile.findMany({
      where: { userId: { in: professionalIds } },
      select: { userId: true, companyName: true },
    });

    const topProfessionalsWithNames = topProfessionals.map((p) => ({
      professionalId: p.professionalId,
      leadCount: p._count.id,
      companyName:
        professionals.find((prof) => prof.userId === p.professionalId)
          ?.companyName || "Unknown",
    }));

    return {
      total: totalLeads,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      bySource: bySource.map((s) => ({
        source: s.source || "Unknown",
        count: s._count.id,
      })),
      byProjectType: byProjectType.map((p) => ({
        projectType: p.projectType,
        count: p._count.id,
      })),
      thisWeek,
      thisMonth,
      conversionRate: Number(conversionRate.toFixed(2)),
      recent: recentLeads,
      topProfessionals: topProfessionalsWithNames,
    };
  });
}

/**
 * Bulk update lead status.
 */
export async function bulkUpdateLeadStatus(
  leadIds: string[],
  status: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST",
) {
  return safeAction("bulkUpdateLeadStatus", async ({ adminUserId }) => {
    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { status },
    });

    // Log audit events for each lead
    await Promise.all(
      leadIds.map((id) =>
        logAdminAction({
          userId: adminUserId,
          action: "UPDATE_LEAD_STATUS_BULK",
          targetType: "lead",
          targetId: id,
          details: { newStatus: status },
        }),
      ),
    );

    revalidatePath("/leads");

    return {
      updated: true,
      count: result.count,
      status,
    };
  });
}

/**
 * Export leads to CSV format data.
 */
export async function exportLeads(filters: Partial<LeadFilterInput> = {}) {
  return safeAction("exportLeads", async () => {
    const validatedFilters = LeadFilterSchema.parse({
      ...filters,
      limit: 1000,
    });

    const where: Prisma.LeadWhereInput = {};
    if (validatedFilters.status) where.status = validatedFilters.status;
    if (validatedFilters.source) where.source = validatedFilters.source;
    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {};
      if (validatedFilters.dateFrom)
        where.createdAt.gte = new Date(validatedFilters.dateFrom);
      if (validatedFilters.dateTo)
        where.createdAt.lte = new Date(validatedFilters.dateTo);
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            companyName: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    // Transform to CSV-friendly format
    const exportData = leads.map((lead) => ({
      id: lead.id,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail,
      clientPhone: lead.clientPhone || "",
      projectType: lead.projectType,
      status: lead.status,
      source: lead.source || "",
      location: lead.location || "",
      budget: lead.budget ? lead.budget.toString() : "",
      notes: lead.notes || "",
      professionalCompany: lead.professional.companyName,
      professionalEmail: lead.professional.user.email,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    }));

    return {
      data: exportData,
      count: exportData.length,
    };
  });
}
