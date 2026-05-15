"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyQueryInput,
} from "@/app/lib/domains/properties/contracts";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
  BatchCreatePropertiesSchema,
  createDocumentSchema,
} from "@/app/lib/validation/properties-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import {
  type ActionErrorCode,
  createActionFailure,
  executeThrowingSecureAction,
  statusForActionError,
  throwActionFailure,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
import {
  propertiesService,
  type MyPropertyListing,
  type PropertyDetail,
  type PropertyDeleteResultDto,
  type PropertyActor,
  type PropertyUpdateResultDto,
} from "@/app/lib/domains/properties";
import { revalidatePath } from "next/cache";

const PropertyIdActionSchema = z.object({
  id: z.string().uuid("Invalid property ID"),
});

const CreatePropertyActionSchema = CreatePropertySchema.extend({
  idempotencyKey: z.string().optional(),
});

function normalizePropertyActionErrorCode(code?: string): ActionErrorCode {
  switch (code) {
    case "unauthorized":
    case "forbidden":
    case "not_found":
    case "validation_error":
    case "conflict":
    case "invalid_input":
    case "invalid_state":
    case "limit_exceeded":
    case "internal":
      return code;
    case "internal_error":
      return "internal";
    case "suspended_account":
    case "not_professional":
    case "asset_unauthorized":
      return "forbidden";
    case "slug_conflict":
    case "duplicate":
    case "attachment_mismatch":
      return "conflict";
    case "asset_not_found":
    case "document_not_found":
    case "attachment_not_found":
      return "not_found";
    default:
      return "internal";
  }
}

function toPropertyActor(actor: {
  dbUserId: string;
  role: "ADMIN" | "PROFESSIONAL" | "CLIENT" | "SUPPORT" | null;
}): PropertyActor {
  return {
    userId: actor.dbUserId,
    role: actor.role ?? "unknown",
  };
}

export type CreatePropertyActionInput = CreatePropertyInput & {
  idempotencyKey?: string;
};

export async function getPropertiesAction(
  filters?: Partial<PropertyQueryInput>,
) {
  return executeThrowingSecureAction({
    operationName: "list_properties",
    input: filters,
    requireActor: false,
    schema: PropertyQuerySchema.partial().optional(),
    handler: async ({ input }) => {
      const parsedResult = PropertyQuerySchema.safeParse({
        page: "1",
        limit: "20",
        sortBy: "createdAt",
        sortOrder: "desc",
        ...input,
      });

      if (!parsedResult.success) {
        throwActionFailure(
          createActionFailure(
            "validation_error",
            parsedResult.error.issues[0]?.message ?? "Invalid query parameters",
            400,
            parsedResult.error.issues,
          ),
        );
      }

      const parsed = parsedResult.data;

      return unwrapResultOrThrow(
        await propertiesService.listProperties(parsed),
        "Failed to fetch properties",
      );
    },
  });
}

export async function getPropertyAction(id: string) {
  return executeThrowingSecureAction({
    operationName: "get_property_detail",
    input: { id },
    schema: PropertyIdActionSchema,
    requireActor: false,
    handler: async ({ input }) => {
      const detail = unwrapResultOrThrow(
        await propertiesService.getPropertyDetail(input.id),
        "Property not found",
      ) as { property: unknown };
      return detail.property;
    },
  });
}

export async function getSimilarPropertiesAction(
  propertyId: string,
  limit?: number,
) {
  return executeThrowingSecureAction({
    operationName: "get_similar_properties",
    input: { id: propertyId, limit },
    requireActor: false,
    schema: z.object({
      id: z.string().uuid("Invalid property ID"),
      limit: z.number().int().positive().max(20).optional(),
    }),
    handler: async ({ input }) => {
      const result = unwrapResultOrThrow(
        await propertiesService.getSimilarProperties(
          input.id,
          input.limit ?? 4,
        ),
        "Failed to fetch similar properties",
      ) as { properties: unknown[] };
      return result.properties;
    },
  });
}

export type MyPropertyListingDTO = Omit<
  MyPropertyListing,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export async function getMyPropertiesAction(options?: {
  limit?: number;
  status?: "all" | "active" | "pending" | "sold";
}): Promise<MyPropertyListingDTO[]> {
  return executeThrowingSecureAction({
    operationName: "get_my_listings",
    input: options,
    handler: async ({ actor, input }) => {
      const listingResult = unwrapResultOrThrow(
        await propertiesService.getMyListings(toPropertyActor(actor!), input),
        "Failed to fetch listings",
      ) as { properties: MyPropertyListing[] };
      return listingResult.properties;
    },
  });
}

export async function createPropertyAction(data: CreatePropertyActionInput) {
  return executeThrowingSecureAction({
    operationName: "create_property",
    input: data,
    schema: CreatePropertyActionSchema,
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...payload } = input;
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property",
        actor!.dbUserId,
        "POST",
        { ttlHours: PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return idempotencyCheck.response as unknown;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const property = unwrapResultOrThrow(
          await propertiesService.createProperty(
            toPropertyActor(actor!),
            payload,
          ),
          "Failed to create property",
        );
        await safeIdempotencyComplete(idempotencyKey, property);
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return property;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export type CreatePropertiesBatchActionInput = {
  properties: CreatePropertyInput[];
  idempotencyKey?: string;
};

export async function createPropertiesBatchAction(
  data: CreatePropertiesBatchActionInput,
) {
  return executeThrowingSecureAction({
    operationName: "create_property_batch",
    input: data,
    schema: z.object({
      properties: BatchCreatePropertiesSchema.shape.properties,
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, properties } = input;
      const payload = { properties };
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property",
        actor!.dbUserId,
        "POST",
        { ttlHours: PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return idempotencyCheck.response as unknown;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const result = unwrapResultOrThrow(
          await propertiesService.createPropertiesBatch(
            toPropertyActor(actor!),
            properties,
          ),
          "Failed to create properties",
        );
        await safeIdempotencyComplete(idempotencyKey, result);
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return result;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export type UpdatePropertyActionInput = {
  id: string;
  data: UpdatePropertyInput;
  version: number;
  idempotencyKey?: string;
};

export type PropertyDetailDTO = PropertyDetail;
export type UpdatePropertyResult = PropertyUpdateResultDto;

export async function updatePropertyAction(
  input: UpdatePropertyActionInput,
): Promise<UpdatePropertyResult> {
  return executeThrowingSecureAction({
    operationName: "update_property",
    input,
    schema: z.object({
      id: z.string().uuid("Invalid property ID"),
      data: UpdatePropertySchema,
      version: z.number().int().min(0),
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const actorRef = toPropertyActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          propertyId: input.id,
          version: input.version,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property",
        actor!.dbUserId,
        "PATCH",
        { ttlHours: PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        return idempotencyCheck.response as UpdatePropertyResult;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      // FIX: correlationId is now generated rather than passed as empty string.
      // An empty correlationId was stored in consent records and made log events
      // uncorrelatable (ADR-005).
      const context = {
        correlationId: randomUUID(),
        userId: actor!.dbUserId,
        propertyId: input.id,
        ipAddress: "",
        userAgent: "",
        idempotencyKey,
      };

      const serviceResult = await propertiesService.updatePropertyWithRetry(
        input.id,
        actorRef,
        input.data,
        context,
        input.version,
        {
          maxRetries: PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES,
          retryDelayMs: PROPERTY_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS,
        },
      );

      if (serviceResult.ok) {
        const result = serviceResult.data as PropertyUpdateResultDto;
        const response = {
          property: result.property,
          version: result.version,
        };
        await safeIdempotencyComplete(idempotencyKey, response);
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath(`/professional-portal/settings/properties/${input.id}`);
        return response;
      }

      await IdempotencyService.fail(idempotencyKey);
      const actionCode = normalizePropertyActionErrorCode(serviceResult.error);
      throwActionFailure(
        createActionFailure(
          actionCode,
          serviceResult.message ?? "Failed to update property",
          statusForActionError(actionCode),
        ),
      );

      throw new Error("unreachable");
    },
  });
}

export type DeletePropertyActionInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};

export type DeletePropertyResult = {
  message: string;
  propertyId: string;
  propertyTitle?: string;
  deletedAt: string;
  version: number;
};

export async function deletePropertyAction(
  input: DeletePropertyActionInput,
): Promise<DeletePropertyResult> {
  return executeThrowingSecureAction({
    operationName: "delete_property",
    input,
    schema: z.object({
      id: z.string().uuid("Invalid property ID"),
      version: z.number().int().min(0),
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const actorRef = toPropertyActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          propertyId: input.id,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property",
        actor!.dbUserId,
        "DELETE",
        { ttlHours: PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return idempotencyCheck.response as DeletePropertyResult;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      // FIX: correlationId generated rather than empty string (ADR-005)
      const context = {
        correlationId: randomUUID(),
        userId: actor!.dbUserId,
        propertyId: input.id,
        ipAddress: "",
        userAgent: "",
        idempotencyKey,
      };

      try {
        const result = unwrapResultOrThrow(
          await propertiesService.deleteProperty(
            input.id,
            actorRef,
            context,
            input.version,
          ),
          "Failed to delete property",
        ) as PropertyDeleteResultDto;

        const response = {
          message: result.message,
          propertyId: result.propertyId,
          propertyTitle: result.propertyTitle,
          deletedAt: result.deletedAt,
          version: result.version,
        };
        await safeIdempotencyComplete(idempotencyKey, response);
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath("/professional-portal");
        return response;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export async function getPropertyDocumentsAction(propertyId: string) {
  return executeThrowingSecureAction({
    operationName: "get_property_documents",
    input: { propertyId },
    schema: z.object({
      propertyId: z.string().uuid("Invalid property ID"),
    }),
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await propertiesService.getPropertyDocuments(input.propertyId, {
          userId: actor!.dbUserId,
          role: actor!.role ?? "unknown",
        }),
        "Failed to fetch property documents",
      ),
  });
}

export type AddPropertyDocumentActionInput = {
  propertyId: string;
} & z.infer<typeof createDocumentSchema>;

export async function addPropertyDocumentAction(
  input: AddPropertyDocumentActionInput,
) {
  return executeThrowingSecureAction({
    operationName: "create_property_document",
    input,
    schema: z.object({
      propertyId: z.string().uuid("Invalid property ID"),
      type: createDocumentSchema.shape.type,
      assetId: createDocumentSchema.shape.assetId,
      notes: createDocumentSchema.shape.notes,
    }),
    handler: async ({ actor, input }) => {
      const documentInputResult = createDocumentSchema.safeParse({
        type: input.type,
        assetId: input.assetId,
        notes: input.notes,
      });

      if (!documentInputResult.success) {
        throwActionFailure(
          createActionFailure(
            "validation_error",
            documentInputResult.error.issues[0]?.message ??
              "Invalid document payload",
            400,
            documentInputResult.error.issues,
          ),
        );
      }

      const documentInput = documentInputResult.data;

      return unwrapResultOrThrow(
        await propertiesService.addPropertyDocument(
          input.propertyId,
          toPropertyActor(actor!),
          documentInput,
        ),
        "Failed to create property document",
      );
    },
  });
}

export type RemovePropertyDocumentActionInput = {
  propertyId: string;
  documentId: string;
};

export async function removePropertyDocumentAction(
  input: RemovePropertyDocumentActionInput,
) {
  return executeThrowingSecureAction({
    operationName: "delete_property_document",
    input,
    schema: z.object({
      propertyId: z.string().uuid("Invalid property ID"),
      documentId: z.string().uuid("Invalid document ID"),
    }),
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await propertiesService.removePropertyDocument(
          input.propertyId,
          input.documentId,
          toPropertyActor(actor!),
        ),
        "Failed to delete document",
      ),
  });
}

export type ReplacePropertyDocumentActionInput = {
  propertyId: string;
  /** ID of the document to replace */
  documentId: string;
} & z.infer<typeof createDocumentSchema>;

/**
 * Replaces a property document atomically.
 *
 * FIX: Previously this action called removePropertyDocument and
 * addPropertyDocument sequentially with no transaction. If the second call
 * failed, the old document was already deleted with no rollback. The comment
 * even claimed it "uses a transaction to ensure atomicity" — which was
 * incorrect.
 *
 * The atomic replace is now implemented in propertiesService.replacePropertyDocument,
 * which runs both operations inside a single repository transaction. The action
 * simply delegates.
 */
export async function replacePropertyDocumentAction(
  input: ReplacePropertyDocumentActionInput,
) {
  return executeThrowingSecureAction({
    operationName: "replace_property_document",
    input,
    schema: z.object({
      propertyId: z.string().uuid("Invalid property ID"),
      documentId: z.string().uuid("Invalid document ID"),
      type: createDocumentSchema.shape.type,
      assetId: createDocumentSchema.shape.assetId,
      notes: createDocumentSchema.shape.notes,
    }),
    handler: async ({ actor, input }) => {
      const documentInputResult = createDocumentSchema.safeParse({
        type: input.type,
        assetId: input.assetId,
        notes: input.notes,
      });

      if (!documentInputResult.success) {
        throwActionFailure(
          createActionFailure(
            "validation_error",
            documentInputResult.error.issues[0]?.message ??
              "Invalid document payload",
            400,
            documentInputResult.error.issues,
          ),
        );
      }

      const documentInput = documentInputResult.data;

      const context = {
        correlationId: randomUUID(),
        userId: actor!.dbUserId,
        propertyId: input.propertyId,
        ipAddress: "",
        userAgent: "",
      };

      const result = unwrapResultOrThrow(
        await propertiesService.replacePropertyDocument(
          input.propertyId,
          input.documentId,
          toPropertyActor(actor!),
          documentInput,
          context,
        ),
        "Failed to replace property document",
      );

      revalidatePath("/professional-portal/settings/properties");
      return result;
    },
  });
}
