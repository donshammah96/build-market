// @ts-nocheck
"use server";

import { Prisma, prisma } from "@build/db";
import { safeAction } from "./shared";
import { PaginationSchema } from "./types";

// ============================================================================
// Types
// ============================================================================

export type ProjectListItem = {
  id: string;
  title: string;
  status: string;
  budget: number | null;
  createdAt: Date;
  client: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  professional: {
    companyName: string;
    user: { avatar: string | null };
  } | null;
};

export type ProjectDetails = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  budget: number | null;
  startDate: Date | null;
  endDate: Date | null;
  clientId: string | null;
  professionalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  } | null;
  professional: {
    userId: string;
    companyName: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      avatar: string | null;
    };
  } | null;
};

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of projects.
 * Searchable by title or description.
 * Budget is converted from Decimal to number for JSON serialization.
 */
export async function getProjects(page = 1, limit = 10, search = "") {
  return safeAction("getProjects", async () => {
    const valid = PaginationSchema.parse({ page, limit, search });
    const skip = (valid.page - 1) * valid.limit;

    const where: Prisma.ProjectWhereInput = valid.search
      ? {
          OR: [
            { title: { contains: valid.search, mode: "insensitive" } },
            { description: { contains: valid.search, mode: "insensitive" } },
          ],
        }
      : {};

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: valid.limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: { firstName: true, lastName: true, email: true },
          },
          professional: {
            select: {
              companyName: true,
              user: { select: { avatar: true } },
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    // Convert Decimal to number for serialization
    const formattedProjects: ProjectListItem[] = projects.map((project) => ({
      ...project,
      budget: project.budget ? Number(project.budget) : null,
    }));

    return {
      projects: formattedProjects,
      meta: {
        total,
        page: valid.page,
        limit: valid.limit,
        totalPages: Math.ceil(total / valid.limit),
      },
    };
  });
}

/**
 * Fetches complete project details with client and professional relations.
 * Budget is converted from Decimal to number.
 */
export async function getProjectDetails(projectId: string) {
  return safeAction("getProjectDetails", async (): Promise<ProjectDetails> => {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!project) throw new Error("Project not found");

    return {
      ...project,
      budget: project.budget ? Number(project.budget) : null,
    };
  });
}
