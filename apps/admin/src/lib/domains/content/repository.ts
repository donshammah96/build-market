import { prisma, type Prisma } from "@build/db";
import type {
  ContentModerationItem,
  ContentModerationQuery,
} from "./contracts";

const USER_OWNER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

const STORE_INCLUDE = {
  professional: {
    include: {
      user: { select: USER_OWNER_SELECT },
    },
  },
} satisfies Prisma.StoreInclude;

const PROPERTY_INCLUDE = {
  agent: {
    include: {
      user: { select: USER_OWNER_SELECT },
    },
  },
} satisfies Prisma.PropertyInclude;

const PROJECT_INCLUDE = {
  professional: {
    include: {
      user: { select: USER_OWNER_SELECT },
    },
  },
  client: { select: USER_OWNER_SELECT },
} satisfies Prisma.ProjectInclude;

type StoreContentRow = Prisma.StoreGetPayload<{
  include: typeof STORE_INCLUDE;
}>;
type PropertyContentRow = Prisma.PropertyGetPayload<{
  include: typeof PROPERTY_INCLUDE;
}>;
type ProjectContentRow = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;

function storeWhere(query: ContentModerationQuery): Prisma.StoreWhereInput {
  return {
    deletedAt: null,
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { city: { contains: query.search, mode: "insensitive" } },
            {
              professional: {
                companyName: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

function propertyWhere(
  query: ContentModerationQuery,
): Prisma.PropertyWhereInput {
  return {
    deletedAt: null,
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { location: { contains: query.search, mode: "insensitive" } },
            {
              agent: {
                companyName: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

function projectWhere(query: ContentModerationQuery): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { siteAddress: { contains: query.search, mode: "insensitive" } },
            {
              professional: {
                companyName: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

function storeOrderByFor(
  query: ContentModerationQuery,
): Prisma.StoreOrderByWithRelationInput {
  if (query.sortBy === "title") {
    return { name: query.sortOrder };
  }
  return { [query.sortBy]: query.sortOrder };
}

function titledOrderByFor(query: ContentModerationQuery) {
  if (query.sortBy === "title") {
    return { title: query.sortOrder };
  }
  return { [query.sortBy]: query.sortOrder };
}

export async function listStoreContent(
  query: ContentModerationQuery,
): Promise<ContentModerationItem[]> {
  const rows = (await prisma.store.findMany({
    where: storeWhere(query),
    include: STORE_INCLUDE,
    orderBy: storeOrderByFor(query),
    skip: query.entityType === "store" ? query.skip : 0,
    ...(query.entityType === "store" ? { take: query.limit } : {}),
  })) as StoreContentRow[];

  return rows.map((store) => ({
    entityType: "store",
    entityId: store.id,
    title: store.name,
    status: store.verificationStatus,
    featured: store.featured,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    deletedAt: store.deletedAt,
    owner: {
      ...store.professional.user,
      companyName: store.professional.companyName,
    },
  }));
}

export async function countStoreContent(
  query: ContentModerationQuery,
): Promise<number> {
  return prisma.store.count({ where: storeWhere(query) });
}

export async function listPropertyContent(
  query: ContentModerationQuery,
): Promise<ContentModerationItem[]> {
  const rows = (await prisma.property.findMany({
    where: propertyWhere(query),
    include: PROPERTY_INCLUDE,
    orderBy: titledOrderByFor(query),
    skip: query.entityType === "property" ? query.skip : 0,
    ...(query.entityType === "property" ? { take: query.limit } : {}),
  })) as PropertyContentRow[];

  return rows.map((property) => ({
    entityType: "property",
    entityId: property.id,
    title: property.title,
    status: property.status,
    featured: property.featured,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    deletedAt: property.deletedAt,
    owner: {
      ...property.agent.user,
      companyName: property.agent.companyName,
    },
  }));
}

export async function countPropertyContent(
  query: ContentModerationQuery,
): Promise<number> {
  return prisma.property.count({ where: propertyWhere(query) });
}

export async function listProjectContent(
  query: ContentModerationQuery,
): Promise<ContentModerationItem[]> {
  const rows = (await prisma.project.findMany({
    where: projectWhere(query),
    include: PROJECT_INCLUDE,
    orderBy: titledOrderByFor(query),
    skip: query.entityType === "project" ? query.skip : 0,
    ...(query.entityType === "project" ? { take: query.limit } : {}),
  })) as ProjectContentRow[];

  return rows.map((project) => ({
    entityType: "project",
    entityId: project.id,
    title: project.title,
    status: project.status,
    featured: false,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    deletedAt: project.deletedAt,
    owner: project.professional
      ? {
          ...project.professional.user,
          companyName: project.professional.companyName,
        }
      : project.client,
  }));
}

export async function countProjectContent(
  query: ContentModerationQuery,
): Promise<number> {
  return prisma.project.count({ where: projectWhere(query) });
}

export const contentRepository = {
  listStoreContent,
  countStoreContent,
  listPropertyContent,
  countPropertyContent,
  listProjectContent,
  countProjectContent,
};
