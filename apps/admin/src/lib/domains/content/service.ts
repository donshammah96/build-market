import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ContentActor,
  ContentDomainError,
  ContentModerationInput,
  ContentModerationPage,
  ContentModerationQuery,
  ContentSortBy,
  ContentSortOrder,
} from "./contracts";
import { contentRepository } from "./repository";

const ENTITY_TYPES = ["all", "store", "property", "project"] as const;
const SORT_BY = ["createdAt", "updatedAt", "title"] as const;
const SORT_ORDER = ["asc", "desc"] as const;

function isOneOf<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function invalidFilter(message: string): ContentDomainError {
  return { code: "CONTENT_INVALID_FILTER", message };
}

function requireContentCapability(
  actor: ContentActor,
): Result<true, ContentDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.success) {
    return err({
      code: "CONTENT_POLICY_DENIED",
      message: policy.error.message,
    });
  }
  return ok(true);
}

export function buildContentModerationQuery(
  input: ContentModerationInput = {},
): Result<ContentModerationQuery, ContentDomainError> {
  const entityType = input.entityType ?? "all";
  const sortBy = input.sortBy ?? "createdAt";
  const sortOrder = input.sortOrder ?? "desc";

  if (!isOneOf(ENTITY_TYPES, entityType)) {
    return err(invalidFilter("Invalid content entity type"));
  }
  if (!isOneOf(SORT_BY, sortBy)) {
    return err(invalidFilter("Invalid content sort field"));
  }
  if (!isOneOf(SORT_ORDER, sortOrder)) {
    return err(invalidFilter("Invalid content sort order"));
  }

  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20)));
  const search = input.search?.trim();

  return ok({
    entityType,
    ...(search ? { search } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
    page,
    limit,
    sortBy,
    sortOrder,
    skip: (page - 1) * limit,
  });
}

function sortItems(
  items: ContentModerationPage["items"],
  sortBy: ContentSortBy,
  sortOrder: ContentSortOrder,
) {
  return [...items].sort((a, b) => {
    if (sortBy === "title") {
      return sortOrder === "desc"
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }

    const aTime = a[sortBy].getTime();
    const bTime = b[sortBy].getTime();
    return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
  });
}

async function listSingleEntity(query: ContentModerationQuery) {
  if (query.entityType === "store") {
    const [items, total] = await Promise.all([
      contentRepository.listStoreContent(query),
      contentRepository.countStoreContent(query),
    ]);
    return { items, total };
  }
  if (query.entityType === "property") {
    const [items, total] = await Promise.all([
      contentRepository.listPropertyContent(query),
      contentRepository.countPropertyContent(query),
    ]);
    return { items, total };
  }

  const [items, total] = await Promise.all([
    contentRepository.listProjectContent(query),
    contentRepository.countProjectContent(query),
  ]);
  return { items, total };
}

export async function listContentModerationQueue(
  actor: ContentActor,
  input: ContentModerationInput = {},
): Promise<Result<ContentModerationPage, ContentDomainError>> {
  const capability = requireContentCapability(actor);
  if (!capability.ok) return capability;

  const queryResult = buildContentModerationQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  if (query.entityType !== "all") {
    const { items, total } = await listSingleEntity(query);
    return ok({
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      filters: query,
    });
  }

  const [stores, properties, projects] = await Promise.all([
    contentRepository.listStoreContent(query),
    contentRepository.listPropertyContent(query),
    contentRepository.listProjectContent(query),
  ]);
  const combined = sortItems(
    [...stores, ...properties, ...projects],
    query.sortBy,
    query.sortOrder,
  );
  const items = combined.slice(query.skip, query.skip + query.limit);

  return ok({
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: combined.length,
      totalPages: Math.ceil(combined.length / query.limit),
    },
    filters: query,
  });
}

export const contentService = {
  buildContentModerationQuery,
  listContentModerationQueue,
};
