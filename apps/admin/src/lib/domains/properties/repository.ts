import { prisma, County, VerificationStatus, type Prisma } from "@build/db";
import type {
  PropertyDetailResult,
  PropertyListItem,
  PropertyListQuery,
  PropertyStatsResult,
  PropertyStatusValue,
  PropertyUpdateInput,
} from "./contracts";

// ============================================================================
// Read
// ============================================================================

export async function listProperties(
  query: PropertyListQuery,
): Promise<PropertyListItem[]> {
  const where = buildPropertyWhere(query);
  const properties = await prisma.property.findMany({
    where,
    skip: query.skip,
    take: query.limit,
    orderBy: { [query.sortBy]: query.sortOrder },
    include: {
      agent: {
        select: {
          userId: true,
          companyName: true,
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      },
      images: {
        where: { isMain: true },
        take: 1,
        select: { url: true },
      },
    },
  });

  return properties.map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price),
    currency: p.currency,
    type: p.type,
    category: p.category,
    status: p.status,
    location: p.location,
    county: p.county ?? null,
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    lotSize: p.plotSize ?? null,
    parkingSpaces: p.parkingSpaces ?? null,
    areaSqFt: p.buildingSize ?? null,
    yearBuilt: p.yearBuilt ?? null,
    verificationStatus: p.verificationStatus ?? null,
    featured: p.featured,
    createdAt: p.createdAt,
    agent: p.agent
      ? {
          id: p.agent.userId,
          companyName: p.agent.companyName,
          email: p.agent.user.email,
          firstName: p.agent.user.firstName,
          lastName: p.agent.user.lastName,
        }
      : null,
    mainImage: p.images[0]?.url ?? null,
  }));
}

export async function countProperties(
  query: PropertyListQuery,
): Promise<number> {
  return prisma.property.count({ where: buildPropertyWhere(query) });
}

export async function findPropertyById(
  id: string,
): Promise<PropertyDetailResult | null> {
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      agent: {
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
        select: { id: true, url: true, caption: true, isMain: true },
        orderBy: { sortOrder: "asc" },
      },
      attachments: {
        select: { id: true, fileUrl: true, type: true },
      },
      _count: { select: { images: true, attachments: true } },
    },
  });

  if (!p) return null;

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price),
    currency: p.currency,
    type: p.type,
    category: p.category,
    status: p.status,
    location: p.location,
    address: p.address,
    county: p.county ?? "Unknown",
    constituency: p.constituency,
    neighbourhood: p.neighbourhood,
    latitude: p.latitude,
    longitude: p.longitude,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    areaSqFt: p.buildingSize ?? null,
    lotSize: p.plotSize ?? null,
    parkingSpaces: p.parkingSpaces,
    yearBuilt: p.yearBuilt ?? null,
    verified: p.verificationStatus === VerificationStatus.VERIFIED,
    featured: p.featured,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt,
    rejectionReason: p.rejectionReason,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    agent: {
      userId: p.agent?.userId ?? "",
      companyName: p.agent?.companyName ?? "",
      user: p.agent?.user ?? {
        id: "",
        email: "",
        firstName: null,
        lastName: null,
        avatar: null,
      },
    },
    images: p.images.map((img) => ({
      id: img.id,
      url: img.url ?? "",
      caption: img.caption ?? null,
      isMain: img.isMain,
    })),
    attachments: p.attachments.map((att) => ({
      id: att.id,
      fileUrl: att.fileUrl ?? "",
      type: att.type,
      isVerified: false,
    })),
    _count: p._count,
  };
}

export async function getPropertyStats(): Promise<PropertyStatsResult> {
  const [
    total,
    verified,
    pending,
    featured,
    byType,
    byCategory,
    byStatus,
    byCounty,
    recent,
    priceAgg,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.property.count({ where: { verificationStatus: "PENDING" } }),
    prisma.property.count({ where: { featured: true } }),
    prisma.property.groupBy({ by: ["type"], _count: { id: true } }),
    prisma.property.groupBy({ by: ["category"], _count: { id: true } }),
    prisma.property.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.property.groupBy({
      by: ["county"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.property.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, createdAt: true },
    }),
    prisma.property.aggregate({
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    total,
    verified,
    pending,
    featured,
    byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      count: c._count.id,
    })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    byCounty,
    recent,
    priceStats: {
      avg: priceAgg._avg.price ? Number(priceAgg._avg.price) : 0,
      min: priceAgg._min.price ? Number(priceAgg._min.price) : 0,
      max: priceAgg._max.price ? Number(priceAgg._max.price) : 0,
    },
  };
}

// ============================================================================
// Write
// ============================================================================

export async function updatePropertyById(
  id: string,
  data: PropertyUpdateInput,
): Promise<{
  id: string;
  title: string;
  featured: boolean;
  status: string;
  updatedAt: Date;
}> {
  const updateData: Prisma.PropertyUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.county !== undefined) updateData.county = data.county as County;
  if (data.featured !== undefined) updateData.featured = data.featured;

  return prisma.property.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      title: true,
      featured: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function updatePropertyVerification(
  id: string,
  patch: {
    verificationStatus: string;
    verifiedAt: Date | null;
    rejectionReason: string | null;
  },
): Promise<{ id: string; title: string; verificationStatus: string }> {
  return prisma.property.update({
    where: { id },
    data: {
      verificationStatus: patch.verificationStatus as VerificationStatus,
      verifiedAt: patch.verifiedAt,
      rejectionReason: patch.rejectionReason,
    },
    select: { id: true, title: true, verificationStatus: true },
  });
}

export async function updatePropertyStatus(
  id: string,
  status: PropertyStatusValue,
): Promise<{ id: string; title: string; status: string }> {
  return prisma.property.update({
    where: { id },
    data: { status },
    select: { id: true, title: true, status: true },
  });
}

export async function getPropertyFeaturedStatus(
  id: string,
): Promise<{ featured: boolean } | null> {
  return prisma.property.findUnique({
    where: { id },
    select: { featured: true },
  });
}

export async function updatePropertyFeatured(
  id: string,
  featured: boolean,
): Promise<{ id: string; title: string; featured: boolean }> {
  return prisma.property.update({
    where: { id },
    data: { featured },
    select: { id: true, title: true, featured: true },
  });
}

export async function deletePropertyById(
  id: string,
): Promise<{ id: string; title: string }> {
  return prisma.property.delete({
    where: { id },
    select: { id: true, title: true },
  });
}

// ============================================================================
// Facade
// ============================================================================

export const propertiesRepository = {
  listProperties,
  countProperties,
  findPropertyById,
  getPropertyStats,
  updatePropertyById,
  updatePropertyVerification,
  updatePropertyStatus,
  getPropertyFeaturedStatus,
  updatePropertyFeatured,
  deletePropertyById,
};

// ============================================================================
// Internal helper
// ============================================================================

function buildPropertyWhere(
  query: PropertyListQuery,
): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { location: { contains: query.search, mode: "insensitive" } },
      { address: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.type) where.type = query.type;
  if (query.category) where.category = query.category;
  if (query.status) where.status = query.status;
  if (query.county) where.county = query.county as County;
  if (query.verificationStatus)
    where.verificationStatus = query.verificationStatus as VerificationStatus;
  if (query.verified !== undefined)
    where.verificationStatus = query.verified
      ? VerificationStatus.VERIFIED
      : VerificationStatus.REJECTED;
  if (query.featured !== undefined) where.featured = query.featured;
  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice)
      (where.price as Prisma.DecimalFilter).gte = query.minPrice;
    if (query.maxPrice)
      (where.price as Prisma.DecimalFilter).lte = query.maxPrice;
  }

  return where;
}
