"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "./shared";
import { servicesService } from "@/lib/domains/services/service";
import type {
  CreateServiceInput,
  ServiceFilterInput,
  UpdateServiceInput,
} from "@/lib/domains/services/contracts";

const ServiceFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(20),
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

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of service categories.
 */
export async function getServiceCategories(
  filters: Partial<ServiceFilterInput> = {},
) {
  return safeAction("getServiceCategories", async ({ actor }) => {
    const validatedFilters = parseActionInput(
      ServiceFilterSchema,
      filters,
      "Invalid filters",
    );
    const result = await servicesService.listServicePage(
      actor,
      validatedFilters,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Fetches complete service category details.
 */
export async function getServiceCategoryDetails(categoryId: string) {
  return safeAction("getServiceCategoryDetails", async ({ actor }) => {
    const parsedCategoryId = parseActionInput(
      z.string().min(1),
      categoryId,
      "Category ID is required",
    );
    const result = await servicesService.getServiceCategoryDetails(
      actor,
      parsedCategoryId,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Creates a new service category.
 */
export async function createServiceCategory(data: CreateServiceInput) {
  return safeAction("createServiceCategory", async ({ actor }) => {
    const validated = parseActionInput(
      CreateServiceSchema,
      data,
      "Invalid service category data",
    );
    const result = await servicesService.createServiceCategory(
      actor,
      validated,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/services");

    return result.data;
  });
}

/**
 * Updates a service category.
 */
export async function updateServiceCategory(
  categoryId: string,
  data: UpdateServiceInput,
) {
  return safeAction("updateServiceCategory", async ({ actor }) => {
    const parsedCategoryId = parseActionInput(
      z.string().min(1),
      categoryId,
      "Category ID is required",
    );
    const validated = parseActionInput(
      UpdateServiceSchema,
      data,
      "Invalid update data",
    );
    const result = await servicesService.updateServiceCategory(
      actor,
      parsedCategoryId,
      validated,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/services");
    revalidatePath(`/services/${parsedCategoryId}`);

    return result.data;
  });
}

/**
 * Toggles service category active status.
 */
export async function toggleServiceCategoryActive(categoryId: string) {
  return safeAction("toggleServiceCategoryActive", async ({ actor }) => {
    const parsedCategoryId = parseActionInput(
      z.string().min(1),
      categoryId,
      "Category ID is required",
    );
    const result = await servicesService.toggleServiceCategoryActive(
      actor,
      parsedCategoryId,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/services");

    return result.data;
  });
}

/**
 * Deletes a service category.
 */
export async function deleteServiceCategory(categoryId: string) {
  return safeAction("deleteServiceCategory", async ({ actor }) => {
    const parsedCategoryId = parseActionInput(
      z.string().min(1),
      categoryId,
      "Category ID is required",
    );
    const result = await servicesService.deleteServiceCategory(
      actor,
      parsedCategoryId,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/services");

    return result.data;
  });
}

/**
 * Reorders service categories.
 */
export async function reorderServiceCategories(
  categories: Array<{ id: string; sortOrder: number }>,
) {
  return safeAction("reorderServiceCategories", async ({ actor }) => {
    const validatedCategories = parseActionInput(
      z.array(
        z.object({
          id: z.string().min(1),
          sortOrder: z.number(),
        }),
      ),
      categories,
      "Invalid categories format",
    );
    const result = await servicesService.reorderServiceCategories(
      actor,
      validatedCategories,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/services");

    return result.data;
  });
}

/**
 * Gets service category statistics.
 */
export async function getServiceCategoryStats() {
  return safeAction("getServiceCategoryStats", async ({ actor }) => {
    const result = await servicesService.getServiceCategoryStats(actor);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}
