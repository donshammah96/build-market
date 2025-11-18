import { PrismaClient } from '@prisma/client';

export class ClientRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get dashboard data for a client
   */
  async getDashboardData(userId: string) {
    const [projects, ideaBooks, clientProfile] = await Promise.all([
      // Projects
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Idea Books
      this.prisma.ideaBook.findMany({
        where: { clientId: userId },
        orderBy: { updatedAt: 'desc' },
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
   */
  async upsertProfile(userId: string, data: any) {
    return this.prisma.clientProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /**
   * Calculate project progress
   */
  calculateProgress(project: any): number {
    if (project.status === 'completed') return 100;
    if (project.status === 'planning' || !project.startDate) return 20;

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

