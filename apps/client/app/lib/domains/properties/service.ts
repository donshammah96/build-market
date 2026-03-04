import { HttpStatus } from "@/app/lib/api/api-response";
import {
  createPropertiesBatch as createPropertiesBatchLegacy,
  createProperty as createPropertyLegacy,
  getMyProperties as getMyPropertiesLegacy,
  getProperties as getPropertiesLegacy,
  getPropertyById as getPropertyByIdLegacy,
  getPropertyDocuments as getPropertyDocumentsLegacy,
  getSimilarProperties as getSimilarPropertiesLegacy,
  addPropertyDocument as addPropertyDocumentLegacy,
  updatePropertyDocument as updatePropertyDocumentLegacy,
  removePropertyDocument as removePropertyDocumentLegacy,
  getPropertyAttachments as getPropertyAttachmentsLegacy,
  addPropertyAttachment as addPropertyAttachmentLegacy,
  updatePropertyAttachment as updatePropertyAttachmentLegacy,
  removePropertyAttachment as removePropertyAttachmentLegacy,
} from "@/lib/services/properties";
import {
  deletePropertyWithOptimisticLock,
  updatePropertyWithOptimisticLock,
  type PropertyOperationContext,
  type UpdatePropertyData,
} from "@/app/lib/services/property-operations.service";
import type {
  CreatePropertyInput,
  CreateAttachmentInput,
  PropertyQueryInput,
  UpdateAttachmentInput,
} from "@/app/lib/domains/properties/contracts";
import { propertyRepository } from "@/app/lib/domains/properties/repository";

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const fail = <T>(status: number, message: string): ServiceResult<T> => ({
  ok: false,
  status,
  message,
});

export const propertiesService = {
  async listProperties(
    filters: PropertyQueryInput,
  ): Promise<ServiceResult<unknown>> {
    try {
      return { ok: true, data: await getPropertiesLegacy(filters) };
    } catch {
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch properties",
      );
    }
  },

  async createProperty(
    userId: string,
    data: CreatePropertyInput,
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await createPropertyLegacy(userId, data, options),
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (
        err?.message?.includes("suspended") ||
        err?.message?.includes("professionals")
      ) {
        return fail(HttpStatus.FORBIDDEN, err.message);
      }
      if (err?.code === "P2002") {
        return fail(
          HttpStatus.CONFLICT,
          "A property with this slug or title deed number already exists",
        );
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create property",
      );
    }
  },

  async createPropertiesBatch(
    userId: string,
    data: CreatePropertyInput[],
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await createPropertiesBatchLegacy(userId, data, options),
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (
        err?.message?.includes("suspended") ||
        err?.message?.includes("professionals")
      ) {
        return fail(HttpStatus.FORBIDDEN, err.message);
      }
      if (err?.code === "P2002") {
        return fail(
          HttpStatus.CONFLICT,
          "A property with this slug or title deed number already exists",
        );
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create property",
      );
    }
  },

  async getPropertyDetail(
    propertyId: string,
    options?: {
      clerkId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<ServiceResult<unknown>> {
    try {
      const property = await getPropertyByIdLegacy(propertyId);
      if (!property) {
        return fail(HttpStatus.NOT_FOUND, "Property not found");
      }

      if (options?.clerkId) {
        try {
          const userId = await propertyRepository.findUserIdByClerkId(
            options.clerkId,
          );
          if (userId && userId === property.agent.userId) {
            await propertyRepository.createReadConsentRecord({
              userId,
              propertyId: property.id,
              propertyTitle: property.title,
              ipAddress: options.ipAddress,
              userAgent: options.userAgent,
            });
          }
        } catch {
          // Consent logging failures should never block reads.
        }
      }

      // Fire-and-forget analytics update.
      propertyRepository.incrementViewCount(propertyId).catch(() => {});

      let similarProperties: unknown[] = [];
      try {
        similarProperties = await getSimilarPropertiesLegacy(propertyId, 4);
      } catch {
        similarProperties = [];
      }

      return { ok: true, data: { property, similarProperties } };
    } catch {
      return fail(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to fetch property");
    }
  },

  async getMyListings(
    userId: string,
    options?: {
      limit?: number;
      status?: "all" | "active" | "pending" | "sold";
    },
  ): Promise<ServiceResult<unknown>> {
    try {
      const properties = await getMyPropertiesLegacy(userId, options);
      return { ok: true, data: { properties } };
    } catch {
      return fail(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to fetch listings");
    }
  },

  async getSimilarProperties(
    propertyId: string,
    limit: number,
  ): Promise<ServiceResult<unknown>> {
    try {
      const properties = await getSimilarPropertiesLegacy(propertyId, limit);
      return { ok: true, data: { properties } };
    } catch {
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch similar properties",
      );
    }
  },

  async updateProperty(
    propertyId: string,
    userId: string,
    data: UpdatePropertyData,
    context: PropertyOperationContext,
    expectedVersion: number,
  ): Promise<ServiceResult<unknown>> {
    const result = await updatePropertyWithOptimisticLock(
      propertyId,
      userId,
      data,
      context,
      expectedVersion,
    );
    if (result.success) {
      return { ok: true, data: result };
    }
    if (result.error === "not_found") {
      return fail(HttpStatus.NOT_FOUND, "Property not found");
    }
    if (result.error === "forbidden") {
      return fail(
        HttpStatus.FORBIDDEN,
        "You do not have permission to update this property",
      );
    }
    return fail(
      HttpStatus.CONFLICT,
      "Property has been modified. Retry with the latest version.",
    );
  },

  async deleteProperty(
    propertyId: string,
    userId: string,
    context: PropertyOperationContext,
    expectedVersion: number,
  ): Promise<ServiceResult<unknown>> {
    const result = await deletePropertyWithOptimisticLock(
      propertyId,
      userId,
      context,
      expectedVersion,
    );
    if (result.success) {
      return { ok: true, data: result };
    }
    if (result.error === "not_found") {
      return fail(HttpStatus.NOT_FOUND, "Property not found");
    }
    if (result.error === "forbidden") {
      return fail(
        HttpStatus.FORBIDDEN,
        "You do not have permission to delete this property",
      );
    }
    return fail(
      HttpStatus.CONFLICT,
      "Property has been modified. Retry with the latest version.",
    );
  },

  async getPropertyDocuments(
    propertyId: string,
    userId: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await getPropertyDocumentsLegacy(propertyId, userId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "Property not found") {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (message === "Unauthorized") {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch property documents",
      );
    }
  },

  async addPropertyDocument(
    propertyId: string,
    userId: string,
    data: { type: string; assetId: string; notes?: string },
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await addPropertyDocumentLegacy(propertyId, userId, data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "Property not found" || message === "Asset not found") {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (
        message === "Unauthorized" ||
        message === "Unauthorized access to asset"
      ) {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create property document",
      );
    }
  },

  async removePropertyDocument(
    propertyId: string,
    documentId: string,
    userId: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      await removePropertyDocumentLegacy(propertyId, documentId, userId);
      return { ok: true, data: { success: true } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message === "Property not found" ||
        message === "Document not found"
      ) {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (message === "Unauthorized") {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to delete document",
      );
    }
  },

  async updatePropertyDocument(
    propertyId: string,
    documentId: string,
    userId: string,
    data: { type?: string; assetId?: string; notes?: string },
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await updatePropertyDocumentLegacy(
          propertyId,
          documentId,
          userId,
          data,
        ),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message === "Property not found" ||
        message === "Asset not found" ||
        message === "Document not found"
      ) {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (
        message === "Unauthorized" ||
        message === "Unauthorized access to asset"
      ) {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to update property document",
      );
    }
  },

  async getPropertyAttachments(
    propertyId: string,
    userId: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await getPropertyAttachmentsLegacy(propertyId, userId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message === "Property not found" ||
        message === "Attachment not found"
      ) {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (message === "Unauthorized") {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch property attachments",
      );
    }
  },

  async addPropertyAttachment(
    propertyId: string,
    userId: string,
    data: CreateAttachmentInput,
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await addPropertyAttachmentLegacy(propertyId, userId, data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "Property not found" || message === "Asset not found") {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (
        message === "Unauthorized" ||
        message === "Unauthorized access to asset"
      ) {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create property attachment",
      );
    }
  },

  async updatePropertyAttachment(
    propertyId: string,
    userId: string,
    data: UpdateAttachmentInput,
  ): Promise<ServiceResult<unknown>> {
    try {
      return {
        ok: true,
        data: await updatePropertyAttachmentLegacy(propertyId, userId, data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message === "Property not found" ||
        message === "Asset not found" ||
        message === "Attachment not found"
      ) {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (
        message === "Unauthorized" ||
        message === "Unauthorized access to asset"
      ) {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      if (message === "Attachment does not belong to this property") {
        return fail(HttpStatus.BAD_REQUEST, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to update property attachment",
      );
    }
  },

  async removePropertyAttachment(
    propertyId: string,
    attachmentId: string,
    userId: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      await removePropertyAttachmentLegacy(propertyId, attachmentId, userId);
      return { ok: true, data: { success: true } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message === "Property not found" ||
        message === "Attachment not found"
      ) {
        return fail(HttpStatus.NOT_FOUND, message);
      }
      if (message === "Unauthorized") {
        return fail(HttpStatus.FORBIDDEN, message);
      }
      if (message === "Attachment does not belong to this property") {
        return fail(HttpStatus.BAD_REQUEST, message);
      }
      return fail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to delete property attachment",
      );
    }
  },
};
