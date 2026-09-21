import { prisma } from "@build/db";
import type { DashboardStats } from "./contracts";

/**
 * Persistence-only layer for dashboard aggregate counts.
 * No authorization. No response shaping beyond plain TS types.
 */
export const dashboardRepository = {
  async getDashboardStats(): Promise<DashboardStats> {
    const [
      userCount,
      professionalCount,
      verifiedProfessionalCount,
      activeProjectCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.professionalProfile.count(),
      prisma.professionalProfile.count({ where: { verified: true } }),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
    ]);

    return {
      userCount,
      professionalCount,
      verifiedProfessionalCount,
      activeProjectCount,
    };
  },
};
