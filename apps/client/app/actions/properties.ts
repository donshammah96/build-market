"use server";

import {
  getProperties,
  getPropertyById,
  getMyProperties,
  getSimilarProperties,
  createProperty,
  createPropertiesBatch,
  updateProperty,
  deleteProperty,
  getPropertyDocuments,
  addPropertyDocument,
  removePropertyDocument,
  type MyPropertyListing,
} from "@/lib/services/properties";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyQueryInput,
} from "@/lib/services/properties";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
  BatchCreatePropertiesSchema,
  propertyDetailSelect,
} from "@/app/lib/validation/properties-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { isValidId } from "@/app/lib/utils/validators";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";

/**
 * Resolve Clerk userId to database user ID.
 */
async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

export type CreatePropertyActionInput = CreatePropertyInput & {
  idempotencyKey?: string;
};

export async function getPropertiesAction(
  filters?: Partial<PropertyQueryInput>,
) {
  const defaultFilters: PropertyQueryInput = {
    page: "1",
    limit: "20",
    sortBy: "createdAt",
    sortOrder: "desc",
    ...filters,
  };
  const parsed = PropertyQuerySchema.safeParse(defaultFilters);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getProperties(parsed.data);
}

export async function getPropertyAction(id: string) {
  if (!isValidId(id)) throw new Error("Invalid property ID");
  const property = await getPropertyById(id);
  if (!property) throw new Error("Property not found");
  return property;
}

export async function getSimilarPropertiesAction(
  propertyId: string,
  limit?: number,
) {
  if (!isValidId(propertyId)) throw new Error("Invalid property ID");
  return getSimilarProperties(propertyId, limit);
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
  const dbUserId = await resolveDbUserId();
  const properties = await getMyProperties(dbUserId, options);
  return properties.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function createPropertyAction(data: CreatePropertyActionInput) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreatePropertySchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid property data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property",
    dbUserId,
    "POST",
    undefined,
    PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as Awaited<
      ReturnType<typeof createProperty>
    >;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const property = await createProperty(dbUserId, payload);
    await IdempotencyService.complete(idempotencyKey, property);
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath("/professional-portal");
    return property;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type CreatePropertiesBatchActionInput = {
  properties: CreatePropertyInput[];
  idempotencyKey?: string;
};

export async function createPropertiesBatchAction(
  data: CreatePropertiesBatchActionInput,
) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, properties } = data;
  const parsed = BatchCreatePropertiesSchema.safeParse({ properties });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid property data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property",
    dbUserId,
    "POST",
    undefined,
    PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as Awaited<
      ReturnType<typeof createPropertiesBatch>
    >;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await createPropertiesBatch(dbUserId, payload.properties);
    await IdempotencyService.complete(idempotencyKey, result);
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath("/professional-portal");
    return result;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type UpdatePropertyActionInput = {
  id: string;
  data: UpdatePropertyInput;
  version: number;
  idempotencyKey?: string;
};

export type PropertyDetailDTO = Prisma.PropertyGetPayload<{
  select: typeof propertyDetailSelect;
}>;

export type UpdatePropertyResult = {
  property: PropertyDetailDTO;
  version: number;
};

export async function updatePropertyAction(
  input: UpdatePropertyActionInput,
): Promise<UpdatePropertyResult> {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.id)) throw new Error("Invalid property ID");
  const parsed = UpdatePropertySchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      propertyId: input.id,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property",
    dbUserId,
    "PATCH",
    input.id,
    PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath(`/professional-portal/settings/properties/${input.id}`);
    return idempotencyCheck.response as UpdatePropertyResult;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    propertyId: input.id,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      const result = await updateProperty(
        input.id,
        dbUserId,
        parsed.data,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          property: result.data.property,
          version: result.newVersion,
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath("/professional-portal/settings/properties");
        revalidatePath(`/professional-portal/settings/properties/${input.id}`);
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Property not found");
      if (!result.success && result.error === "forbidden")
        throw new Error("Forbidden");
      if (!result.success && result.error === "conflict") {
        if (attempt >= PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Property was modified by another request. Please refresh and try again.",
          );
        }
        const current = await prisma.property.findUnique({
          where: { id: input.id },
          select: { version: true },
        });
        effectiveVersion = current?.version ?? effectiveVersion + 1;
        await new Promise((r) =>
          setTimeout(
            r,
            PROPERTY_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to update property");
}

export type DeletePropertyActionInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};

export type DeletePropertyResult = {
  message: string;
  propertyId: string;
  deletedAt: string;
  version: number;
};

export async function deletePropertyAction(
  input: DeletePropertyActionInput,
): Promise<DeletePropertyResult> {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.id)) throw new Error("Invalid property ID");

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", {
      propertyId: input.id,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property",
    dbUserId,
    "DELETE",
    input.id,
    PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/properties");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as DeletePropertyResult;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    propertyId: input.id,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  const result = await deleteProperty(
    input.id,
    dbUserId,
    context,
    input.version,
  );

  if (!result.success) {
    await IdempotencyService.fail(idempotencyKey);
    if (result.error === "not_found") throw new Error("Property not found");
    if (result.error === "forbidden") throw new Error("Forbidden");
    if (result.error === "conflict")
      throw new Error(
        "Property was modified by another request. Please refresh and try again.",
      );
    throw new Error("Failed to delete property");
  }

  const response = {
    message: "Property deleted successfully",
    propertyId: input.id,
    deletedAt: new Date().toISOString(),
    version: result.newVersion,
  };
  await IdempotencyService.complete(idempotencyKey, response);
  revalidatePath("/professional-portal/settings/properties");
  revalidatePath("/professional-portal");
  return response;
}

export async function getPropertyDocumentsAction(propertyId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(propertyId)) throw new Error("Invalid property ID");
  return getPropertyDocuments(propertyId, dbUserId);
}

export type AddPropertyDocumentActionInput = {
  propertyId: string;
  type: string;
  assetId: string;
  notes?: string;
};

export async function addPropertyDocumentAction(
  input: AddPropertyDocumentActionInput,
) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(input.propertyId)) throw new Error("Invalid property ID");
  return addPropertyDocument(input.propertyId, dbUserId, {
    type: input.type,
    assetId: input.assetId,
    notes: input.notes,
  });
}

export type RemovePropertyDocumentActionInput = {
  propertyId: string;
  documentId: string;
};

export async function removePropertyDocumentAction(
  input: RemovePropertyDocumentActionInput,
) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
    throw new Error("Invalid IDs");
  }
  return removePropertyDocument(input.propertyId, input.documentId, dbUserId);
}

export type ReplacePropertyDocumentActionInput = {
  propertyId: string;
  /** ID of the document to replace */
  documentId: string;
  /** Asset ID for the new replacement document */
  assetId: string;
  /** Document type (e.g., TITLE_DEED) */
  type: string;
  notes?: string;
};

/**
 * Replaces a property document: removes the old one and adds a new one.
 * Uses a transaction to ensure atomicity.
 */
export async function replacePropertyDocumentAction(
  input: ReplacePropertyDocumentActionInput,
) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
    throw new Error("Invalid IDs");
  }

  // Remove old and add new in sequence (both functions validate ownership)
  await removePropertyDocument(input.propertyId, input.documentId, dbUserId);
  const newDoc = await addPropertyDocument(input.propertyId, dbUserId, {
    type: input.type,
    assetId: input.assetId,
    notes: input.notes,
  });

  revalidatePath("/professional-portal/settings/properties");
  return newDoc;
}
