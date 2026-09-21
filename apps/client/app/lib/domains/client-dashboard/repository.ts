import { ProjectStatus } from "@prisma/client";
import { prisma } from "@build/db";
import { toClientDashboardDto } from "./mappers";
import type {
  DashboardDataDto,
  DashboardIdeaBookDto,
  DashboardProjectDto,
} from "./contracts";

const dashboardProjectSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  budgetMin: true,
  agreedPrice: true,
  startDate: true,
  endDate: true,
  professional: {
    select: {
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      offeredServices: {
        take: 1,
        select: {
          service: {
            select: { name: true },
          },
        },
      },
    },
  },
  _count: {
    select: { milestones: true },
  },
} as const;

const dashboardIdeaBookSelect = {
  id: true,
  title: true,
  category: true,
  updatedAt: true,
  _count: {
    select: {
      attachments: true,
      savedProducts: true,
      savedProjects: true,
      savedImages: true,
    },
  },
  attachments: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      asset: {
        select: { cdnUrl: true },
      },
      fileUrl: true,
    },
  },
} as const;

function calculateProgress(
  status: ProjectStatus,
  startDate: Date | null,
  endDate: Date | null,
): number {
  if (status === ProjectStatus.COMPLETED) return 100;
  if (status === ProjectStatus.CANCELLED) return 0;
  if (status === ProjectStatus.ARCHIVED) return 100;
  if (status === ProjectStatus.PLANNING || !startDate) return 10;

  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : now;

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 50;

  const elapsedMs = now.getTime() - start.getTime();
  const progress = Math.round((elapsedMs / totalMs) * 100);

  return Math.min(Math.max(progress, 10), 99);
}

export const clientDashboardRepository = {
  async getDashboardData(userId: string): Promise<DashboardDataDto> {
    const [
      totalProjectCount,
      activeProjectCount,
      completedProjectCount,
      totalIdeaBookCount,
      projectsData,
      ideaBooksData,
    ] = await Promise.all([
      prisma.project.count({
        where: { clientId: userId, deletedAt: null },
      }),
      prisma.project.count({
        where: {
          clientId: userId,
          deletedAt: null,
          status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.PLANNING] },
        },
      }),
      prisma.project.count({
        where: {
          clientId: userId,
          deletedAt: null,
          status: ProjectStatus.COMPLETED,
        },
      }),
      prisma.ideaBook.count({
        where: { clientId: userId },
      }),
      prisma.project.findMany({
        where: { clientId: userId, deletedAt: null },
        select: dashboardProjectSelect,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.ideaBook.findMany({
        where: { clientId: userId },
        select: dashboardIdeaBookSelect,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    const projects: DashboardProjectDto[] = projectsData.map((p) => {
      const budget = p.agreedPrice
        ? Number(p.agreedPrice)
        : p.budgetMin
          ? Number(p.budgetMin)
          : null;

      let professional: DashboardProjectDto["professional"] = null;
      if (p.professional) {
        const firstName = p.professional.user.firstName ?? "";
        const lastName = p.professional.user.lastName ?? "";
        const name =
          `${firstName} ${lastName}`.trim() || "Unknown Professional";
        const title =
          p.professional.offeredServices[0]?.service?.name ?? "Professional";
        professional = {
          id: p.professional.userId,
          name,
          title,
        };
      }

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        progress: calculateProgress(p.status, p.startDate, p.endDate),
        budget,
        milestoneCount: p._count.milestones,
        professional,
        startDate: p.startDate
          ? (toClientDashboardDto(p.startDate) as unknown as string)
          : null,
        estimatedEndDate: p.endDate
          ? (toClientDashboardDto(p.endDate) as unknown as string)
          : null,
      };
    });

    const ideaBooks: DashboardIdeaBookDto[] = ideaBooksData.map((book) => {
      const itemCount =
        (book._count.savedProducts ?? 0) +
        (book._count.savedProjects ?? 0) +
        (book._count.savedImages ?? 0);

      const firstAtt = book.attachments[0];
      let coverImage = "/placeholder.jpg";
      if (firstAtt) {
        if (firstAtt.asset?.cdnUrl) {
          coverImage = firstAtt.asset.cdnUrl;
        } else if (firstAtt.fileUrl) {
          coverImage = firstAtt.fileUrl;
        }
      }

      return {
        id: book.id,
        title: book.title,
        category: book.category,
        itemCount,
        attachmentCount: book._count.attachments,
        coverImage,
        updatedAt: toClientDashboardDto(book.updatedAt) as unknown as string,
      };
    });

    return {
      stats: {
        totalProjects: totalProjectCount,
        activeProjects: activeProjectCount,
        completedProjects: completedProjectCount,
        savedProfessionals: 0,
        ideaBooks: totalIdeaBookCount,
      },
      projects,
      ideaBooks,
      savedProfessionals: [],
    };
  },
};
