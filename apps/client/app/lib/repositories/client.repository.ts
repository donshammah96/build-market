import { PrismaClient, County, Prisma } from "@prisma/client";

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

export class ClientRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get dashboard data for a client
   */
  async getDashboardData(userId: string) {
    const [projects, ideaBooks, clientProfile] = await Promise.all([
      // Projects with professional and their services
      this.prisma.project.findMany({
        where: { clientId: userId },
        include: {
          professional: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              // Include services relation (many-to-many with ServiceCategory)
              services: {
                select: {
                  id: true,
                  name: true,
                },
                take: 1, // Only need first service for display title
              },
            },
          },
          _count: {
            select: {
              milestones: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10, // Limit for dashboard
      }),

      // Idea Books with cover image from attachments
      this.prisma.ideaBook.findMany({
        where: { clientId: userId },
        include: {
          attachments: {
            orderBy: { createdAt: "desc" },
            take: 1, // Only need first attachment for cover
            select: {
              url: true,
            },
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6, // Limit for dashboard
      }),

      // Client Profile
      this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { preferences: true },
      }),
    ]);

    return {
      projects,
      ideaBooks,
      clientProfile,
    };
  }

  /**
   * Upsert client profile
   * @param userId - User ID
   * @param data - Profile data (county is required for new profiles)
   */
  async upsertProfile(
    userId: string,
    data: ClientProfileData & { county: County }
  ) {
    const updateData: Prisma.ClientProfileUpdateInput = {
      address: data.address,
      city: data.city,
      county: data.county,
      zipCode: data.zipCode,
      preferences: data.preferences ?? Prisma.JsonNull,
    };

    return this.prisma.clientProfile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        county: data.county,
        address: data.address,
        city: data.city,
        zipCode: data.zipCode,
        preferences: data.preferences ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Calculate project progress based on status and dates
   */
  calculateProgress(project: ProjectData): number {
    if (project.status === "completed") return 100;
    if (project.status === "planning" || !project.startDate) return 20;

    const now = new Date();
    const start = new Date(project.startDate);
    const end = project.endDate ? new Date(project.endDate) : now;

    const total = end.getTime() - start.getTime();

    // Handle edge case: same start and end date
    if (total <= 0) return 50;

    const elapsed = now.getTime() - start.getTime();
    const progress = Math.round((elapsed / total) * 100);

    return Math.min(Math.max(progress, 0), 100);
  }
}
