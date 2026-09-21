import { prisma, type Prisma, Profession } from "@build/db";
import type {
  CreateServiceInput,
  ServiceCategoryDetails,
  ServiceCategoryListItem,
  ServiceFilterQuery,
  ServiceStatsResult,
  UpdateServiceInput,
} from "./contracts";

export async function listCategories(
  query: ServiceFilterQuery,
): Promise<ServiceCategoryListItem[]> {
  const where = buildCategoryWhere(query);
  const categories = await prisma.serviceCategory.findMany({
    where,
    skip: query.skip,
    take: query.limit,
    orderBy: { [query.sortBy]: query.sortOrder },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      professionType: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      services: {
        select: {
          offeredBy: {
            select: {
              professionalId: true,
            },
          },
        },
      },
    },
  });

  return categories.map((cat) => {
    const professionalIds = new Set<string>();
    cat.services.forEach((srv) => {
      srv.offeredBy.forEach((op) => {
        professionalIds.add(op.professionalId);
      });
    });

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      professionType: cat.professionType,
      isActive: cat.isActive,
      sortOrder: cat.sortOrder,
      createdAt: cat.createdAt,
      _count: {
        professionals: professionalIds.size,
      },
    };
  });
}

export async function countCategories(
  query: ServiceFilterQuery,
): Promise<number> {
  return prisma.serviceCategory.count({ where: buildCategoryWhere(query) });
}

export async function findCategoryById(
  id: string,
): Promise<ServiceCategoryDetails | null> {
  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    include: {
      services: {
        select: {
          offeredBy: {
            select: {
              professional: {
                select: {
                  userId: true,
                  companyName: true,
                  verified: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!category) return null;

  const professionalMap = new Map<
    string,
    { userId: string; companyName: string; verified: boolean }
  >();
  category.services.forEach((srv) => {
    srv.offeredBy.forEach((op) => {
      if (op.professional) {
        professionalMap.set(op.professional.userId, {
          userId: op.professional.userId,
          companyName: op.professional.companyName,
          verified: op.professional.verified,
        });
      }
    });
  });

  const professionals = Array.from(professionalMap.values()).slice(0, 20);

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    professionType: category.professionType,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    professionals,
    _count: {
      professionals: professionalMap.size,
    },
  };
}

export async function findCategoryBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  return prisma.serviceCategory.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function createCategory(
  data: CreateServiceInput & { slug: string },
): Promise<{ id: string; name: string; slug: string }> {
  const createData: Prisma.ServiceCategoryCreateInput = {
    name: data.name,
    slug: data.slug,
  };

  if (data.description !== undefined) {
    createData.description = data.description || null;
  }
  if (data.icon !== undefined) {
    createData.icon = data.icon || null;
  }
  if (data.professionType !== undefined) {
    createData.professionType = (data.professionType as Profession) || null;
  }
  if (data.isActive !== undefined) {
    createData.isActive = data.isActive;
  }
  if (data.sortOrder !== undefined) {
    createData.sortOrder = data.sortOrder;
  }

  return prisma.serviceCategory.create({
    data: createData,
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function updateCategoryById(
  id: string,
  data: UpdateServiceInput & { slug?: string },
): Promise<{ id: string; name: string; slug: string; updatedAt: Date }> {
  const updateData: Prisma.ServiceCategoryUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined)
    updateData.description = data.description || null;
  if (data.icon !== undefined) updateData.icon = data.icon || null;
  if (data.professionType !== undefined) {
    updateData.professionType = (data.professionType as Profession) || null;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.slug !== undefined) updateData.slug = data.slug;

  return prisma.serviceCategory.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
    },
  });
}

export async function deleteCategoryById(
  id: string,
): Promise<{ id: string; name: string }> {
  return prisma.serviceCategory.delete({
    where: { id },
    select: { id: true, name: true },
  });
}

export async function reorderCategories(
  categories: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  await prisma.$transaction(
    categories.map((cat) =>
      prisma.serviceCategory.update({
        where: { id: cat.id },
        data: { sortOrder: cat.sortOrder },
      }),
    ),
  );
}

export async function getCategoryStats(): Promise<ServiceStatsResult> {
  const [
    totalCategories,
    activeCategories,
    byProfessionType,
    categoriesWithServices,
  ] = await Promise.all([
    prisma.serviceCategory.count(),
    prisma.serviceCategory.count({ where: { isActive: true } }),
    prisma.serviceCategory.groupBy({
      by: ["professionType"],
      _count: { id: true },
    }),
    prisma.serviceCategory.findMany({
      select: {
        id: true,
        name: true,
        services: {
          select: {
            offeredBy: {
              select: {
                professionalId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const topCategories = categoriesWithServices
    .map((cat) => {
      const professionalIds = new Set<string>();
      cat.services.forEach((srv) => {
        srv.offeredBy.forEach((op) => {
          professionalIds.add(op.professionalId);
        });
      });
      return {
        id: cat.id,
        name: cat.name,
        professionalCount: professionalIds.size,
      };
    })
    .sort((a, b) => b.professionalCount - a.professionalCount)
    .slice(0, 10);

  return {
    total: totalCategories,
    active: activeCategories,
    inactive: totalCategories - activeCategories,
    byProfessionType: byProfessionType.map((p) => ({
      professionType: p.professionType || "Unspecified",
      count: p._count.id,
    })),
    topCategories,
  };
}

export const servicesRepository = {
  listCategories,
  countCategories,
  findCategoryById,
  findCategoryBySlug,
  createCategory,
  updateCategoryById,
  deleteCategoryById,
  reorderCategories,
  getCategoryStats,
};

function buildCategoryWhere(
  query: ServiceFilterQuery,
): Prisma.ServiceCategoryWhereInput {
  const where: Prisma.ServiceCategoryWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.professionType) {
    where.professionType = query.professionType;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  return where;
}
