import {
  prisma,
  County,
  StoreType,
  StoreCategory,
  VerificationStatus,
  type Prisma,
} from "@build/db";
import type {
  StoreDetailResult,
  StoreListItem,
  StoreListQuery,
  StoreStatsResult,
  StoreUpdateInput,
} from "./contracts";

// ============================================================================
// Read
// ============================================================================

export async function listStores(
  query: StoreListQuery,
): Promise<StoreListItem[]> {
  const where = buildStoreWhere(query);
  const stores = await prisma.store.findMany({
    where,
    skip: query.skip,
    take: query.limit,
    orderBy: { [query.sortBy]: query.sortOrder },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      county: true,
      categories: true,
      storeType: true,
      verified: true,
      featured: true,
      createdAt: true,
      updatedAt: true,
      professional: {
        select: {
          userId: true,
          companyName: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      _count: { select: { products: true, orders: true } },
    },
  });

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    city: store.city,
    county: store.county,
    categories: store.categories,
    storeType: store.storeType,
    verified: store.verified,
    featured: store.featured,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    owner: store.professional
      ? {
          id: store.professional.userId,
          email: store.professional.user.email,
          firstName: store.professional.user.firstName,
          lastName: store.professional.user.lastName,
          companyName: store.professional.companyName,
        }
      : null,
    _count: store._count,
  }));
}

export async function countStores(query: StoreListQuery): Promise<number> {
  return prisma.store.count({ where: buildStoreWhere(query) });
}

export async function findStoreById(
  id: string,
): Promise<StoreDetailResult | null> {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      professional: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      },
      images: {
        select: { id: true, fileUrl: true, caption: true, isMain: true },
        orderBy: { sortOrder: "asc" },
      },
      products: {
        select: { id: true, name: true, price: true, isActive: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { products: true, orders: true, reviews: true } },
    },
  });

  if (!store) return null;

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    address: store.address,
    city: store.city,
    county: store.county ?? null,
    zipCode: store.zipCode ?? null,
    phone: store.contactPhone ?? null,
    email: store.email ?? null,
    website: store.website ?? null,
    categories: store.categories,
    storeType: store.storeType,
    verified: store.verified,
    featured: store.featured,
    verificationStatus: store.verificationStatus,
    verifiedAt: store.verifiedAt,
    rejectionReason: store.rejectionReason,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    images: store.images.map((img) => ({
      id: img.id,
      url: img.fileUrl ?? "",
      caption: img.caption ?? null,
      isMain: img.isMain,
    })),
    products: store.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      status: p.isActive ? "available" : "inactive",
    })),
    owner: store.professional,
    _count: store._count,
  };
}

export async function getStoreStats(): Promise<StoreStatsResult> {
  const [total, verified, pending, featured, byCategory, byCounty, recent] =
    await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { verified: true } }),
      prisma.store.count({ where: { verificationStatus: "PENDING" } }),
      prisma.store.count({ where: { featured: true } }),
      prisma.store.groupBy({ by: ["categories"], _count: { id: true } }),
      prisma.store.groupBy({
        by: ["county"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.store.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, verified: true, createdAt: true },
      }),
    ]);

  return { total, verified, pending, featured, byCategory, byCounty, recent };
}

// ============================================================================
// Write
// ============================================================================

export async function updateStoreById(
  id: string,
  data: StoreUpdateInput,
): Promise<{
  id: string;
  name: string;
  verified: boolean;
  featured: boolean;
  updatedAt: Date;
}> {
  const updateData: Prisma.StoreUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.county !== undefined) updateData.county = data.county as County;
  if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
  if (data.featured !== undefined) updateData.featured = data.featured;

  return prisma.store.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      verified: true,
      featured: true,
      updatedAt: true,
    },
  });
}

export async function updateStoreVerification(
  id: string,
  patch: {
    verified: boolean;
    verificationStatus: string;
    verifiedAt: Date | null;
    rejectionReason: string | null;
  },
): Promise<{ id: string; name: string; verified: boolean }> {
  return prisma.store.update({
    where: { id },
    data: {
      verified: patch.verified,
      verificationStatus: patch.verificationStatus as VerificationStatus,
      verifiedAt: patch.verifiedAt,
      rejectionReason: patch.rejectionReason,
    },
    select: { id: true, name: true, verified: true },
  });
}

export async function findStoreVerificationStatus(
  id: string,
): Promise<{ verificationStatus: string; name: string } | null> {
  return prisma.store.findUnique({
    where: { id },
    select: { verificationStatus: true, name: true },
  });
}

export async function getStoreFeaturedStatus(
  id: string,
): Promise<{ featured: boolean } | null> {
  return prisma.store.findUnique({
    where: { id },
    select: { featured: true },
  });
}

export async function updateStoreFeatured(
  id: string,
  featured: boolean,
): Promise<{ id: string; name: string; featured: boolean }> {
  return prisma.store.update({
    where: { id },
    data: { featured },
    select: { id: true, name: true, featured: true },
  });
}

export async function deleteStoreById(
  id: string,
): Promise<{ id: string; name: string }> {
  return prisma.store.delete({
    where: { id },
    select: { id: true, name: true },
  });
}

// ============================================================================
// Facade
// ============================================================================

export const storesRepository = {
  listStores,
  countStores,
  findStoreById,
  getStoreStats,
  updateStoreById,
  updateStoreVerification,
  findStoreVerificationStatus,
  getStoreFeaturedStatus,
  updateStoreFeatured,
  deleteStoreById,
};

// ============================================================================
// Internal helper
// ============================================================================

function buildStoreWhere(query: StoreListQuery): Prisma.StoreWhereInput {
  const where: Prisma.StoreWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { city: { contains: query.search, mode: "insensitive" } },
      {
        professional: {
          companyName: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (query.verified !== undefined) where.verified = query.verified;
  if (query.featured !== undefined) where.featured = query.featured;
  if (query.county) where.county = query.county as County;
  if (query.category)
    where.categories = { has: query.category as StoreCategory };
  if (query.storeType) where.storeType = query.storeType as StoreType;

  return where;
}
