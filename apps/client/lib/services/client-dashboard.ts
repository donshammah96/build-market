/**
 * Client Dashboard Service Layer
 *
 * Business logic for client dashboard data aggregation.
 * Delegates to ClientRepository for data access and transformation.
 */
import { prisma } from "../db";
import { ClientRepository } from "@/lib/repositories/client.repository";

export type {
  DashboardData,
  DashboardStats,
  DashboardProject,
  DashboardIdeaBook,
} from "@/lib/repositories/client.repository";

export async function getClientDashboardData(userId: string) {
  const repo = new ClientRepository(prisma);
  return repo.getDashboardData(userId);
}
