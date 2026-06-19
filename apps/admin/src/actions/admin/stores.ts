"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/_core/safe-action";
import { runWithIdempotency } from "./idempotency";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";
import { storesService } from "@/lib/domains/stores/service";
import type {
  StoreFilterInput as DomainStoreFilterInput,
  StoreUpdateInput as DomainStoreUpdateInput,
} from "@/lib/domains/stores/contracts";
import { omitUndefined } from "@/lib/utils";

const StoreFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(10),
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
  featured: z.boolean().optional(),
  // phone, email, website intentionally excluded — not in Store model
});

type StoreFilterInput = z.infer<typeof StoreFilterSchema>;
type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;

const STORE_MUTATION_IDEMPOTENCY_TTL_HOURS = 0.25;

/**
 * Fetches a paginated list of stores with filtering and sorting.
 * Requires VIEW_CONTENT capability.
 */
export async function getStores(filters: Partial<StoreFilterInput> = {}) {
  return safeAction(AdminOperationName.LIST_STORES, async ({ actor }) => {
    const parsed = StoreFilterSchema.safeParse(filters);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid filter");
    }

    const result = await storesService.listStorePage(
      actor,
      omitUndefined(parsed.data) as unknown as DomainStoreFilterInput,
    );
    if (!result.ok) throw new Error(result.message ?? result.code);
    return result.data;
  });
}

/**
 * Fetches complete store details.
 * Requires VIEW_CONTENT capability.
 */
export async function getStoreDetails(storeId: string) {
  return safeAction(AdminOperationName.GET_STORE_DETAIL, async ({ actor }) => {
    const result = await storesService.getStoreDetail(actor, storeId);
    if (!result.ok) throw new Error(result.message ?? result.code);
    return result.data;
  });
}

/**
 * Gets store statistics for the dashboard.
 * Requires VIEW_CONTENT capability.
 */
export async function getStoreStats() {
  return safeAction(AdminOperationName.GET_STORE_STATS, async ({ actor }) => {
    const result = await storesService.getStoreStats(actor);
    if (!result.ok) throw new Error(result.message ?? result.code);
    return result.data;
  });
}

/**
 * Updates store information.
 * Requires MANAGE_CONTENT capability.
 */
export async function updateStore(storeId: string, data: UpdateStoreInput) {
  return safeAction(AdminOperationName.UPDATE_STORE, async ({ actor }) => {
    const parsed = UpdateStoreSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid update data");
    }

    const result = await storesService.updateStore(
      actor,
      storeId,
      omitUndefined(parsed.data) as unknown as DomainStoreUpdateInput,
    );
    if (!result.ok) throw new Error(result.message ?? result.code);

    revalidatePath("/stores");
    revalidatePath(`/stores/${storeId}`);

    return result.data;
  });
}

/**
 * Toggles store featured status.
 * Requires MANAGE_CONTENT capability.
 */
export async function toggleStoreFeatured(
  storeId: string,
  idempotencyKey: string,
) {
  return safeAction(
    AdminOperationName.TOGGLE_STORE_FEATURED,
    async ({ actor, adminUserId }) => {
      return runWithIdempotency({
        adminUserId,
        actionName: "toggleStoreFeatured",
        idempotencyKey,
        resourceId: storeId,
        ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await storesService.toggleStoreFeatured(
            actor,
            storeId,
          );
          if (!result.ok) throw new Error(result.message ?? result.code);

          revalidatePath("/stores");
          return result.data;
        },
      });
    },
    {
      auditLog: {
        operation: "TOGGLE_STORE_FEATURED",
        resourceType: "store",
        getTargetId: () => storeId,
        getDetails: ({ data }) => {
          const result = data as { store?: { featured?: boolean } } | undefined;
          return { storeId, featured: result?.store?.featured };
        },
      },
    },
  );
}

/**
 * Verifies a store.
 * Requires MANAGE_VERIFICATION capability. Enforces 300s session freshness.
 */
export async function verifyStore(
  storeId: string,
  idempotencyKey: string,
  notes?: string,
) {
  return safeAction(
    AdminOperationName.VERIFY_STORE,
    async ({ actor, adminUserId }) => {
      return runWithIdempotency({
        adminUserId,
        actionName: "verifyStore",
        idempotencyKey,
        resourceId: storeId,
        ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await storesService.verifyStore(actor, storeId, notes);
          if (!result.ok) throw new Error(result.message ?? result.code);

          revalidatePath("/stores");
          revalidatePath("/verifications");
          return result.data;
        },
      });
    },
    {
      auditLog: {
        operation: "VERIFY_STORE",
        resourceType: "store",
        getTargetId: () => storeId,
        getDetails: ({ data }) => {
          const result = data as
            | { oldStatus?: string | null; notes?: string | null }
            | undefined;
          return {
            storeId,
            oldStatus: result?.oldStatus,
            newStatus: "VERIFIED",
            notes: result?.notes,
          };
        },
      },
    },
  );
}

/**
 * Rejects store verification.
 * Requires MANAGE_VERIFICATION capability. Enforces 300s session freshness.
 */
export async function rejectStore(
  storeId: string,
  reason: string,
  idempotencyKey: string,
  notes?: string,
) {
  return safeAction(
    AdminOperationName.REJECT_STORE,
    async ({ actor, adminUserId }) => {
      return runWithIdempotency({
        adminUserId,
        actionName: "rejectStore",
        idempotencyKey,
        resourceId: storeId,
        ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await storesService.rejectStore(
            actor,
            storeId,
            reason,
            notes,
          );
          if (!result.ok) throw new Error(result.message ?? result.code);

          revalidatePath("/stores");
          revalidatePath("/verifications");
          return result.data;
        },
      });
    },
    {
      auditLog: {
        operation: "REJECT_STORE",
        resourceType: "store",
        getTargetId: () => storeId,
        getDetails: ({ data }) => {
          const result = data as { oldStatus?: string | null } | undefined;
          return {
            storeId,
            oldStatus: result?.oldStatus,
            newStatus: "REJECTED",
            reason,
            notes: notes ?? null,
          };
        },
        getReason: () => reason,
      },
    },
  );
}

/**
 * Deletes a store.
 * Requires MANAGE_CONTENT capability.
 */
export async function deleteStore(storeId: string, idempotencyKey: string) {
  return safeAction(
    AdminOperationName.DELETE_STORE,
    async ({ actor, adminUserId }) => {
      return runWithIdempotency({
        adminUserId,
        actionName: "deleteStore",
        idempotencyKey,
        resourceId: storeId,
        ttlHours: STORE_MUTATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await storesService.deleteStore(actor, storeId);
          if (!result.ok) throw new Error(result.message ?? result.code);

          revalidatePath("/stores");
          return result.data;
        },
      });
    },
    {
      auditLog: {
        operation: "DELETE_STORE",
        resourceType: "store",
        getTargetId: () => storeId,
        getDetails: ({ data }) => {
          const result = data as { storeName?: string } | undefined;
          return { storeId, storeName: result?.storeName };
        },
      },
    },
  );
}
