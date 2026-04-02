import { prisma } from "@build/db";
import { ATTACHMENT_TYPE_LABELS } from "@build/enums";
import {
  AttachmentType,
  ConsentType,
  DocumentStatus,
  ImageCategory,
  Prisma,
  PropertyDocumentType,
  VerificationStatus,
} from "@prisma/client";
import type {
  CreateAttachmentInput,
  CreateDocumentInput,
  CreatePropertyInput,
  UpdateDocumentInput,
  UpdateAttachmentInput,
} from "@/app/lib/domains/properties/contracts";
import { generatePropertySlug } from "@/app/lib/validation/properties-validation";
import {
  propertyDetailSelect,
  propertyListSelect,
} from "@/app/lib/validation/properties-validation";

type PropertyDbClient = typeof prisma | Prisma.TransactionClient;

function dbOf(tx?: Prisma.TransactionClient): PropertyDbClient {
  return tx ?? prisma;
}

function getDefaultAttachmentTitle(type: string): string {
  return ATTACHMENT_TYPE_LABELS[type as keyof typeof ATTACHMENT_TYPE_LABELS] ?? type;
}

function toPropertyCreateData(
  userId: string,
  data: CreatePropertyInput,
  slug: string,
): Prisma.PropertyCreateInput {
  return {
    title: data.title,
    slug,
    description: data.description,
    type: data.type,
    category: data.category,
    price: data.price,
    currency: data.currency ?? "KES",
    priceNegotiable: data.priceNegotiable ?? false,
    serviceCharge: data.serviceCharge,
    depositRequired: data.depositRequired,
    paymentTerms: data.paymentTerms,
    tenure: data.tenure,
    leaseYearsRemaining: data.leaseYearsRemaining,
    titleDeedNumber: data.titleDeedNumber,
    titleDeedReady: data.titleDeedReady ?? false,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    parkingSpaces: data.parkingSpaces,
    buildingSize: data.buildingSize,
    plotSize: data.plotSize,
    areaUnit: data.areaUnit,
    yearBuilt: data.yearBuilt,
    furnishing: data.furnishing,
    completionStatus: data.completionStatus,
    location: data.location,
    address: data.address,
    county: data.county,
    constituency: data.constituency,
    neighbourhood: data.neighbourhood,
    coordinates: data.coordinates as Prisma.InputJsonValue | undefined,
    latitude: data.latitude,
    longitude: data.longitude,
    nearbyLandmarks: data.nearbyLandmarks as Prisma.InputJsonValue | undefined,
    hasBorehole: data.hasBorehole ?? false,
    hasBackupGenerator: data.hasBackupGenerator ?? false,
    hasElevator: data.hasElevator ?? false,
    hasCCTV: data.hasCCTV ?? false,
    isGatedCommunity: data.isGatedCommunity ?? false,
    features: data.features ?? [],
    featured: data.featured ?? false,
    floorPlanUrl: data.floorPlanUrl,
    videoUrl: data.videoUrl,
    virtualTourUrl: data.virtualTourUrl,
    agent: { connect: { userId } },
    images:
      data.images && data.images.length > 0
        ? {
            create: data.images.map((image) => ({
              assetId: image.assetId,
              category: image.category ?? ImageCategory.EXTERIOR,
              caption: image.caption,
              isMain: image.isMain ?? false,
              sortOrder: image.sortOrder ?? 0,
              tags: image.tags ?? [],
              uploadedBy: { connect: { id: userId } },
            })),
          }
        : undefined,
    attachments:
      data.attachments && data.attachments.length > 0
        ? {
            create: data.attachments.map((attachment) => ({
              title:
                attachment.title?.trim() ||
                getDefaultAttachmentTitle(attachment.type),
              type: attachment.type,
              fileKey: attachment.fileKey,
              fileUrl: attachment.fileUrl,
              mimeType: attachment.mimeType,
              size: attachment.size,
              assetId: attachment.assetId,
              notes: attachment.notes,
              uploadedBy: { connect: { id: userId } },
            })),
          }
        : undefined,
    documents:
      data.documents && data.documents.length > 0
        ? {
            create: data.documents.map((document) => ({
              type: document.type,
              assetId: document.assetId,
              fileKey: document.fileKey,
              fileUrl: document.fileUrl,
              mimeType: document.mimeType,
              size: document.size,
              notes: document.notes,
              status: document.status ?? DocumentStatus.PENDING,
              rejectionReason: document.rejectionReason,
              issueDate: document.issueDate
                ? new Date(document.issueDate)
                : undefined,
              expiryDate: document.expiryDate
                ? new Date(document.expiryDate)
                : undefined,
              isPrivate: document.isPrivate ?? true,
              uploadedBy: { connect: { id: userId } },
            })),
          }
        : undefined,
  };
}

export type PropertyListRecord = Prisma.PropertyGetPayload<{
  select: typeof propertyListSelect;
}>;

export type PropertyDetailRecord = Prisma.PropertyGetPayload<{
  select: typeof propertyDetailSelect;
}>;

export const propertyRepository = {
  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T> {
    return prisma.$transaction(callback, options);
  },

  async findUserIdByClerkId(clerkId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  async findCreateActor(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        professionalProfile: {
          select: {
            userId: true,
          },
        },
      },
    });
  },

  async ensureUniqueSlug(
    title: string,
    providedSlug?: string,
    suffix?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = dbOf(tx);
    const baseSlug = providedSlug || generatePropertySlug(title);
    let slug = baseSlug;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await db.property.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) {
        return slug;
      }

      const suffixValue =
        suffix ??
        `${Date.now()}${attempt > 0 ? `-${attempt}` : ""}`.replace("--", "-");
      slug = `${generatePropertySlug(title)}-${suffixValue}`;
    }

    return `${generatePropertySlug(title)}-${Date.now()}`;
  },

  async createProperty(
    userId: string,
    data: CreatePropertyInput,
    slug: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).property.create({
      data: toPropertyCreateData(userId, data, slug),
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
  },

  async createConsentRecord(
    input: {
      userId: string;
      type?: ConsentType;
      documentVersion?: string;
      ipAddress?: string;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).consentRecord.create({
      data: {
        userId: input.userId,
        type: input.type ?? ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: input.documentVersion ?? "v1.0",
        ipAddress: input.ipAddress,
        metadata: input.metadata,
      },
    });
  },

  async createReadConsentRecord(
    input: {
      userId: string;
      propertyId: string;
      propertyTitle: string;
      ipAddress?: string;
      userAgent?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.createConsentRecord(
      {
        userId: input.userId,
        metadata: {
          action: "view_own_property",
          propertyId: input.propertyId,
          propertyTitle: input.propertyTitle,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        } as Prisma.InputJsonValue,
      },
      tx,
    );
  },

  async listProperties(args: {
    where: Prisma.PropertyWhereInput;
    orderBy: Prisma.PropertyOrderByWithRelationInput;
    skip: number;
    take: number;
  }): Promise<PropertyListRecord[]> {
    return prisma.property.findMany({
      where: args.where,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
      select: propertyListSelect,
    });
  },

  async countProperties(where: Prisma.PropertyWhereInput): Promise<number> {
    return prisma.property.count({ where });
  },

  async findPropertyDetailById(
    propertyId: string,
  ): Promise<PropertyDetailRecord | null> {
    return prisma.property.findFirst({
      where: {
        id: propertyId,
        deletedAt: null,
      },
      select: propertyDetailSelect,
    });
  },

  async incrementViewCount(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await dbOf(tx).property.updateMany({
      where: { id: propertyId, deletedAt: null },
      data: { viewCount: { increment: 1 } },
    });
  },

  async findSimilarProperties(
    propertyId: string,
    limit = 4,
  ): Promise<PropertyListRecord[]> {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        deletedAt: null,
      },
      select: {
        id: true,
        location: true,
        type: true,
        category: true,
        county: true,
      },
    });

    if (!property) {
      return [];
    }

    const primaryLocation = property.location.split(",")[0]?.trim();

    return prisma.property.findMany({
      where: {
        id: { not: propertyId },
        deletedAt: null,
        status: "AVAILABLE",
        OR: [
          property.county ? { county: property.county } : undefined,
          primaryLocation
            ? {
                location: {
                  contains: primaryLocation,
                  mode: "insensitive",
                },
              }
            : undefined,
          {
            type: property.type,
            category: property.category,
          },
        ].filter(Boolean) as Prisma.PropertyWhereInput[],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: propertyListSelect,
    });
  },

  async listMyProperties(
    agentId: string,
    options: {
      limit: number;
      status?: "all" | "active" | "pending" | "sold";
    },
  ) {
    const where: Prisma.PropertyWhereInput = {
      agentId,
      deletedAt: null,
    };

    switch (options.status) {
      case "active":
        where.status = { in: ["AVAILABLE", "UNDER_OFFER"] };
        break;
      case "pending":
        where.status = "UNDER_OFFER";
        break;
      case "sold":
        where.status = "SOLD";
        break;
      default:
        break;
    }

    return prisma.property.findMany({
      where,
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
      take: options.limit,
    });
  },

  async findPropertyMutationState(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: {
        id: true,
        agentId: true,
        title: true,
        version: true,
        verificationStatus: true,
      },
    });
  },

  async findPropertyVersion(propertyId: string): Promise<number | null> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { version: true },
    });
    return property?.version ?? null;
  },

  async updatePropertyWithVersion(
    propertyId: string,
    expectedVersion: number,
    data: Prisma.PropertyUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ count: number; property: PropertyDetailRecord | null }> {
    const db = dbOf(tx);
    const result = await db.property.updateMany({
      where: {
        id: propertyId,
        version: expectedVersion,
        deletedAt: null,
      },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return { count: 0, property: null };
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: propertyDetailSelect,
    });

    return { count: result.count, property };
  },

  async softDeletePropertyWithVersion(
    propertyId: string,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await dbOf(tx).property.updateMany({
      where: {
        id: propertyId,
        version: expectedVersion,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return result.count;
  },

  async findAssetAccess(assetId: string, tx?: Prisma.TransactionClient) {
    return dbOf(tx).asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        uploaderId: true,
      },
    });
  },

  async listPropertyDocuments(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyDocument.findMany({
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
  },

  async findPropertyDocument(
    propertyId: string,
    documentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
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
    });
  },

  async createPropertyDocument(
    propertyId: string,
    uploadedById: string,
    data: CreateDocumentInput,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyDocument.create({
      data: {
        propertyId,
        assetId: data.assetId,
        type: data.type as PropertyDocumentType,
        notes: data.notes,
        uploadedById,
        status: DocumentStatus.PENDING,
      },
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
    });
  },

  async updatePropertyDocument(
    documentId: string,
    data: UpdateDocumentInput,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyDocument.update({
      where: { id: documentId },
      data: {
        ...(data.type !== undefined
          ? { type: data.type as PropertyDocumentType }
          : {}),
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        status: DocumentStatus.PENDING,
      },
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
    });
  },

  async deletePropertyDocument(
    documentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    await dbOf(tx).propertyDocument.delete({ where: { id: documentId } });
  },

  async listPropertyAttachments(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyAttachment.findMany({
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
  },

  async findPropertyAttachment(
    propertyId: string,
    attachmentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyAttachment.findFirst({
      where: {
        id: attachmentId,
        propertyId,
      },
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
    });
  },

  async createPropertyAttachment(
    propertyId: string,
    uploadedById: string,
    data: CreateAttachmentInput,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyAttachment.create({
      data: {
        title: data.title,
        propertyId,
        assetId: data.assetId,
        type: data.type as AttachmentType,
        notes: data.notes,
        uploadedById,
      },
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
    });
  },

  async updatePropertyAttachment(
    attachmentId: string,
    data: UpdateAttachmentInput,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).propertyAttachment.update({
      where: { id: attachmentId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.type !== undefined
          ? { type: data.type as AttachmentType }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
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
    });
  },

  async deletePropertyAttachment(
    attachmentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    await dbOf(tx).propertyAttachment.delete({ where: { id: attachmentId } });
  },

  async setPropertyVerificationPending(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).property.updateMany({
      where: {
        id: propertyId,
        deletedAt: null,
        verificationStatus: { not: VerificationStatus.PENDING },
      },
      data: {
        verificationStatus: VerificationStatus.PENDING,
        submittedAt: new Date(),
      },
    });
  },

  async findPropertyOwnerState(
    propertyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return dbOf(tx).property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: {
        id: true,
        title: true,
        agentId: true,
        verificationStatus: true,
      },
    });
  },
};
