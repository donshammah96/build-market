/**
 * Properties Service Layer
 *
 * Core business logic for property operations. Used by both Server Actions
 * and API routes. Delegates update/delete to property-operations.service
 * for optimistic locking (If-Match).
 */
import { prisma } from "../db";
import {
  Prisma,
  UserStatus,
  ConsentType,
  ImageCategory,
  PropertyType,
  PropertyCategory,
  PropertyDocumentType,
  DocumentStatus,
} from "@prisma/client";
import {
  propertyListSelect,
  propertyDetailSelect,
  generatePropertySlug,
} from "@/app/lib/validation/properties-validation";
import type { z } from "zod";
import type {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
} from "@/app/lib/validation/properties-validation";
import {
  updatePropertyWithOptimisticLock,
  deletePropertyWithOptimisticLock,
  type UpdatePropertyData,
  type PropertyOperationContext,
} from "@/app/lib/services/property-operations.service";
import { PropertyRepository } from "@/app/lib/repositories/property.repository";

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof PropertyQuerySchema>;

export type PropertyListResult = {
  properties: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};

export type MyPropertyListing = {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  location: string;
  county: string | null;
  type: string;
  category: string;
  status: string;
  verificationStatus: string | null;
  rejectionReason: string | null;
  views: number;
  inquiries: number;
  images: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AddPropertyDocumentInput = {
  type: string;
  assetId: string;
  notes?: string;
};

// ─── Ensure User Can Create Properties ────────────────────────────────────

export async function ensureUserCanCreateProperties(
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      professionalProfile: { select: { userId: true } },
    },
  });

  if (!user) throw new Error("User not found");
  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("Account suspended. Cannot create properties.");
  }
  if (!user.professionalProfile) {
    throw new Error("Only professionals can list properties");
  }
}

// ─── List Properties (Public) ────────────────────────────────────────────────

export async function getProperties(
  filters: PropertyQueryInput
): Promise<PropertyListResult> {
  const {
    type,
    category,
    county,
    status,
    verified,
    featured,
    furnishing,
    minPrice,
    maxPrice,
    minBedrooms,
    maxBedrooms,
    minBathrooms,
    search,
    sortBy,
    sortOrder,
    page,
    limit,
  } = filters;

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.PropertyWhereInput = {
    deletedAt: null,
  };

  if (type) where.type = type;
  if (category) where.category = category;
  if (county) where.county = county;
  if (status) where.status = status;
  if (furnishing) where.furnishing = furnishing;
  if (verified !== undefined) where.verified = verified === "true";
  if (featured !== undefined) where.featured = featured === "true";

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  if (minBedrooms) where.bedrooms = { gte: parseInt(minBedrooms) };
  if (maxBedrooms) {
    where.bedrooms = {
      ...((where.bedrooms as Prisma.IntNullableFilter) ?? {}),
      lte: parseInt(maxBedrooms),
    };
  }
  if (minBathrooms) where.bathrooms = { gte: parseInt(minBathrooms) };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.PropertyOrderByWithRelationInput = {};
  if (sortBy === "price") orderBy.price = sortOrder;
  else if (sortBy === "bedrooms") orderBy.bedrooms = sortOrder;
  else if (sortBy === "buildingSize") orderBy.buildingSize = sortOrder;
  else orderBy.createdAt = sortOrder;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      select: propertyListSelect,
      orderBy,
      skip,
      take: limitNum,
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    hasMore: skip + properties.length < total,
  };
}

// ─── Get Property by ID (Public) ───────────────────────────────────────────

export async function getPropertyById(id: string) {
  return prisma.property.findUnique({
    where: { id, deletedAt: null },
    select: {
      ...propertyDetailSelect,
      version: true,
    },
  });
}

// ─── Get Similar Properties ────────────────────────────────────────────────

export async function getSimilarProperties(
  propertyId: string,
  limit: number = 4
): Promise<unknown[]> {
  const repo = new PropertyRepository(prisma);
  return repo.findSimilar(propertyId, limit);
}

// ─── Get My Properties (Owner) ──────────────────────────────────────────────

export async function getMyProperties(
  userId: string,
  options?: { limit?: number; status?: "all" | "active" | "pending" | "sold" }
): Promise<MyPropertyListing[]> {
  const limitNum = Math.min(options?.limit ?? 50, 50);
  const status = options?.status ?? "active";

  const whereClause: Prisma.PropertyWhereInput = {
    agentId: userId,
    deletedAt: null,
  };

  if (status !== "all") {
    if (status === "active") {
      whereClause.status = { in: ["AVAILABLE", "UNDER_OFFER"] };
    } else if (status === "pending") {
      whereClause.status = "UNDER_OFFER";
    } else {
      whereClause.status = "SOLD";
    }
  }

  const properties = await prisma.property.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      location: true,
      county: true,
      type: true,
      category: true,
      status: true,
      verificationStatus: true,
      rejectionReason: true,
      viewCount: true,
      inquiryCount: true,
      version: true,
      images: {
        select: {
          url: true,
          asset: {
            select: {
              cdnUrl: true,
              thumbnailUrl: true,
            },
          },
        },
        take: 1,
        orderBy: { sortOrder: "asc" },
      },
      _count: {
        select: { inquiries: true },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limitNum,
  });

  return properties.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: Number(p.price),
    currency: p.currency,
    location: p.location || "Unknown",
    county: p.county,
    type: p.type,
    category: p.category,
    status: p.status.toLowerCase(),
    verificationStatus: p.verificationStatus,
    rejectionReason: p.rejectionReason,
    views: p.viewCount,
    inquiries: p._count.inquiries,
    images: p.images.map(
      (img: {
        url: string | null;
        asset: {
          cdnUrl: string | null;
          thumbnailUrl: string | null;
        } | null;
      }) =>
        img.asset?.cdnUrl ||
        img.asset?.thumbnailUrl ||
        img.url ||
        "/placeholder-property.jpg"
    ),
    version: p.version ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

// ─── Create Property (Single) ───────────────────────────────────────────────

export async function createProperty(
  userId: string,
  data: CreatePropertyInput,
  options?: { ipAddress?: string; userAgent?: string }
) {
  await ensureUserCanCreateProperties(userId);

  let slug =
    data.slug || generatePropertySlug(data.title ?? "");
  let attempt = 0;

  while (attempt < 5) {
    const existing = await prisma.property.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${generatePropertySlug(data.title ?? "")}-${Date.now()}`;
    attempt++;
  }

  const property = await prisma.property.create({
    data: {
      title: data.title || "",
      slug,
      description: data.description,
      type: data.type || PropertyType.SALE,
      category: data.category || PropertyCategory.RESIDENTIAL,
      price: data.price || 0,
      currency: data.currency || "KES",
      priceNegotiable: data.priceNegotiable,
      serviceCharge: data.serviceCharge,
      depositRequired: data.depositRequired,
      paymentTerms: data.paymentTerms,
      tenure: data.tenure,
      leaseYearsRemaining: data.leaseYearsRemaining,
      titleDeedNumber: data.titleDeedNumber,
      titleDeedReady: data.titleDeedReady,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      parkingSpaces: data.parkingSpaces,
      buildingSize: data.buildingSize,
      plotSize: data.plotSize,
      areaUnit: data.areaUnit,
      yearBuilt: data.yearBuilt,
      furnishing: data.furnishing,
      completionStatus: data.completionStatus,
      location: data.location || "",
      address: data.address,
      county: data.county,
      constituency: data.constituency,
      neighbourhood: data.neighbourhood,
      coordinates: data.coordinates as Prisma.InputJsonValue,
      latitude: data.latitude,
      longitude: data.longitude,
      nearbyLandmarks: data.nearbyLandmarks as Prisma.InputJsonValue,
      hasBorehole: data.hasBorehole,
      hasBackupGenerator: data.hasBackupGenerator,
      hasElevator: data.hasElevator,
      hasCCTV: data.hasCCTV,
      isGatedCommunity: data.isGatedCommunity,
      features: data.features,
      featured: data.featured,
      floorPlanUrl: data.floorPlanUrl,
      videoUrl: data.videoUrl,
      virtualTourUrl: data.virtualTourUrl,
      agent: { connect: { userId } },
      images: data.images?.length
        ? {
            create: data.images.map((img) => ({
              assetId: img.assetId,
              category: (img.category as ImageCategory) ?? "EXTERIOR",
              caption: img.caption,
              isMain: img.isMain,
              sortOrder: img.sortOrder ?? 0,
              tags: img.tags ?? [],
              uploadedBy: { connect: { id: userId } },
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      category: true,
      price: true,
      location: true,
      status: true,
      version: true,
      createdAt: true,
    },
  });

  await prisma.consentRecord.create({
    data: {
      userId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "v1.0",
      metadata: {
        action: "create_property",
        propertyId: property.id,
        propertyTitle: property.title,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      } as Prisma.InputJsonValue,
    },
  });

  return property;
}

// ─── Create Properties (Batch) ──────────────────────────────────────────────

export async function createPropertiesBatch(
  userId: string,
  propertiesData: CreatePropertyInput[],
  options?: { ipAddress?: string; userAgent?: string }
) {
  await ensureUserCanCreateProperties(userId);

  const timestamp = Date.now();
  const createdProperties = [];

  for (let i = 0; i < propertiesData.length; i++) {
    const propertyData = propertiesData[i];
    let slug =
      propertyData?.slug || generatePropertySlug(propertyData?.title ?? "");
    let attempt = 0;

    while (attempt < 5) {
      const existing = await prisma.property.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) break;
      slug = `${generatePropertySlug(propertyData?.title ?? "")}-${timestamp}-${i}`;
      attempt++;
    }

    const property = await prisma.property.create({
      data: {
        title: propertyData?.title || "",
        slug,
        description: propertyData?.description,
        type: propertyData?.type || PropertyType.SALE,
        category: propertyData?.category || PropertyCategory.RESIDENTIAL,
        price: propertyData?.price || 0,
        currency: propertyData?.currency || "KES",
        priceNegotiable: propertyData?.priceNegotiable,
        serviceCharge: propertyData?.serviceCharge,
        depositRequired: propertyData?.depositRequired,
        paymentTerms: propertyData?.paymentTerms,
        tenure: propertyData?.tenure,
        leaseYearsRemaining: propertyData?.leaseYearsRemaining,
        titleDeedNumber: propertyData?.titleDeedNumber,
        titleDeedReady: propertyData?.titleDeedReady,
        bedrooms: propertyData?.bedrooms,
        bathrooms: propertyData?.bathrooms,
        parkingSpaces: propertyData?.parkingSpaces,
        buildingSize: propertyData?.buildingSize,
        plotSize: propertyData?.plotSize,
        areaUnit: propertyData?.areaUnit,
        yearBuilt: propertyData?.yearBuilt,
        furnishing: propertyData?.furnishing,
        completionStatus: propertyData?.completionStatus,
        location: propertyData?.location || "",
        address: propertyData?.address,
        county: propertyData?.county,
        constituency: propertyData?.constituency,
        neighbourhood: propertyData?.neighbourhood,
        coordinates: propertyData?.coordinates as Prisma.InputJsonValue,
        latitude: propertyData?.latitude,
        longitude: propertyData?.longitude,
        nearbyLandmarks: propertyData?.nearbyLandmarks as Prisma.InputJsonValue,
        hasBorehole: propertyData?.hasBorehole,
        hasBackupGenerator: propertyData?.hasBackupGenerator,
        hasElevator: propertyData?.hasElevator,
        hasCCTV: propertyData?.hasCCTV,
        isGatedCommunity: propertyData?.isGatedCommunity,
        features: propertyData?.features,
        featured: propertyData?.featured,
        floorPlanUrl: propertyData?.floorPlanUrl,
        videoUrl: propertyData?.videoUrl,
        virtualTourUrl: propertyData?.virtualTourUrl,
        agent: { connect: { userId } },
        images: propertyData?.images?.length
          ? {
              create: propertyData.images.map((img) => ({
                assetId: img.assetId,
                category: (img.category as ImageCategory) ?? "EXTERIOR",
                caption: img.caption,
                isMain: img.isMain,
                sortOrder: img.sortOrder ?? 0,
                tags: img.tags ?? [],
                uploadedBy: { connect: { id: userId } },
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        category: true,
        price: true,
        location: true,
        status: true,
        version: true,
        createdAt: true,
      },
    });

    createdProperties.push(property);
  }

  await prisma.consentRecord.create({
    data: {
      userId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "v1.0",
      metadata: {
        action: "create_property",
        propertyIds: createdProperties.map((p) => p.id),
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      } as Prisma.InputJsonValue,
    },
  });

  return { properties: createdProperties, count: createdProperties.length };
}

// ─── Update Property ────────────────────────────────────────────────────────

export async function updateProperty(
  propertyId: string,
  userId: string,
  data: UpdatePropertyData,
  context: PropertyOperationContext,
  expectedVersion: number
) {
  return updatePropertyWithOptimisticLock(
    propertyId,
    userId,
    data,
    context,
    expectedVersion
  );
}

// ─── Delete Property ────────────────────────────────────────────────────────

export async function deleteProperty(
  propertyId: string,
  userId: string,
  context: PropertyOperationContext,
  expectedVersion: number
) {
  return deletePropertyWithOptimisticLock(
    propertyId,
    userId,
    context,
    expectedVersion
  );
}

// ─── Property Documents ────────────────────────────────────────────────────

export async function getPropertyDocuments(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { agentId: true },
  });

  if (!property) throw new Error("Property not found");
  if (property.agentId !== userId) throw new Error("Unauthorized");

  return prisma.propertyDocument.findMany({
    where: { propertyId },
    include: {
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          originalName: true,
          mimeType: true,
          size: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addPropertyDocument(
  propertyId: string,
  userId: string,
  data: AddPropertyDocumentInput
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { agentId: true },
  });

  if (!property) throw new Error("Property not found");
  if (property.agentId !== userId) throw new Error("Unauthorized");

  const asset = await prisma.asset.findUnique({
    where: { id: data.assetId },
  });

  if (!asset) throw new Error("Asset not found");
  if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
    throw new Error("Unauthorized access to asset");
  }

  return prisma.propertyDocument.create({
    data: {
      propertyId,
      assetId: data.assetId,
      type: data.type as PropertyDocumentType,
      notes: data.notes,
      uploadedById: userId,
      status: DocumentStatus.PENDING,
    },
    include: {
      asset: true,
    },
  });
}

export async function removePropertyDocument(
  propertyId: string,
  documentId: string,
  userId: string
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { agentId: true },
  });

  if (!property) throw new Error("Property not found");
  if (property.agentId !== userId) throw new Error("Unauthorized");

  const doc = await prisma.propertyDocument.findFirst({
    where: { id: documentId, propertyId },
  });

  if (!doc) throw new Error("Document not found");

  await prisma.propertyDocument.delete({
    where: { id: documentId },
  });

  return { success: true };
}
