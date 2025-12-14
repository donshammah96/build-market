"use server";

import { safeAction } from "./shared";
import { prisma } from "@repo/db";

// ============================================================================
// Dashboard Statistics
// ============================================================================

export type DashboardStats = {
  userCount: number;
  professionalCount: number;
  verifiedProfessionalCount: number;
  activeProjectCount: number;
};

/**
 * Fetches platform-wide statistics for the admin dashboard.
 * Uses Promise.all for parallel queries to minimize latency.
 */
export async function getDashboardStats() {
  return safeAction("getDashboardStats", async (): Promise<DashboardStats> => {
    const [userCount, professionalCount, verifiedProfessionalCount, activeProjectCount] = await Promise.all([
      prisma.user.count(),
      prisma.professionalProfile.count(),
      prisma.professionalProfile.count({ where: { verified: true } }),
      prisma.project.count({ where: { status: "in_progress" } }),
    ]);

    return {
      userCount,
      professionalCount,
      verifiedProfessionalCount,
      activeProjectCount,
    };
  });
}
