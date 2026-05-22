import { Prisma, prisma } from "@build/db";
import type {
  ProjectDetails,
  ProjectFilterInput,
  ProjectListItem,
  ProjectPageResult,
} from "./contracts";

/**
 * Persistence-only layer for projects.
 * Handles Decimal → number serialization for budget at the persistence boundary.
 * No authorization. No response shaping beyond typed DTOs.
 */
export const projectsRepository = {
  async findPage(filters: ProjectFilterInput): Promise<ProjectPageResult> {
    const skip = (filters.page - 1) * filters.limit;

    const where: Prisma.ProjectWhereInput = filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {};

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          budgetMin: true,
          agreedPrice: true,
          createdAt: true,
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

    const formattedProjects: ProjectListItem[] = projects.map((project) => ({
      id: project.id,
      title: project.title,
      status: project.status,
      budget:
        project.agreedPrice !== null
          ? Number(project.agreedPrice)
          : project.budgetMin !== null
            ? Number(project.budgetMin)
            : null,
      createdAt: project.createdAt,
      client: project.client,
      professional: project.professional,
    }));

    return {
      projects: formattedProjects,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async findById(projectId: string): Promise<ProjectDetails | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        budgetMin: true,
        agreedPrice: true,
        startDate: true,
        endDate: true,
        clientId: true,
        professionalId: true,
        createdAt: true,
        updatedAt: true,
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
          select: {
            userId: true,
            companyName: true,
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

    if (!project) return null;

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      budget:
        project.agreedPrice !== null
          ? Number(project.agreedPrice)
          : project.budgetMin !== null
            ? Number(project.budgetMin)
            : null,
      startDate: project.startDate,
      endDate: project.endDate,
      clientId: project.clientId,
      professionalId: project.professionalId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      client: project.client,
      professional: project.professional,
    };
  },
};
