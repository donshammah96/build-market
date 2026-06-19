import { prisma, type Prisma } from "@build/db";
import type {
  LeadDetails,
  LeadListItem,
  LeadListQuery,
  LeadStatsResult,
  UpdateLeadInput,
} from "./contracts";

export async function listLeads(query: LeadListQuery): Promise<LeadListItem[]> {
  const where = buildLeadWhere(query);
  const leads = await prisma.lead.findMany({
    where,
    skip: query.skip,
    take: query.limit,
    orderBy: { [query.sortBy]: query.sortOrder },
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
  });

  return leads.map((lead) => ({
    id: lead.id,
    clientName: lead.clientName,
    clientEmail: lead.clientEmail,
    clientPhone: lead.clientPhone,
    projectType: lead.projectType,
    status: lead.status,
    source: lead.source,
    location: lead.location,
    budget: lead.budget ? lead.budget.toString() : null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    professional: {
      userId: lead.professional.userId,
      companyName: lead.professional.companyName,
      email: lead.professional.user.email,
      firstName: lead.professional.user.firstName,
      lastName: lead.professional.user.lastName,
    },
  }));
}

export async function countLeads(query: LeadListQuery): Promise<number> {
  return prisma.lead.count({ where: buildLeadWhere(query) });
}

export async function findLeadById(id: string): Promise<LeadDetails | null> {
  const lead = await prisma.lead.findUnique({
    where: { id },
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

  if (!lead) return null;

  return {
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
}

export async function updateLeadById(
  id: string,
  data: UpdateLeadInput,
): Promise<{
  id: string;
  clientName: string;
  status: string;
  updatedAt: Date;
}> {
  const updateData: Prisma.LeadUpdateInput = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.followUpDate !== undefined) {
    updateData.followUpDate = data.followUpDate
      ? new Date(data.followUpDate)
      : null;
  }

  return prisma.lead.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      clientName: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function deleteLeadById(
  id: string,
): Promise<{ id: string; clientName: string }> {
  return prisma.lead.delete({
    where: { id },
    select: { id: true, clientName: true },
  });
}

export async function bulkUpdateStatus(
  leadIds: string[],
  status: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST",
): Promise<{ count: number }> {
  return prisma.lead.updateMany({
    where: { id: { in: leadIds } },
    data: { status },
  });
}

export async function findLeadsForExport(query: LeadListQuery) {
  const where = buildLeadWhere(query);
  return prisma.lead.findMany({
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
}

export async function getLeadStats(): Promise<LeadStatsResult> {
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
}

export const leadsRepository = {
  listLeads,
  countLeads,
  findLeadById,
  updateLeadById,
  deleteLeadById,
  getLeadStats,
  bulkUpdateStatus,
  findLeadsForExport,
};

function buildLeadWhere(query: LeadListQuery): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  if (query.search) {
    where.OR = [
      { clientName: { contains: query.search, mode: "insensitive" } },
      { clientEmail: { contains: query.search, mode: "insensitive" } },
      {
        professional: {
          companyName: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;
  if (query.projectType) where.projectType = query.projectType;
  if (query.professionalId) where.professionalId = query.professionalId;

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = query.dateFrom;
    if (query.dateTo) where.createdAt.lte = query.dateTo;
  }

  return where;
}
