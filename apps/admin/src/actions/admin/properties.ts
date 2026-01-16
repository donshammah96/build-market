"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma, County, VerificationStatus } from "@repo/db";
import { safeAction, safeVerificationAction } from "./shared";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type PropertyListItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  type: string;
  category: string;
  status: string;
  location: string;
  county: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqFt: number | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  yearBuilt: number | null;
  verificationStatus: string | null;
  featured: boolean;
  createdAt: Date;
  agent: {
    id: string;
    companyName: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  mainImage: string | null;
};

export type PropertyDetails = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  type: string;
  category: string;
  status: string;
  // Location
  location: string;
  address: string | null;
  county: string;
  constituency: string | null;
  neighbourhood: string | null;
  latitude: number | null;
  longitude: number | null;
  // Features
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqFt: number | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  yearBuilt: number | null;
  // Verification
  verified: boolean;
  featured: boolean;
  verificationStatus: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Relations
  agent: {
    userId: string;
    companyName: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    };
  };
  images: Array<{
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }>;
  attachments: Array<{
    id: string;
    fileUrl: string;
    type: string; // Changed from fileType to type
    isVerified: boolean;
  }>;
  _count: {
    images: number;
    attachments: number;
  };
};

// ============================================================================
// Schemas
// ============================================================================

const PropertyFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  type: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL"])
    .optional(),
  verificationStatus: z
    .enum([
      VerificationStatus.PENDING,
      VerificationStatus.VERIFIED,
      VerificationStatus.REJECTED,
    ])
    .optional(),
  verified: z.boolean().optional(),
  featured: z.boolean().optional(),
  county: z.string().optional(),
  status: z.enum(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER"]).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sortBy: z
    .enum(["createdAt", "price", "title", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const UpdatePropertySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  type: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL"])
    .optional(),
  status: z.enum(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER"]).optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  county: z.nativeEnum(County).optional(),
  featured: z.boolean().optional(),
});

export type PropertyFilterInput = z.infer<typeof PropertyFilterSchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of properties with filtering and sorting.
 */
export async function getProperties(
  filters: Partial<PropertyFilterInput> = {}
) {
  return safeAction("getProperties", async () => {
    const validatedFilters = PropertyFilterSchema.parse(filters);
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build where clause
    const where: Prisma.PropertyWhereInput = {};

    if (validatedFilters.search) {
      where.OR = [
        { title: { contains: validatedFilters.search, mode: "insensitive" } },
        {
          description: {
            contains: validatedFilters.search,
            mode: "insensitive",
          },
        },
        {
          location: { contains: validatedFilters.search, mode: "insensitive" },
        },
        { address: { contains: validatedFilters.search, mode: "insensitive" } },
      ];
    }

    if (validatedFilters.type) where.type = validatedFilters.type;
    if (validatedFilters.category) where.category = validatedFilters.category;
    if (validatedFilters.status) where.status = validatedFilters.status;
    if (validatedFilters.county)
      where.county = validatedFilters.county as County;
    if (validatedFilters.verified !== undefined)
      where.verificationStatus = validatedFilters.verified
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED;
    if (validatedFilters.featured !== undefined)
      where.featured = validatedFilters.featured;

    if (validatedFilters.minPrice || validatedFilters.maxPrice) {
      where.price = {};
      if (validatedFilters.minPrice)
        where.price.gte = validatedFilters.minPrice;
      if (validatedFilters.maxPrice)
        where.price.lte = validatedFilters.maxPrice;
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: validatedFilters.limit,
        orderBy: { [validatedFilters.sortBy]: validatedFilters.sortOrder },
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          type: true,
          category: true,
          status: true,
          location: true,
          county: true,
          bedrooms: true,
          bathrooms: true,
          lotSize: true,
          parkingSpaces: true,
          areaSqFt: true,
          yearBuilt: true,
          verificationStatus: true,
          featured: true,
          createdAt: true,
          agent: {
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
          images: {
            where: { isMain: true },
            take: 1,
            select: { url: true },
          },
        },
      }),
      prisma.property.count({ where }),
    ]);

    // Transform to flatten data
    const formattedProperties: PropertyListItem[] = properties.map(
      (property) => ({
        ...property,
        price: Number(property.price),
        agent: property.agent
          ? {
              id: property.agent.userId,
              companyName: property.agent.companyName,
              email: property.agent.user.email,
              firstName: property.agent.user.firstName,
              lastName: property.agent.user.lastName,
            }
          : null,
        mainImage: property.images[0]?.url || null,
      })
    );

    return {
      properties: formattedProperties,
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
 * Fetches complete property details.
 */
export async function getPropertyDetails(propertyId: string) {
  return safeAction("getPropertyDetails", async () => {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
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
          select: {
            id: true,
            url: true,
            caption: true,
            isMain: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        attachments: {
          select: {
            id: true,
            fileUrl: true,
            type: true, // Changed from fileType
            isVerified: true,
          },
        },
        _count: {
          select: {
            images: true,
            attachments: true,
          },
        },
      },
    });

    if (!property) throw new Error("Property not found");

    // Explicitly construct the return object to match PropertyDetails
    const result: PropertyDetails = {
      id: property.id,
      title: property.title,
      description: property.description,
      price: Number(property.price),
      currency: property.currency,
      type: property.type,
      category: property.category,
      status: property.status,
      location: property.location,
      address: property.address,
      county: property.county,
      constituency: property.constituency,
      neighbourhood: property.neighbourhood,
      latitude: property.latitude,
      longitude: property.longitude,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaSqFt: property.areaSqFt,
      lotSize: property.lotSize,
      parkingSpaces: property.parkingSpaces,
      yearBuilt: property.yearBuilt ?? null,
      verified: property.verificationStatus === VerificationStatus.VERIFIED,
      featured: property.featured,
      verificationStatus: property.verificationStatus,
      verifiedAt: property.verifiedAt,
      rejectionReason: property.rejectionReason,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      agent: {
        userId: property.agent.userId,
        companyName: property.agent.companyName,
        user: property.agent.user,
      },
      images: property.images,
      attachments: property.attachments,
      _count: property._count,
    };

    return result;
  });
}

/**
 * Updates property information.
 */
export async function updateProperty(
  propertyId: string,
  data: UpdatePropertyInput
) {
  return safeAction("updateProperty", async () => {
    const validated = UpdatePropertySchema.parse(data);

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: validated,
      select: {
        id: true,
        title: true,
        featured: true,
        status: true,
        updatedAt: true,
      },
    });

    revalidatePath("/properties");
    revalidatePath(`/properties/${propertyId}`);

    return {
      updated: true,
      property,
    };
  });
}

/**
 * Toggles property featured status.
 */
export async function togglePropertyFeatured(propertyId: string) {
  return safeAction("togglePropertyFeatured", async () => {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { featured: true },
    });

    if (!property) throw new Error("Property not found");

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: { featured: !property.featured },
      select: { id: true, title: true, featured: true },
    });

    revalidatePath("/properties");

    return {
      toggled: true,
      property: updated,
    };
  });
}

/**
 * Verifies a property.
 */
export async function verifyProperty(propertyId: string, notes?: string) {
  return safeVerificationAction("verifyProperty", async ({ adminUserId }) => {
    const property = await prisma.property.update({
      where: { id: propertyId },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        rejectionReason: null,
      },
      select: { id: true, title: true, verificationStatus: true },
    });

    // Log audit event
    await prisma.adminAuditLog.create({
      data: {
        adminId: adminUserId,
        action: "VERIFY_PROPERTY",
        entityType: "property",
        entityId: propertyId,
        newStatus: "VERIFIED",
      },
    });

    revalidatePath("/properties");
    revalidatePath("/verifications");

    return {
      verified: true,
      property,
    };
  });
}

/**
 * Rejects property verification.
 */
export async function rejectProperty(propertyId: string, reason: string) {
  return safeVerificationAction("rejectProperty", async ({ adminUserId }) => {
    if (!reason) throw new Error("Rejection reason is required");

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
      },
      select: { id: true, title: true, verificationStatus: true },
    });
    // Log audit event
    await prisma.adminAuditLog.create({
      data: {
        adminId: adminUserId,
        action: "REJECT_PROPERTY",
        entityType: "property",
        entityId: propertyId,
        newStatus: "REJECTED",
      },
    });

    revalidatePath("/properties");
    revalidatePath("/verifications");

    return {
      rejected: true,
      property,
    };
  });
}

/**
 * Changes property status.
 */
export async function changePropertyStatus(
  propertyId: string,
  status: "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER"
) {
  return safeAction("changePropertyStatus", async () => {
    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { status },
      select: { id: true, title: true, status: true },
    });

    revalidatePath("/properties");
    revalidatePath(`/properties/${propertyId}`);

    return {
      updated: true,
      property,
    };
  });
}

/**
 * Deletes a property.
 */
export async function deleteProperty(propertyId: string) {
  return safeAction("deleteProperty", async () => {
    const property = await prisma.property.delete({
      where: { id: propertyId },
      select: { id: true, title: true },
    });

    revalidatePath("/properties");

    return {
      deleted: true,
      propertyId: property.id,
      propertyTitle: property.title,
    };
  });
}

/**
 * Gets property statistics for dashboard.
 */
export async function getPropertyStats() {
  return safeAction("getPropertyStats", async () => {
    const [
      totalProperties,
      verifiedProperties,
      pendingProperties,
      featuredProperties,
      byType,
      byCategory,
      byStatus,
      byCounty,
      recentProperties,
      priceStats,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.property.count({ where: { verificationStatus: "PENDING" } }),
      prisma.property.count({ where: { featured: true } }),
      prisma.property.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ["category"],
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ["county"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.property.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.property.aggregate({
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    return {
      total: totalProperties,
      verified: verifiedProperties,
      pending: pendingProperties,
      featured: featuredProperties,
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
      byCategory: byCategory.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byCounty,
      recent: recentProperties,
      priceStats: {
        avg: priceStats._avg.price ? Number(priceStats._avg.price) : 0,
        min: priceStats._min.price ? Number(priceStats._min.price) : 0,
        max: priceStats._max.price ? Number(priceStats._max.price) : 0,
      },
    };
  });
}
