"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma, Profession } from "@repo/db";
import { safeAction } from "./shared";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type ServiceCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  professionType: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  _count: {
    professionals: number;
  };
};

export type ServiceCategoryDetails = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  professionType: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  professionals: Array<{
    userId: string;
    companyName: string;
    verified: boolean;
  }>;
  _count: {
    professionals: number;
  };
};

// ============================================================================
// Schemas
// ============================================================================

const ServiceFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  professionType: z.string().optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(["name", "createdAt", "sortOrder"]).default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const CreateServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  professionType: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

const UpdateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  professionType: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type ServiceFilterInput = z.infer<typeof ServiceFilterSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of service categories.
 */
export async function getServiceCategories(
  filters: Partial<ServiceFilterInput> = {}
) {
  return safeAction("getServiceCategories", async () => {
    const validatedFilters = ServiceFilterSchema.parse(filters);
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build where clause
    const where: Prisma.ServiceCategoryWhereInput = {};

    if (validatedFilters.search) {
      where.OR = [
        { name: { contains: validatedFilters.search, mode: "insensitive" } },
        {
          description: {
            contains: validatedFilters.search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (validatedFilters.professionType) {
      where.professionType = validatedFilters.professionType as Profession;
    }

    const [categories, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip,
        take: validatedFilters.limit,
        orderBy: { [validatedFilters.sortBy]: validatedFilters.sortOrder },
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
          _count: {
            select: { professionals: true },
          },
        },
      }),
      prisma.serviceCategory.count({ where }),
    ]);

    return {
      categories: categories as ServiceCategoryListItem[],
      meta: {
        total,
        page: validatedFilters.page,
        limit: validatedFilters.limit,
        totalPages: Math.ceil(total / validatedFilters.limit),
      },
      filters: validatedFilters,
    };
  });
}

/**
 * Fetches complete service category details.
 */
export async function getServiceCategoryDetails(categoryId: string) {
  return safeAction("getServiceCategoryDetails", async () => {
    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      include: {
        professionals: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
          },
          take: 20,
        },
        _count: {
          select: { professionals: true },
        },
      },
    });

    if (!category) throw new Error("Service category not found");

    return category as ServiceCategoryDetails;
  });
}

/**
 * Creates a new service category.
 */
export async function createServiceCategory(data: CreateServiceInput) {
  return safeAction("createServiceCategory", async () => {
    const validated = CreateServiceSchema.parse(data);

    // Generate unique slug
    let slug = generateSlug(validated.name);
    const existingSlug = await prisma.serviceCategory.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const category = await prisma.serviceCategory.create({
      data: {
        ...validated,
        slug,
        professionType: validated.professionType as Profession | undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    revalidatePath("/services");

    return {
      created: true,
      category,
    };
  });
}

/**
 * Updates a service category.
 */
export async function updateServiceCategory(
  categoryId: string,
  data: UpdateServiceInput
) {
  return safeAction("updateServiceCategory", async () => {
    const validated = UpdateServiceSchema.parse(data);

    // If name is being updated, update slug too
    let updateData: Prisma.ServiceCategoryUpdateInput = {
      ...validated,
      professionType: validated.professionType as Profession | undefined,
    };
    if (validated.name) {
      let slug = generateSlug(validated.name);
      const existingSlug = await prisma.serviceCategory.findFirst({
        where: { slug, NOT: { id: categoryId } },
      });
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }
      updateData = {
        ...validated,
        slug,
        professionType: validated.professionType as Profession | undefined,
      };
    }

    const category = await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
      },
    });

    revalidatePath("/services");
    revalidatePath(`/services/${categoryId}`);

    return {
      updated: true,
      category,
    };
  });
}

/**
 * Toggles service category active status.
 */
export async function toggleServiceCategoryActive(categoryId: string) {
  return safeAction("toggleServiceCategoryActive", async () => {
    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) throw new Error("Service category not found");

    const updated = await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: { isActive: !category.isActive },
    });

    revalidatePath("/services");

    return {
      toggled: true,
      category: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
      },
    };
  });
}

/**
 * Deletes a service category.
 */
export async function deleteServiceCategory(categoryId: string) {
  return safeAction("deleteServiceCategory", async () => {
    // Check if category has professionals
    const count = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { _count: { select: { professionals: true } } },
    });

    if (count && count._count.professionals > 0) {
      throw new Error(
        `Cannot delete category with ${count._count.professionals} associated professionals. Remove associations first.`
      );
    }

    const category = await prisma.serviceCategory.delete({
      where: { id: categoryId },
      select: { id: true, name: true },
    });

    revalidatePath("/services");

    return {
      deleted: true,
      categoryId: category.id,
      categoryName: category.name,
    };
  });
}

/**
 * Reorders service categories.
 */
export async function reorderServiceCategories(
  categories: Array<{ id: string; sortOrder: number }>
) {
  return safeAction("reorderServiceCategories", async () => {
    // Update all categories in a transaction
    await prisma.$transaction(
      categories.map((cat) =>
        prisma.serviceCategory.update({
          where: { id: cat.id },
          data: { sortOrder: cat.sortOrder },
        })
      )
    );

    revalidatePath("/services");

    return {
      reordered: true,
      count: categories.length,
    };
  });
}

/**
 * Gets service category statistics.
 */
export async function getServiceCategoryStats() {
  return safeAction("getServiceCategoryStats", async () => {
    const [totalCategories, activeCategories, byProfessionType, topCategories] =
      await Promise.all([
        prisma.serviceCategory.count(),
        prisma.serviceCategory.count({ where: { isActive: true } }),
        prisma.serviceCategory.groupBy({
          by: ["professionType"],
          _count: { id: true },
        }),
        prisma.serviceCategory.findMany({
          orderBy: { professionals: { _count: "desc" } },
          take: 10,
          select: {
            id: true,
            name: true,
            _count: { select: { professionals: true } },
          },
        }),
      ]);

    return {
      total: totalCategories,
      active: activeCategories,
      inactive: totalCategories - activeCategories,
      byProfessionType: byProfessionType.map((p) => ({
        professionType: p.professionType || "Unspecified",
        count: p._count.id,
      })),
      topCategories: topCategories.map((c) => ({
        id: c.id,
        name: c.name,
        professionalCount: c._count.professionals,
      })),
    };
  });
}
