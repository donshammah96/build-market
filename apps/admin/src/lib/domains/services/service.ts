import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  CreateServiceInput,
  ServiceCategoryDetails,
  ServiceFilterInput,
  ServiceFilterQuery,
  ServicePageResult,
  ServiceStatsResult,
  ServicesActor,
  ServicesDomainError,
  UpdateServiceInput,
} from "./contracts";
import { servicesRepository } from "./repository";
import { Profession } from "@build/db";

function requireViewContent(
  actor: ServicesActor,
): Result<true, ServicesDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.ok) {
    return err({
      code: "SERVICES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageContent(
  actor: ServicesActor,
): Result<true, ServicesDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.ok) {
    return err({
      code: "SERVICES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

export function buildServiceFilterQuery(
  input: ServiceFilterInput = {},
): Result<ServiceFilterQuery, ServicesDomainError> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

  return ok({
    page,
    limit,
    skip: (page - 1) * limit,
    search: input.search?.trim() || undefined,
    professionType: input.professionType
      ? (input.professionType as Profession)
      : undefined,
    isActive: input.isActive,
    sortBy: input.sortBy ?? "sortOrder",
    sortOrder: input.sortOrder ?? "asc",
  });
}

export async function listServicePage(
  actor: ServicesActor,
  input: ServiceFilterInput = {},
): Promise<Result<ServicePageResult, ServicesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const queryResult = buildServiceFilterQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [categories, total] = await Promise.all([
    servicesRepository.listCategories(query),
    servicesRepository.countCategories(query),
  ]);

  return ok({
    categories,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    filters: query,
  });
}

export async function getServiceCategoryDetails(
  actor: ServicesActor,
  categoryId: string,
): Promise<Result<ServiceCategoryDetails, ServicesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const category = await servicesRepository.findCategoryById(categoryId);
  if (!category) {
    return err({
      code: "SERVICES_NOT_FOUND",
      message: "Service category not found",
    });
  }

  return ok(category);
}

export async function createServiceCategory(
  actor: ServicesActor,
  data: CreateServiceInput,
): Promise<
  Result<
    { created: boolean; category: { id: string; name: string; slug: string } },
    ServicesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  if (!data.name.trim()) {
    return err({
      code: "SERVICES_VALIDATION_ERROR",
      message: "Category name is required",
    });
  }

  let slug = generateSlug(data.name);
  const existing = await servicesRepository.findCategoryBySlug(slug);
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const category = await servicesRepository.createCategory({
    ...data,
    slug,
  });

  return ok({ created: true, category });
}

export async function updateServiceCategory(
  actor: ServicesActor,
  categoryId: string,
  data: UpdateServiceInput,
): Promise<
  Result<
    {
      updated: boolean;
      category: { id: string; name: string; slug: string; updatedAt: Date };
    },
    ServicesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const categoryDetails = await servicesRepository.findCategoryById(categoryId);
  if (!categoryDetails) {
    return err({
      code: "SERVICES_NOT_FOUND",
      message: "Service category not found",
    });
  }

  let slug: string | undefined = undefined;
  if (data.name && data.name.trim() !== categoryDetails.name) {
    slug = generateSlug(data.name);
    const existing = await servicesRepository.findCategoryBySlug(slug);
    if (existing && existing.id !== categoryId) {
      slug = `${slug}-${Date.now()}`;
    }
  }

  const category = await servicesRepository.updateCategoryById(categoryId, {
    ...data,
    ...(slug ? { slug } : {}),
  });

  return ok({ updated: true, category });
}

export async function toggleServiceCategoryActive(
  actor: ServicesActor,
  categoryId: string,
): Promise<
  Result<
    {
      toggled: boolean;
      category: { id: string; name: string; isActive: boolean };
    },
    ServicesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const category = await servicesRepository.findCategoryById(categoryId);
  if (!category) {
    return err({
      code: "SERVICES_NOT_FOUND",
      message: "Service category not found",
    });
  }

  const updated = await servicesRepository.updateCategoryById(categoryId, {
    isActive: !category.isActive,
  });

  return ok({
    toggled: true,
    category: {
      id: updated.id,
      name: updated.name,
      isActive: !category.isActive,
    },
  });
}

export async function deleteServiceCategory(
  actor: ServicesActor,
  categoryId: string,
): Promise<
  Result<
    { deleted: boolean; categoryId: string; categoryName: string },
    ServicesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const count = await servicesRepository.findCategoryById(categoryId);
  if (!count) {
    return err({
      code: "SERVICES_NOT_FOUND",
      message: "Service category not found",
    });
  }

  if (count._count && count._count.professionals > 0) {
    return err({
      code: "SERVICES_DELETE_DENIED",
      message: `Cannot delete category with ${count._count.professionals} associated professionals. Remove associations first.`,
    });
  }

  const category = await servicesRepository.deleteCategoryById(categoryId);
  return ok({
    deleted: true,
    categoryId: category.id,
    categoryName: category.name,
  });
}

export async function reorderServiceCategories(
  actor: ServicesActor,
  categories: Array<{ id: string; sortOrder: number }>,
): Promise<Result<{ reordered: boolean; count: number }, ServicesDomainError>> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  await servicesRepository.reorderCategories(categories);
  return ok({ reordered: true, count: categories.length });
}

export async function getServiceCategoryStats(
  actor: ServicesActor,
): Promise<Result<ServiceStatsResult, ServicesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const stats = await servicesRepository.getCategoryStats();
  return ok(stats);
}

export const servicesService = {
  generateSlug,
  buildServiceFilterQuery,
  listServicePage,
  getServiceCategoryDetails,
  createServiceCategory,
  updateServiceCategory,
  toggleServiceCategoryActive,
  deleteServiceCategory,
  reorderServiceCategories,
  getServiceCategoryStats,
};
