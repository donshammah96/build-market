import { err, ok } from "@/app/lib/errors/result";
import type {
  CreateAttachmentInput,
  CreateDocumentInput,
  CreatePropertyInput,
  MyListingsResultEnvelope,
  PropertyActor,
  PropertyAttachmentDto,
  PropertyCreateResultDto,
  PropertyDeleteResultDto,
  PropertyDetailResultEnvelope,
  PropertyDocumentDto,
  PropertyDomainError,
  PropertyDomainErrorCode,
  PropertyErrorDetails,
  PropertyListResultEnvelope,
  PropertyMutationResultDto,
  PropertyOperationContext,
  PropertyQueryInput,
  PropertyResult,
  PropertyUpdateResultDto,
  UpdateAttachmentInput,
  UpdateDocumentInput,
} from "@/app/lib/domains/properties/contracts";
import {
  toMyPropertyListingDto,
  toPropertyDto,
  toPropertyAttachmentDto,
  toPropertyCreateResultDto,
  toPropertyDetailDto,
  toPropertyDocumentDto,
  toPropertyListItemDto,
} from "@/app/lib/domains/properties/mappers";
import {
  propertyRepository,
  type PropertyDetailRecord,
} from "@/app/lib/domains/properties/repository";
import { buildPropertyUpdatePayload } from "@/app/lib/domains/properties/operations";

function propertyError(
  error: PropertyDomainErrorCode,
  message: string,
  details?: PropertyErrorDetails,
): PropertyResult<never> {
  return err<PropertyDomainError>({
    error,
    message,
    ...(details !== undefined ? { details } : {}),
  });
}

function getActorUserId(actor: PropertyActor): string {
  return actor.userId;
}

async function ensureUserCanCreateProperties(
  actor: PropertyActor,
): Promise<PropertyResult<{ userId: string }>> {
  const userId = getActorUserId(actor);
  const user = await propertyRepository.findCreateActor(userId);

  if (!user) {
    return propertyError("not_found", "User not found");
  }

  // FIX: Check suspended status BEFORE professional check.
  // A suspended professional should receive "Account suspended", not
  // "Only professionals can list properties".
  if (String(user.status) === "SUSPENDED") {
    return propertyError(
      "suspended_account",
      "Account suspended. Cannot create properties.",
    );
  }

  if (!user.professionalProfile) {
    return propertyError(
      "not_professional",
      "Only professionals can list properties",
    );
  }

  return ok({ userId });
}

async function ensureOwnedProperty(propertyId: string, actor: PropertyActor) {
  const property = await propertyRepository.findPropertyOwnerState(propertyId);
  if (!property) {
    return propertyError("not_found", "Property not found");
  }

  if (property.agentId !== getActorUserId(actor)) {
    return propertyError(
      "forbidden",
      "You do not have permission to access this property",
    );
  }

  return ok(property);
}

async function ensureAssetAccessible(assetId: string, actor: PropertyActor) {
  const asset = await propertyRepository.findAssetAccess(assetId);
  if (!asset) {
    return propertyError("asset_not_found", "Asset not found");
  }

  // FIX: Restored "system" asset check. Platform-provided assets (uploaderId
  // === "system") are accessible by any authenticated user.
  if (
    asset.uploaderId !== getActorUserId(actor) &&
    asset.uploaderId !== "system"
  ) {
    return propertyError(
      "asset_unauthorized",
      "You do not have permission to use this asset",
    );
  }

  return ok(asset);
}

function mapPropertyConflict(
  property: { version: number },
  expectedVersion: number,
): PropertyResult<never> {
  return propertyError(
    "conflict",
    "Property has been modified. Retry with the latest version.",
    {
      currentVersion: property.version,
      expectedVersion,
    },
  );
}

function toUpdateResult(
  property: PropertyDetailRecord,
  version: number,
): PropertyUpdateResultDto {
  return {
    property: toPropertyDetailDto(property),
    version,
  };
}

export const propertiesService = {
  async listProperties(
    filters: PropertyQueryInput,
  ): Promise<PropertyResult<PropertyListResultEnvelope>> {
    try {
      const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(Number.parseInt(filters.limit, 10) || 20, 1),
        50,
      );
      const skip = (page - 1) * limit;

      const where: import("@prisma/client").Prisma.PropertyWhereInput = {
        deletedAt: null,
      };

      if (filters.type) where.type = filters.type;
      if (filters.category) where.category = filters.category;
      if (filters.county) where.county = filters.county;
      if (filters.status) where.status = filters.status;
      if (filters.furnishing) where.furnishing = filters.furnishing;
      if (filters.verified !== undefined) {
        where.verified = filters.verified === "true";
      }
      if (filters.featured !== undefined) {
        where.featured = filters.featured === "true";
      }

      if (filters.minPrice || filters.maxPrice) {
        where.price = {};
        if (filters.minPrice)
          where.price.gte = Number.parseFloat(filters.minPrice);
        if (filters.maxPrice)
          where.price.lte = Number.parseFloat(filters.maxPrice);
      }

      if (filters.minBedrooms) {
        const existingBedrooms =
          typeof where.bedrooms === "object" && where.bedrooms
            ? where.bedrooms
            : {};
        where.bedrooms = {
          ...existingBedrooms,
          gte: Number.parseInt(filters.minBedrooms, 10),
        };
      }

      if (filters.maxBedrooms) {
        const existingBedrooms =
          typeof where.bedrooms === "object" && where.bedrooms
            ? where.bedrooms
            : {};
        where.bedrooms = {
          ...existingBedrooms,
          lte: Number.parseInt(filters.maxBedrooms, 10),
        };
      }

      if (filters.minBathrooms) {
        where.bathrooms = { gte: Number.parseInt(filters.minBathrooms, 10) };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
          { location: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      const orderBy: import("@prisma/client").Prisma.PropertyOrderByWithRelationInput =
        {};
      switch (filters.sortBy) {
        case "price":
          orderBy.price = filters.sortOrder;
          break;
        case "bedrooms":
          orderBy.bedrooms = filters.sortOrder;
          break;
        case "buildingSize":
          orderBy.buildingSize = filters.sortOrder;
          break;
        default:
          orderBy.createdAt = filters.sortOrder;
          break;
      }

      const [properties, total] = await Promise.all([
        propertyRepository.listProperties({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        propertyRepository.countProperties(where),
      ]);

      return ok({
        properties: properties.map(toPropertyListItemDto),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + properties.length < total,
      });
    } catch {
      // FIX: was "invalid_input" — infrastructure failures are "internal_error"
      return propertyError("internal_error", "Failed to fetch properties");
    }
  },

  async createProperty(
    actor: PropertyActor,
    data: CreatePropertyInput,
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<PropertyResult<PropertyCreateResultDto>> {
    const createCheck = await ensureUserCanCreateProperties(actor);
    if (!createCheck.ok) {
      return createCheck;
    }

    const userId = createCheck.data.userId;

    try {
      const slug = await propertyRepository.ensureUniqueSlug(
        data.title,
        data.slug,
      );
      const property = await propertyRepository.createProperty(
        userId,
        data,
        slug,
      );

      await propertyRepository.createConsentRecord({
        userId,
        ipAddress: options?.ipAddress,
        metadata: {
          action: "create_property",
          propertyId: property.id,
          propertyTitle: property.title,
          userAgent: options?.userAgent,
        } as import("@prisma/client").Prisma.InputJsonValue,
      });

      return ok(toPropertyCreateResultDto(property));
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2002") {
        // FIX: was "duplicate" — that code was not in PropertyDomainErrorCode
        return propertyError(
          "slug_conflict",
          "A property with this slug or title deed number already exists",
        );
      }
      return propertyError("internal_error", "Failed to create property");
    }
  },

  async createPropertiesBatch(
    actor: PropertyActor,
    data: CreatePropertyInput[],
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<
    PropertyResult<{ properties: PropertyCreateResultDto[]; count: number }>
  > {
    const createCheck = await ensureUserCanCreateProperties(actor);
    if (!createCheck.ok) {
      return createCheck;
    }

    const userId = createCheck.data.userId;
    const timestamp = Date.now();

    try {
      const properties: PropertyCreateResultDto[] = [];

      for (const [index, item] of data.entries()) {
        const slug = await propertyRepository.ensureUniqueSlug(
          item.title,
          item.slug,
          `${timestamp}-${index}`,
        );
        const created = await propertyRepository.createProperty(
          userId,
          item,
          slug,
        );
        properties.push(toPropertyCreateResultDto(created));
      }

      await propertyRepository.createConsentRecord({
        userId,
        ipAddress: options?.ipAddress,
        metadata: {
          action: "create_property_batch",
          propertyIds: properties.map((property) => property.id),
          count: properties.length,
          userAgent: options?.userAgent,
        } as import("@prisma/client").Prisma.InputJsonValue,
      });

      return ok({ properties, count: properties.length });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2002") {
        // FIX: was "duplicate" — that code was not in PropertyDomainErrorCode
        return propertyError(
          "slug_conflict",
          "A property with this slug or title deed number already exists",
        );
      }
      return propertyError("internal_error", "Failed to create property");
    }
  },

  async getPropertyDetail(
    propertyId: string,
    options?: {
      clerkId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<PropertyResult<PropertyDetailResultEnvelope>> {
    try {
      const property =
        await propertyRepository.findPropertyDetailById(propertyId);
      if (!property) {
        return propertyError("not_found", "Property not found");
      }

      if (options?.clerkId) {
        try {
          const viewerUserId = await propertyRepository.findUserIdByClerkId(
            options.clerkId,
          );
          if (viewerUserId && viewerUserId === property.agent?.userId) {
            await propertyRepository.createReadConsentRecord({
              userId: viewerUserId,
              propertyId: property.id,
              propertyTitle: property.title,
              ipAddress: options.ipAddress,
              userAgent: options.userAgent,
            });
          }
        } catch {
          // Consent logging must never block reads.
        }
      }

      propertyRepository.incrementViewCount(propertyId).catch(() => {});

      const similar = await propertyRepository.findSimilarProperties(
        propertyId,
        4,
      );

      return ok({
        property: toPropertyDetailDto(property),
        similarProperties: similar.map(toPropertyListItemDto),
      });
    } catch {
      return propertyError("internal_error", "Failed to fetch property");
    }
  },

  async getMyListings(
    actor: PropertyActor,
    options?: {
      limit?: number;
      status?: "all" | "active" | "pending" | "sold";
    },
  ): Promise<PropertyResult<MyListingsResultEnvelope>> {
    try {
      const properties = await propertyRepository.listMyProperties(
        getActorUserId(actor),
        {
          limit: Math.min(options?.limit ?? 50, 50),
          status: options?.status ?? "active",
        },
      );

      return ok({ properties: properties.map(toMyPropertyListingDto) });
    } catch {
      return propertyError("internal_error", "Failed to fetch listings");
    }
  },

  async getSimilarProperties(
    propertyId: string,
    limit: number,
  ): Promise<
    PropertyResult<{
      properties: import("@/app/lib/domains/properties/contracts").PropertyListItem[];
    }>
  > {
    try {
      const properties = await propertyRepository.findSimilarProperties(
        propertyId,
        limit,
      );
      return ok({ properties: properties.map(toPropertyListItemDto) });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to fetch similar properties",
      );
    }
  },

  async updateProperty(
    propertyId: string,
    actor: PropertyActor,
    data: import("@/app/lib/domains/properties/operations").UpdatePropertyData,
    context: PropertyOperationContext,
    expectedVersion: number,
  ): Promise<PropertyResult<PropertyUpdateResultDto>> {
    try {
      return await propertyRepository.withTransaction(
        async (tx) => {
          const property = await propertyRepository.findPropertyMutationState(
            propertyId,
            tx,
          );

          if (!property) {
            return propertyError("not_found", "Property not found");
          }

          if (property.agentId !== getActorUserId(actor)) {
            return propertyError(
              "forbidden",
              "You do not have permission to update this property",
            );
          }

          if (property.version !== expectedVersion) {
            return mapPropertyConflict(property, expectedVersion);
          }

          const updatePayload = buildPropertyUpdatePayload(
            data,
            getActorUserId(actor),
          );
          const updated = await propertyRepository.updatePropertyWithVersion(
            propertyId,
            expectedVersion,
            updatePayload,
            tx,
          );

          if (!updated.property) {
            const currentVersion =
              (await propertyRepository.findPropertyVersion(propertyId)) ??
              expectedVersion;
            return propertyError(
              "conflict",
              "Property has been modified. Retry with the latest version.",
              {
                currentVersion,
                expectedVersion,
              },
            );
          }

          const version = expectedVersion + 1;

          await propertyRepository.createConsentRecord(
            {
              userId: context.userId,
              ipAddress: context.ipAddress,
              metadata: {
                action: "update_property",
                propertyId,
                propertyTitle: property.title,
                correlationId: context.correlationId,
                idempotencyKey: context.idempotencyKey,
                newVersion: version,
                changes: Object.keys(data),
                userAgent: context.userAgent,
              } as import("@prisma/client").Prisma.InputJsonValue,
            },
            tx,
          );

          return ok(toUpdateResult(updated.property, version));
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch {
      return propertyError("internal_error", "Failed to update property");
    }
  },

  async updatePropertyWithRetry(
    propertyId: string,
    actor: PropertyActor,
    data: import("@/app/lib/domains/properties/operations").UpdatePropertyData,
    context: PropertyOperationContext,
    expectedVersion: number,
    retry: {
      maxRetries: number;
      retryDelayMs: number;
    },
  ): Promise<PropertyResult<PropertyUpdateResultDto>> {
    let effectiveVersion = expectedVersion;
    const maxRetries = Math.max(retry.maxRetries, 1);

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const result = await this.updateProperty(
        propertyId,
        actor,
        data,
        context,
        effectiveVersion,
      );

      if (result.ok || result.error !== "conflict") {
        return result;
      }

      if (attempt < maxRetries - 1) {
        const currentVersion =
          (await propertyRepository.findPropertyVersion(propertyId)) ??
          effectiveVersion + 1;
        effectiveVersion = currentVersion;

        await new Promise((resolve) =>
          setTimeout(resolve, retry.retryDelayMs * (attempt + 1)),
        );
      }
    }

    return propertyError(
      "conflict",
      "Property has been modified. Retry with the latest version.",
      {
        expectedVersion,
      },
    );
  },

  async deleteProperty(
    propertyId: string,
    actor: PropertyActor,
    context: PropertyOperationContext,
    expectedVersion: number,
  ): Promise<PropertyResult<PropertyDeleteResultDto>> {
    try {
      return await propertyRepository.withTransaction(
        async (tx) => {
          const property = await propertyRepository.findPropertyMutationState(
            propertyId,
            tx,
          );

          if (!property) {
            return propertyError("not_found", "Property not found");
          }

          if (property.agentId !== getActorUserId(actor)) {
            return propertyError(
              "forbidden",
              "You do not have permission to delete this property",
            );
          }

          if (property.version !== expectedVersion) {
            return mapPropertyConflict(property, expectedVersion);
          }

          const deletedAt = toPropertyDto(new Date()) as unknown as string;
          const count = await propertyRepository.softDeletePropertyWithVersion(
            propertyId,
            expectedVersion,
            tx,
          );

          if (count === 0) {
            const currentVersion =
              (await propertyRepository.findPropertyVersion(propertyId)) ??
              expectedVersion;
            return propertyError(
              "conflict",
              "Property has been modified. Retry with the latest version.",
              { currentVersion, expectedVersion },
            );
          }

          const version = expectedVersion + 1;

          await propertyRepository.createConsentRecord(
            {
              userId: context.userId,
              ipAddress: context.ipAddress,
              metadata: {
                action: "delete_property",
                propertyId,
                propertyTitle: property.title,
                correlationId: context.correlationId,
                idempotencyKey: context.idempotencyKey,
                newVersion: version,
                userAgent: context.userAgent,
              } as import("@prisma/client").Prisma.InputJsonValue,
            },
            tx,
          );

          return ok({
            message: "Property deleted successfully",
            propertyId,
            propertyTitle: property.title,
            deletedAt,
            version,
          });
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch {
      return propertyError("internal_error", "Failed to delete property");
    }
  },

  async getPropertyDocuments(
    propertyId: string,
    actor: PropertyActor,
  ): Promise<PropertyResult<PropertyDocumentDto[]>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    try {
      const documents =
        await propertyRepository.listPropertyDocuments(propertyId);
      return ok(documents.map(toPropertyDocumentDto));
    } catch {
      return propertyError(
        "internal_error",
        "Failed to fetch property documents",
      );
    }
  },

  async addPropertyDocument(
    propertyId: string,
    actor: PropertyActor,
    data: CreateDocumentInput,
  ): Promise<PropertyResult<PropertyMutationResultDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const assetAccess = await ensureAssetAccessible(data.assetId, actor);
    if (!assetAccess.ok) {
      return assetAccess;
    }

    try {
      const document = await propertyRepository.createPropertyDocument(
        propertyId,
        getActorUserId(actor),
        data,
      );
      return ok({ id: document.id });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to create property document",
      );
    }
  },

  async removePropertyDocument(
    propertyId: string,
    documentId: string,
    actor: PropertyActor,
  ): Promise<PropertyResult<{ success: boolean }>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    try {
      const document = await propertyRepository.findPropertyDocument(
        propertyId,
        documentId,
      );

      if (!document) {
        return propertyError("document_not_found", "Document not found");
      }

      await propertyRepository.deletePropertyDocument(documentId);
      return ok({ success: true });
    } catch {
      return propertyError("internal_error", "Failed to delete document");
    }
  },

  async updatePropertyDocument(
    propertyId: string,
    documentId: string,
    actor: PropertyActor,
    data: UpdateDocumentInput,
  ): Promise<PropertyResult<PropertyMutationResultDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const existing = await propertyRepository.findPropertyDocument(
      propertyId,
      documentId,
    );
    if (!existing) {
      return propertyError("document_not_found", "Document not found");
    }

    if (data.assetId) {
      const assetAccess = await ensureAssetAccessible(data.assetId, actor);
      if (!assetAccess.ok) {
        return assetAccess;
      }
    }

    try {
      const document = await propertyRepository.updatePropertyDocument(
        documentId,
        data,
      );
      return ok({ id: document.id });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to update property document",
      );
    }
  },

  /**
   * Replaces a property document atomically. Removes the old document and
   * creates a new one inside a single repository transaction.
   *
   * Previously this operation lived in the server action layer as
   * `replacePropertyDocumentAction` and was non-atomic (two sequential calls
   * with no transaction wrapper). Moving it here ensures the delete and create
   * either both succeed or both fail.
   */
  async replacePropertyDocument(
    propertyId: string,
    documentId: string,
    actor: PropertyActor,
    newData: CreateDocumentInput,
    context?: PropertyOperationContext,
  ): Promise<PropertyResult<PropertyMutationResultDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const existing = await propertyRepository.findPropertyDocument(
      propertyId,
      documentId,
    );
    if (!existing) {
      return propertyError("document_not_found", "Document not found");
    }

    const assetAccess = await ensureAssetAccessible(newData.assetId, actor);
    if (!assetAccess.ok) {
      return assetAccess;
    }

    try {
      const newDoc = await propertyRepository.withTransaction(async (tx) => {
        await propertyRepository.deletePropertyDocument(documentId, tx);
        return propertyRepository.createPropertyDocument(
          propertyId,
          getActorUserId(actor),
          newData,
          tx,
        );
      });
      return ok({ id: newDoc.id });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to replace property document",
        context?.correlationId
          ? { correlationId: context.correlationId }
          : undefined,
      );
    }
  },

  async getPropertyAttachments(
    propertyId: string,
    actor: PropertyActor,
  ): Promise<PropertyResult<PropertyAttachmentDto[]>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    try {
      const attachments =
        await propertyRepository.listPropertyAttachments(propertyId);
      return ok(attachments.map(toPropertyAttachmentDto));
    } catch {
      return propertyError(
        "internal_error",
        "Failed to fetch property attachments",
      );
    }
  },

  async getPropertyAttachmentById(
    propertyId: string,
    attachmentId: string,
    actor: PropertyActor,
  ): Promise<PropertyResult<PropertyAttachmentDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    try {
      const attachment = await propertyRepository.findPropertyAttachment(
        propertyId,
        attachmentId,
      );

      if (!attachment) {
        return propertyError("attachment_not_found", "Attachment not found");
      }

      return ok(toPropertyAttachmentDto(attachment));
    } catch {
      return propertyError(
        "internal_error",
        "Failed to fetch property attachment",
      );
    }
  },

  async addPropertyAttachment(
    propertyId: string,
    actor: PropertyActor,
    data: CreateAttachmentInput,
  ): Promise<PropertyResult<PropertyMutationResultDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const assetAccess = await ensureAssetAccessible(data.assetId, actor);
    if (!assetAccess.ok) {
      return assetAccess;
    }

    try {
      const attachment = await propertyRepository.withTransaction(
        async (tx) => {
          await propertyRepository.setPropertyVerificationPending(
            propertyId,
            tx,
          );
          return propertyRepository.createPropertyAttachment(
            propertyId,
            getActorUserId(actor),
            data,
            tx,
          );
        },
      );

      return ok({ id: attachment.id });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to create property attachment",
      );
    }
  },

  async updatePropertyAttachment(
    propertyId: string,
    actor: PropertyActor,
    data: UpdateAttachmentInput,
  ): Promise<PropertyResult<PropertyMutationResultDto>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const existing = await propertyRepository.findPropertyAttachment(
      propertyId,
      data.attachmentId,
    );
    if (!existing) {
      return propertyError("attachment_not_found", "Attachment not found");
    }

    if (data.assetId) {
      const assetAccess = await ensureAssetAccessible(data.assetId, actor);
      if (!assetAccess.ok) {
        return assetAccess;
      }
    }

    try {
      const attachment = await propertyRepository.withTransaction(
        async (tx) => {
          await propertyRepository.setPropertyVerificationPending(
            propertyId,
            tx,
          );
          return propertyRepository.updatePropertyAttachment(
            data.attachmentId,
            data,
            tx,
          );
        },
      );

      return ok({ id: attachment.id });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to update property attachment",
      );
    }
  },

  async removePropertyAttachment(
    propertyId: string,
    attachmentId: string,
    actor: PropertyActor,
  ): Promise<PropertyResult<{ success: boolean }>> {
    const ownership = await ensureOwnedProperty(propertyId, actor);
    if (!ownership.ok) {
      return ownership;
    }

    const existing = await propertyRepository.findPropertyAttachment(
      propertyId,
      attachmentId,
    );
    if (!existing) {
      return propertyError("attachment_not_found", "Attachment not found");
    }

    try {
      await propertyRepository.withTransaction(async (tx) => {
        await propertyRepository.setPropertyVerificationPending(propertyId, tx);
        await propertyRepository.deletePropertyAttachment(attachmentId, tx);
      });

      return ok({ success: true });
    } catch {
      return propertyError(
        "internal_error",
        "Failed to delete property attachment",
      );
    }
  },
};
