"use server";

import {
  getStores,
  getStoreById,
  getMyStores,
  createStore,
  createStoresBatch,
  updateStore,
  deleteStore,
  getStoreDocuments,
  addStoreDocument,
  removeStoreDocument,
} from "@/lib/services/stores";
import type {
  CreateStoreInput,
  UpdateStoreInput,
  StoreQueryInput,
  MyStoreWithStats,
  StoreListResult,
} from "@/lib/services/stores";
import {
  CreateStoreSchema,
  UpdateStoreSchema,
  StoreQuerySchema,
  BatchCreateStoresSchema,
} from "@/app/lib/validation/stores-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import { StoreEventService } from "@/app/lib/services/store-event.service";
import { isValidId } from "@/app/lib/utils/validators";
import { auth } from "@clerk/nextjs/server";
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

export type CreateStoreActionInput = CreateStoreInput & {
  idempotencyKey?: string;
};

export async function getStoresAction(
  filters?: Partial<StoreQueryInput>,
): ReturnType<typeof getStores> {
  const defaultFilters: StoreQueryInput = {
    page: "1",
    limit: "20",
    radius: "50",
    ...filters,
  };
  const parsed = StoreQuerySchema.safeParse(defaultFilters);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getStores(parsed.data);
}

export async function getStoreAction(
  id: string,
): ReturnType<typeof getStoreById> {
  if (!isValidId(id)) throw new Error("Invalid store ID");
  const store = await getStoreById(id);
  if (!store) throw new Error("Store not found");
  return store;
}

export async function getMyStoresAction(): Promise<MyStoreWithStats[]> {
  const dbUserId = await resolveDbUserId();
  return getMyStores(dbUserId);
}

export async function createStoreAction(data: CreateStoreActionInput) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreateStoreSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid store data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "store",
    dbUserId,
    "POST",
    undefined,
    STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as any;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const store = await createStore(dbUserId, payload);
    await IdempotencyService.complete(idempotencyKey, store);
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath("/professional-portal");
    return store;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type CreateStoresBatchActionInput = {
  stores: CreateStoreInput[];
  idempotencyKey?: string;
};

export async function createStoresBatchAction(
  data: CreateStoresBatchActionInput,
) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, stores } = data;
  const parsed = BatchCreateStoresSchema.safeParse({ stores });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid store data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "store",
    dbUserId,
    "POST",
    undefined,
    STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as any;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await createStoresBatch(dbUserId, payload.stores);
    await IdempotencyService.complete(idempotencyKey, result);
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath("/professional-portal");
    return result;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type UpdateStoreActionInput = {
  id: string;
  data: UpdateStoreInput;
  version: number;
  idempotencyKey?: string;
};

/** Return type of updateStoreAction on success */
export type UpdateStoreResult = Awaited<ReturnType<typeof updateStoreAction>>;

export async function updateStoreAction(input: UpdateStoreActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.id)) throw new Error("Invalid store ID");
  const parsed = UpdateStoreSchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      storeId: input.id,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "store",
    dbUserId,
    "PATCH",
    input.id,
    STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath(`/professional-portal/settings/stores/${input.id}`);
    return idempotencyCheck.response as any;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context: Parameters<typeof updateStore>[3] = {
    correlationId: "",
    userId: dbUserId,
    storeId: input.id,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      if (attempt > 0) {
        effectiveVersion = await StoreEventService.getCurrentVersion(input.id);
      }
      const result = await updateStore(
        input.id,
        dbUserId,
        parsed.data,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          store: result.data.store,
          version: result.newVersion,
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath(`/professional-portal/settings/stores/${input.id}`);
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Store not found");
      if (!result.success && result.error === "forbidden")
        throw new Error("Forbidden");
      if (!result.success && result.error === "conflict") {
        if (attempt >= STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Store was modified by another request. Please refresh and try again.",
          );
        }
        await new Promise((r) =>
          setTimeout(
            r,
            STORE_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to update store");
}

export type DeleteStoreActionInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteStoreAction(input: DeleteStoreActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.id)) throw new Error("Invalid store ID");

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", { storeId: input.id });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "store",
    dbUserId,
    "DELETE",
    input.id,
    STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/settings/stores");
    revalidatePath("/professional-portal");
    return idempotencyCheck.response as any;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context: Parameters<typeof deleteStore>[2] = {
    correlationId: "",
    userId: dbUserId,
    storeId: input.id,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  const result = await deleteStore(input.id, dbUserId, context, input.version);

  if (!result.success) {
    await IdempotencyService.fail(idempotencyKey);
    if (result.error === "not_found") throw new Error("Store not found");
    if (result.error === "forbidden") throw new Error("Forbidden");
    if (result.error === "conflict")
      throw new Error(
        "Store was modified by another request. Please refresh and try again.",
      );
    throw new Error("Failed to delete store");
  }

  const response = {
    message: "Store deleted successfully",
    storeId: input.id,
    deletedAt: new Date().toISOString(),
    version: result.newVersion,
  };
  await IdempotencyService.complete(idempotencyKey, response);
  revalidatePath("/professional-portal/settings/stores");
  revalidatePath("/professional-portal");
  return response;
}

export async function getStoreDocumentsAction(storeId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(storeId)) throw new Error("Invalid store ID");
  return getStoreDocuments(storeId, dbUserId);
}

export type AddStoreDocumentActionInput = {
  storeId: string;
  type: string;
  assetId: string;
  notes?: string;
};

export async function addStoreDocumentAction(
  input: AddStoreDocumentActionInput,
) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(input.storeId)) throw new Error("Invalid store ID");
  return addStoreDocument(input.storeId, dbUserId, {
    type: input.type,
    assetId: input.assetId,
    notes: input.notes,
  });
}

export type RemoveStoreDocumentActionInput = {
  storeId: string;
  documentId: string;
};

export async function removeStoreDocumentAction(
  input: RemoveStoreDocumentActionInput,
) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(input.storeId) || !isValidId(input.documentId)) {
    throw new Error("Invalid IDs");
  }
  return removeStoreDocument(input.storeId, input.documentId, dbUserId);
}
