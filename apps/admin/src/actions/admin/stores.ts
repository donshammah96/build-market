// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma, County, StoreType, StoreCategory } from "@build/db";
import { safeAction, safeVerificationAction, logAdminAction } from "./shared";
import { runWithIdempotency } from "./idempotency";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type StoreListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  county: string | null;
  categories: string[];
  storeType: string;
  verified: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string;
  } | null;
  _count: {
    products: number;
    orders: number;
  };
};

export type StoreDetails = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  county: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categories: string[];
  storeType: string;
  verified: boolean;
  featured: boolean;
  verificationStatus: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    userId: string;
    companyName: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    };
  } | null;
  images: Array<{
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    price: number;
    status: string;
  }>;
  _count: {
    products: number;
    orders: number;
    reviews: number;
  };
};

// ============================================================================
// Schemas
// ============================================================================

const StoreFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  verified: z.boolean().optional(),
  featured: z.boolean().optional(),
  county: z.string().optional(),
  category: z.string().optional(),
  storeType: z.string().optional(),
  sortBy: z.enum(["createdAt", "name", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const UpdateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal("")),
  featured: z.boolean().optional(),
});

export type StoreFilterInput = z.infer<typeof StoreFilterSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;

const STORE_MUTATION_IDEMPOTENCY_TTL_HOURS = 0.25;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of stores with filtering and sorting.
 * Includes owner info and aggregate counts.
 */
export async function getStores(filters: Partial<StoreFilterInput> = {}) {
  return safeAction("getStores", async () => {
    const validatedFilters = StoreFilterSchema.parse(filters);
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build where clause
    const where: Prisma.StoreWhereInput = {};

    if (validatedFilters.search) {
      where.OR = [
        { name: { contains: validatedFilters.search, mode: "insensitive" } },
        {
          description: {
            contains: validatedFilters.search,
            mode: "insensitive",
          },
        },
        { city: { contains: validatedFilters.search, mode: "insensitive" } },
        {
          professional: {
            companyName: {
              contains: validatedFilters.search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (validatedFilters.verified !== undefined) {
      where.verified = validatedFilters.verified;
    }

    if (validatedFilters.featured !== undefined) {
      where.featured = validatedFilters.featured;
    }

    if (validatedFilters.county) {
      where.county = validatedFilters.county as County;
    }

    if (validatedFilters.category) {
      where.categories = { has: validatedFilters.category as StoreCategory };
    }

    if (validatedFilters.storeType) {
      where.storeType = validatedFilters.storeType as StoreType;
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: validatedFilters.limit,
        orderBy: { [validatedFilters.sortBy]: validatedFilters.sortOrder },
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
          _count: {
            select: {
              products: true,
              orders: true,
            },
          },
        },
      }),
      prisma.store.count({ where }),
    ]);

    // Transform to flatten owner info
    const formattedStores: StoreListItem[] = stores.map((store) => ({
      ...store,
      owner: store.professional
        ? {
            id: store.professional.userId,
            email: store.professional.user.email,
            firstName: store.professional.user.firstName,
            lastName: store.professional.user.lastName,
            companyName: store.professional.companyName,
          }
        : null,
    }));

    return {
      stores: formattedStores,
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
 * Fetches complete store details with all related data.
 */
export async function getStoreDetails(storeId: string) {
  return safeAction("getStoreDetails", async () => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
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
          select: {
            id: true,
            url: true,
            caption: true,
            isMain: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            inStock: true,
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            products: true,
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!store) throw new Error("Store not found");

    // Transform the store to match StoreDetails type
    const storeDetails: StoreDetails = {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      address: store.address,
      city: store.city,
      county: store.county || "Unknown",
      zipCode: store.zipCode,
      phone: null,
      email: null,
      website: null,
      categories: store.categories,
      storeType: store.storeType,
      verified: store.verified,
      featured: store.featured,
      verificationStatus: store.verificationStatus,
      verifiedAt: store.verifiedAt,
      rejectionReason: store.rejectionReason,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      images: store.images,
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        status: p.inStock ? "available" : "out_of_stock",
      })),
      owner: store.professional,
      _count: store._count,
    };

    return storeDetails;
  });
}

/**
 * Updates store information.
 * Returns updated store for optimistic UI updates.
 */
export async function updateStore(storeId: string, data: UpdateStoreInput) {
  return safeAction("updateStore", async () => {
    const validated = UpdateStoreSchema.parse(data);

    // Transform validated data for Prisma, casting county to enum and removing fields that don't exist
    const updateData: Prisma.StoreUpdateInput = {};

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.address !== undefined) updateData.address = validated.address;
    if (validated.city !== undefined) updateData.city = validated.city;
    if (validated.county !== undefined)
      updateData.county = validated.county as County;
    if (validated.zipCode !== undefined) updateData.zipCode = validated.zipCode;
    if (validated.featured !== undefined)
      updateData.featured = validated.featured;
    // Note: phone, email, website are not in Store model, so they're ignored

    const store = await prisma.store.update({
      where: { id: storeId },
      data: updateData,
      select: {
        id: true,
        name: true,
        verified: true,
        featured: true,
        updatedAt: true,
      },
    });

    revalidatePath("/stores");
    revalidatePath(`/stores/${storeId}`);

    return {
      updated: true,
      store,
    };
  });
}

/**
 * Toggles store featured status.
 */
export async function toggleStoreFeatured(
  storeId: string,
  idempotencyKey: string,
) {
  return safeAction("toggleStoreFeatured", async ({ adminUserId }) => {
    return runWithIdempotency({
      adminUserId,
      actionName: "toggleStoreFeatured",
      idempotencyKey,
      resourceId: storeId,
      ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { featured: true },
        });

        if (!store) throw new Error("Store not found");

        const updated = await prisma.store.update({
          where: { id: storeId },
          data: { featured: !store.featured },
          select: { id: true, name: true, featured: true },
        });

        await logAdminAction({
          userId: adminUserId,
          action: updated.featured ? "FEATURE_STORE" : "UNFEATURE_STORE",
          targetType: "store",
          targetId: storeId,
          details: { featured: updated.featured },
        });

        revalidatePath("/stores");

        return {
          toggled: true,
          store: updated,
        };
      },
    });
  });
}

/**
 * Verifies a store.
 */
export async function verifyStore(
  storeId: string,
  idempotencyKey: string,
  notes?: string,
) {
  return safeVerificationAction("verifyStore", async ({ adminUserId }) => {
    return runWithIdempotency({
      adminUserId,
      actionName: "verifyStore",
      idempotencyKey,
      resourceId: storeId,
      ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const currentStore = await prisma.store.findUnique({
          where: { id: storeId },
          select: { verificationStatus: true },
        });

        const store = await prisma.store.update({
          where: { id: storeId },
          data: {
            verified: true,
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
            rejectionReason: null,
          },
          include: {
            professional: {
              select: {
                companyName: true,
                user: { select: { email: true } },
              },
            },
          },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "VERIFY_STORE",
          targetType: "store",
          targetId: storeId,
          details: {
            oldStatus: currentStore?.verificationStatus || null,
            newStatus: "VERIFIED",
            reason: notes || null,
            metadata: { storeName: store.name },
          },
        });

        revalidatePath("/stores");
        revalidatePath("/verifications");

        return {
          verified: true,
          store: {
            id: store.id,
            name: store.name,
            verified: store.verified,
          },
        };
      },
    });
  });
}

/**
 * Rejects store verification.
 */
export async function rejectStore(
  storeId: string,
  reason: string,
  idempotencyKey: string,
  notes?: string,
) {
  return safeVerificationAction("rejectStore", async ({ adminUserId }) => {
    return runWithIdempotency({
      adminUserId,
      actionName: "rejectStore",
      idempotencyKey,
      resourceId: storeId,
      ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        if (!reason) throw new Error("Rejection reason is required");

        const currentStore = await prisma.store.findUnique({
          where: { id: storeId },
          select: { verificationStatus: true, name: true },
        });

        if (!currentStore) throw new Error("Store not found");

        const store = await prisma.store.update({
          where: { id: storeId },
          data: {
            verified: false,
            verificationStatus: "REJECTED",
            rejectionReason: reason,
          },
          select: { id: true, name: true, verified: true },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "REJECT_STORE",
          targetType: "store",
          targetId: storeId,
          reason,
          details: {
            oldStatus: currentStore?.verificationStatus || null,
            newStatus: "REJECTED",
            reason: notes || null,
            metadata: { storeName: store.name },
          },
        });

        revalidatePath("/stores");
        revalidatePath("/verifications");

        return {
          rejected: true,
          store,
        };
      },
    });
  });
}

/**
 * Deletes a store.
 * Warning: This is a destructive action.
 */
export async function deleteStore(storeId: string, idempotencyKey: string) {
  return safeAction("deleteStore", async ({ adminUserId }) => {
    return runWithIdempotency({
      adminUserId,
      actionName: "deleteStore",
      idempotencyKey,
      resourceId: storeId,
      ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const store = await prisma.store.delete({
          where: { id: storeId },
          select: { id: true, name: true },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "DELETE_STORE",
          targetType: "store",
          targetId: store.id,
          details: {
            storeName: store.name,
          },
        });

        revalidatePath("/stores");

        return {
          deleted: true,
          storeId: store.id,
          storeName: store.name,
        };
      },
    });
  });
}

/**
 * Gets store statistics for dashboard.
 */
export async function getStoreStats() {
  return safeAction("getStoreStats", async () => {
    const [
      totalStores,
      verifiedStores,
      pendingStores,
      featuredStores,
      storesByCategory,
      storesByCounty,
      recentStores,
    ] = await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { verified: true } }),
      prisma.store.count({ where: { verificationStatus: "PENDING" } }),
      prisma.store.count({ where: { featured: true } }),
      prisma.store.groupBy({
        by: ["categories"],
        _count: { id: true },
      }),
      prisma.store.groupBy({
        by: ["county"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.store.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          verified: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      total: totalStores,
      verified: verifiedStores,
      pending: pendingStores,
      featured: featuredStores,
      byCategory: storesByCategory,
      byCounty: storesByCounty,
      recent: recentStores,
    };
  });
}
