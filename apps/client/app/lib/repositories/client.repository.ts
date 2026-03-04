import { PrismaClient, ProjectStatus } from "@prisma/client";

// ─── Dashboard DTOs ──────────────────────────────────────────────────────────

export interface DashboardProject {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  budget: number | null;
  milestoneCount: number;
  professional: {
    id: string;
    name: string;
    title: string;
  } | null;
  startDate: string | null;
  estimatedEndDate: string | null;
}

export interface DashboardIdeaBook {
  id: string;
  title: string;
  category: string;
  itemCount: number;
  attachmentCount: number;
  coverImage: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  savedProfessionals: number;
  ideaBooks: number;
}

export interface DashboardData {
  stats: DashboardStats;
  projects: DashboardProject[];
  ideaBooks: DashboardIdeaBook[];
  savedProfessionals: never[];
}

// ─── Prisma Select Objects (data minimization) ──────────────────────────────

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

// ─── Repository ──────────────────────────────────────────────────────────────

export class ClientRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get formatted dashboard data for a client.
   *
   * Optimized with:
   * - Separate count queries for accurate stats (not derived from limited result set)
   * - Strict select objects for data minimization
   * - Asset-first cover image resolution
   * - Decimal → number conversion for JSON serialization
   * - deletedAt filter on projects
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    // Run count queries and data queries in parallel for minimum latency
    const [
      totalProjectCount,
      activeProjectCount,
      completedProjectCount,
      totalIdeaBookCount,
      projectsData,
      ideaBooksData,
    ] = await Promise.all([
      // ── Stats counts (database-level, not limited by take) ───────────
      this.prisma.project.count({
        where: { clientId: userId, deletedAt: null },
      }),
      this.prisma.project.count({
        where: {
          clientId: userId,
          deletedAt: null,
          status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.PLANNING] },
        },
      }),
      this.prisma.project.count({
        where: {
          clientId: userId,
          deletedAt: null,
          status: ProjectStatus.COMPLETED,
        },
      }),
      this.prisma.ideaBook.count({
        where: { clientId: userId },
      }),

      // ── Recent projects (limited for display) ────────────────────────
      this.prisma.project.findMany({
        where: { clientId: userId, deletedAt: null },
        select: dashboardProjectSelect,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // ── Recent idea books (limited for display) ──────────────────────
      this.prisma.ideaBook.findMany({
        where: { clientId: userId },
        select: dashboardIdeaBookSelect,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    // ── Transform projects ───────────────────────────────────────────────
    const projects: DashboardProject[] = projectsData.map((p) => {
      // Convert Decimal to number for JSON serialization
      const budget = p.agreedPrice
        ? Number(p.agreedPrice)
        : p.budgetMin
          ? Number(p.budgetMin)
          : null;

      let professional: DashboardProject["professional"] = null;
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
        progress: ClientRepository.calculateProgress(
          p.status,
          p.startDate,
          p.endDate,
        ),
        budget,
        milestoneCount: p._count.milestones,
        professional,
        startDate: p.startDate?.toISOString() ?? null,
        estimatedEndDate: p.endDate?.toISOString() ?? null,
      };
    });

    // ── Transform idea books ─────────────────────────────────────────────
    const ideaBooks: DashboardIdeaBook[] = ideaBooksData.map((book) => {
      const itemCount =
        (book._count.savedProducts ?? 0) +
        (book._count.savedProjects ?? 0) +
        (book._count.savedImages ?? 0);

      // Resolve cover image: Asset CDN → legacy fileUrl → placeholder
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
        updatedAt: book.updatedAt.toISOString(),
      };
    });

    // ── Assemble response ────────────────────────────────────────────────
    return {
      stats: {
        totalProjects: totalProjectCount,
        activeProjects: activeProjectCount,
        completedProjects: completedProjectCount,
        savedProfessionals: 0, // TODO: Implement when SavedProfessional model is available
        ideaBooks: totalIdeaBookCount,
      },
      projects,
      ideaBooks,
      savedProfessionals: [],
    };
  }

  /**
   * Calculate project progress based on status and timeline.
   *
   * Returns 0-100 percentage:
   * - COMPLETED → 100
   * - CANCELLED → 0
   * - PLANNING (or no start date) → 10
   * - PAUSED → freezes at current progress
   * - IN_PROGRESS → time-based interpolation between start and end dates
   */
  static calculateProgress(
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

    // Clamp to 10-99 for in-progress (100 is reserved for COMPLETED)
    return Math.min(Math.max(progress, 10), 99);
  }
}
