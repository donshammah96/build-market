"use server";

import { z } from "zod";
import {
  storesService,
  CreateStoreInput,
  UpdateStoreInput,
  StoreQueryInput,
  MyStoreWithStats,
  StoreOperationContext,
} from "@/app/lib/domains/stores";
import {
  CreateStoreSchema,
  UpdateStoreSchema,
  StoreQuerySchema,
  BatchCreateStoresSchema,
  createStoreDocumentSchema,
} from "@/app/lib/validation/stores-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import { StoreEventService } from "@/app/lib/domains/stores";
import {
  createActionFailure,
  executeThrowingSecureAction,
  resolveRequiredActionActor,
  throwActionFailure,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
import { isValidId } from "@/app/lib/utils/validators";
import { revalidatePath } from "next/cache";

const StoreIdActionSchema = z.object({
  id: z.string().uuid("Invalid store ID"),
});

const CreateStoreActionSchema = CreateStoreSchema.extend({
  idempotencyKey: z.string().optional(),
});

export type CreateStoreActionInput = CreateStoreInput & {
  idempotencyKey?: string;
};

export async function getStoresAction(
  filters?: Partial<StoreQueryInput>,
): Promise<unknown> {
  const defaultFilters: StoreQueryInput = {
    page: "1",
    limit: "20",
    radius: "50",
    ...filters,
  };
  const parsed = StoreQuerySchema.safeParse(defaultFilters);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throwActionFailure(
      createActionFailure(
        "validation_error",
        first?.message ?? "Invalid query parameters",
        400,
        parsed.error.issues,
      ),
    );
  }
  return unwrapResultOrThrow(
    await storesService.listStores(parsed.data),
    "Failed to fetch stores",
  );
}

export async function getStoreAction(id: string): Promise<unknown> {
  return executeThrowingSecureAction({
    input: { id },
    schema: StoreIdActionSchema,
    requireActor: false,
    handler: async ({ input }) =>
      unwrapResultOrThrow(
        await storesService.getStoreById(input.id),
        "Store not found",
      ),
  });
}

export async function getMyStoresAction(): Promise<MyStoreWithStats[]> {
  return executeThrowingSecureAction({
    handler: async ({ actor }) =>
      unwrapResultOrThrow(
        await storesService.listMyStores({
          userId: actor!.dbUserId,
          role: actor!.role,
        }),
        "Failed to fetch stores",
      ),
  });
}

export async function createStoreAction(data: CreateStoreActionInput) {
  return executeThrowingSecureAction({
    input: data,
    schema: CreateStoreActionSchema,
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...payload } = input;
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "store",
        actor!.dbUserId,
        "POST",
        undefined,
        STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath("/professional-portal");
        return idempotencyCheck.response as CreateStoreInput;
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
          await storesService.createStore(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            payload,
          ),
          "Failed to create store",
        );
        await IdempotencyService.complete(idempotencyKey, result);
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath("/professional-portal");
        return result;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export type CreateStoresBatchActionInput = {
  stores: CreateStoreInput[];
  idempotencyKey?: string;
};

export async function createStoresBatchAction(
  data: CreateStoresBatchActionInput,
) {
  return executeThrowingSecureAction({
    input: data,
    schema: z.object({
      stores: BatchCreateStoresSchema.shape.stores,
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, stores } = input;
      const payload = { stores };
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "store",
        actor!.dbUserId,
        "POST",
        undefined,
        STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/stores");
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
          await storesService.createStoresBatch(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            stores,
          ),
          "Failed to create stores",
        );
        await IdempotencyService.complete(idempotencyKey, result);
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath("/professional-portal");
        return result;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
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
  return executeThrowingSecureAction({
    input,
    schema: z.object({
      id: z.string().uuid("Invalid store ID"),
      data: UpdateStoreSchema,
      version: z.number().int().min(0),
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const actorRef = { userId: actor!.dbUserId, role: actor!.role };
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          storeId: input.id,
          ...input.data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "store",
        actor!.dbUserId,
        "PATCH",
        input.id,
        STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath(`/professional-portal/settings/stores/${input.id}`);
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

      const context: StoreOperationContext = {
        correlationId: "",
        userId: actor!.dbUserId,
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
            effectiveVersion = await StoreEventService.getCurrentVersion(
              input.id,
            );
          }

          const result = unwrapResultOrThrow(
            await storesService.updateStoreOptimistic({
              storeId: input.id,
              actor: actorRef,
              data: input.data,
              context,
              expectedVersion: effectiveVersion,
            }),
            "Failed to update store",
          );

          const response = {
            store: result.data,
            version: result.meta.version,
          };
          await IdempotencyService.complete(idempotencyKey, response);
          revalidatePath("/professional-portal/settings/stores");
          revalidatePath(`/professional-portal/settings/stores/${input.id}`);
          return response;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to update store";
          lastError = error instanceof Error ? error : new Error(message);
          if (
            message.includes("latest version") ||
            message.includes("modified")
          ) {
            if (attempt >= STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
              break;
            }
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                STORE_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
              ),
            );
            continue;
          }
          break;
        }
      }

      await IdempotencyService.fail(idempotencyKey);
      throw (
        lastError ??
        new Error(
          "Store was modified by another request. Please refresh and try again.",
        )
      );
    },
  });
}

export type DeleteStoreActionInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteStoreAction(input: DeleteStoreActionInput) {
  return executeThrowingSecureAction({
    input,
    schema: z.object({
      id: z.string().uuid("Invalid store ID"),
      version: z.number().int().min(0),
      idempotencyKey: z.string().optional(),
    }),
    handler: async ({ actor, input }) => {
      const actorRef = { userId: actor!.dbUserId, role: actor!.role };
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          storeId: input.id,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "store",
        actor!.dbUserId,
        "DELETE",
        input.id,
        STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/settings/stores");
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

      const context: StoreOperationContext = {
        correlationId: "",
        userId: actor!.dbUserId,
        storeId: input.id,
        ipAddress: "",
        userAgent: "",
        idempotencyKey,
      };

      try {
        const result = unwrapResultOrThrow(
          await storesService.deleteStoreOptimistic({
            storeId: input.id,
            actor: actorRef,
            context,
            expectedVersion: input.version,
          }),
          "Failed to delete store",
        );

        await IdempotencyService.complete(idempotencyKey, result);
        revalidatePath("/professional-portal/settings/stores");
        revalidatePath("/professional-portal");
        return result;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export async function getStoreDocumentsAction(storeId: string) {
  const dbUserId = await resolveRequiredActionActor();
  if (!isValidId(storeId)) {
    throwActionFailure(
      createActionFailure("validation_error", "Invalid store ID", 400),
    );
  }
  return unwrapResultOrThrow(
    await storesService.listStoreDocuments(storeId, {
      userId: dbUserId.dbUserId,
      role: dbUserId.role,
    }),
    "Failed to fetch documents",
  ).documents;
}

export type AddStoreDocumentActionInput = {
  storeId: string;
} & z.infer<typeof createStoreDocumentSchema>;

export async function addStoreDocumentAction(
  input: AddStoreDocumentActionInput,
) {
  const actor = await resolveRequiredActionActor();
  if (!isValidId(input.storeId)) {
    throwActionFailure(
      createActionFailure("validation_error", "Invalid store ID", 400),
    );
  }

  const documentInputResult = createStoreDocumentSchema.safeParse({
    type: input.type,
    assetId: input.assetId,
    notes: input.notes,
  });

  if (!documentInputResult.success) {
    throwActionFailure(
      createActionFailure(
        "validation_error",
        documentInputResult.error.issues[0]?.message ??
          "Invalid store document payload",
        400,
        documentInputResult.error.issues,
      ),
    );
  }

  const documentInput = documentInputResult.data;

  const result = await storesService.addStoreDocument(
    input.storeId,
    { userId: actor.dbUserId, role: actor.role },
    documentInput,
  );
  return unwrapResultOrThrow(result, "Failed to add document");
}

export type RemoveStoreDocumentActionInput = {
  storeId: string;
  documentId: string;
};

export async function removeStoreDocumentAction(
  input: RemoveStoreDocumentActionInput,
) {
  const actor = await resolveRequiredActionActor();
  if (!isValidId(input.storeId) || !isValidId(input.documentId)) {
    throwActionFailure(
      createActionFailure("validation_error", "Invalid IDs", 400),
    );
  }
  const result = await storesService.removeStoreDocument(
    input.storeId,
    input.documentId,
    { userId: actor.dbUserId, role: actor.role },
  );
  return unwrapResultOrThrow(result, "Failed to remove document");
}
