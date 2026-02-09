import { PrismaClient, County, Prisma, ProjectStatus } from "@prisma/client";

// Type for client profile upsert data
interface ClientProfileData {
  address?: string | null;
  city?: string | null;
  county?: County;
  zipCode?: string | null;
  preferences?: Prisma.InputJsonValue;
}

interface ProjectData {
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

// DTOs for Dashboard
export interface DashboardProject {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  budget: Prisma.Decimal | null;
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
  itemCount: number;
  attachmentCount: number;
  coverImage: string;
}

export interface DashboardData {
  stats: {
    activeProjects: number;
    completedProjects: number;
    savedProfessionals: number;
    ideaBooks: number;
  };
  projects: DashboardProject[];
  ideaBooks: DashboardIdeaBook[];
  savedProfessionals: any[]; // Placeholder
}

export class ClientRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get dashboard data for a client
   */

  /**
   * Get formatted dashboard data for a client
   * Optimized with strict selects and asset handling
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    // 1. Fetch Projects with optimized select
    const projectsData = await this.prisma.project.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        budgetMin: true, // using budgetMin as a proxy for budget display if agreedPrice is not set, or we can use agreedPrice
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
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 2. Fetch IdeaBooks with optimized select & asset resolution
    const ideaBooksData = await this.prisma.ideaBook.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        title: true,
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
          orderBy: { createdAt: "desc" },
          select: {
            // Prioritize Asset relation, fall back to legacy fileUrl
            asset: {
              select: {
                cdnUrl: true,
              },
            },
            fileUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });

    // 3. Transform Projects
    const projects: DashboardProject[] = projectsData.map((p) => {
      const budget = p.agreedPrice ?? p.budgetMin ?? null;
      
      let professional = null;
      if (p.professional) {
        const name = `${p.professional.user.firstName ?? ""} ${p.professional.user.lastName ?? ""}`.trim();
        const title = p.professional.offeredServices[0]?.service?.name ?? "Professional";
        professional = {
          id: p.professional.userId,
          name: name || "Unknown Professional",
          title,
        };
      }

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        progress: this.calculateProgress(p.status, p.startDate, p.endDate),
        budget,
        milestoneCount: p._count.milestones,
        professional,
        startDate: p.startDate?.toISOString() ?? null,
        estimatedEndDate: p.endDate?.toISOString() ?? null,
      };
    });

    // 4. Transform IdeaBooks
    const ideaBooks: DashboardIdeaBook[] = ideaBooksData.map((book) => {
      const itemCount =
        (book._count.savedProducts ?? 0) +
        (book._count.savedProjects ?? 0) +
        (book._count.savedImages ?? 0);

      // Resolve cover image from Asset > fileUrl > Placeholder
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
        itemCount,
        attachmentCount: book._count.attachments,
        coverImage,
      };
    });

    // 5. Calculate Stats
    const stats = {
      activeProjects: projects.filter(
        (p) => p.status === ProjectStatus.IN_PROGRESS || p.status === ProjectStatus.PLANNING
      ).length,
      completedProjects: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      savedProfessionals: 0, // TODO: Implement when SavedProfessional model is ready
      ideaBooks: ideaBooks.length,
    };

    return {
      stats,
      projects,
      ideaBooks,
      savedProfessionals: [],
    };
  }

  /**
   * Calculate project progress based on status and dates
   */
  private calculateProgress(
    status: ProjectStatus,
    startDate: Date | null,
    endDate: Date | null
  ): number {
    if (status === ProjectStatus.COMPLETED) return 100;
    if (status === ProjectStatus.PLANNING || !startDate) return 20;

    const now = new Date();
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : now;

    const total = end.getTime() - start.getTime();

    // Handle edge case: same start and end date
    if (total <= 0) return 50;

    const elapsed = now.getTime() - start.getTime();
    const progress = Math.round((elapsed / total) * 100);

    return Math.min(Math.max(progress, 0), 100);
  }
}
