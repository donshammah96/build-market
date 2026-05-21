import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  StoreDetailResult,
  StoreFilterInput,
  StoreListQuery,
  StorePageResult,
  StoreStatsResult,
  StoreUpdateInput,
  StoresActor,
  StoresDomainError,
} from "./contracts";
import { storesRepository } from "./repository";

// ============================================================================
// Capability helpers
// ============================================================================

function requireViewContent(
  actor: StoresActor,
): Result<true, StoresDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.success) {
    return err({
      code: "STORES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageContent(
  actor: StoresActor,
): Result<true, StoresDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.success) {
    return err({
      code: "STORES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireVerifyContent(
  actor: StoresActor,
): Result<true, StoresDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );
  if (!policy.success) {
    return err({
      code: "STORES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

// ============================================================================
// Query builder
// ============================================================================

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export function buildStoreListQuery(
  input: StoreFilterInput = {},
): Result<StoreListQuery, StoresDomainError> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

  return ok({
    page,
    limit,
    skip: (page - 1) * limit,
    search: input.search?.trim() || undefined,
    verified: input.verified,
    featured: input.featured,
    county: input.county,
    category: input.category,
    storeType: input.storeType,
    sortBy: input.sortBy ?? "createdAt",
    sortOrder: input.sortOrder ?? "desc",
  } as StoreListQuery);
}

// ============================================================================
// Service methods
// ============================================================================

export async function listStorePage(
  actor: StoresActor,
  input: StoreFilterInput = {},
): Promise<Result<StorePageResult, StoresDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const queryResult = buildStoreListQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [stores, total] = await Promise.all([
    storesRepository.listStores(query),
    storesRepository.countStores(query),
  ]);

  return ok({
    stores,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    filters: query,
  });
}

export async function getStoreDetail(
  actor: StoresActor,
  storeId: string,
): Promise<Result<StoreDetailResult, StoresDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const store = await storesRepository.findStoreById(storeId);
  if (!store)
    return err({ code: "STORES_NOT_FOUND", message: "Store not found" });

  return ok(store);
}

export async function getStoreStats(
  actor: StoresActor,
): Promise<Result<StoreStatsResult, StoresDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const stats = await storesRepository.getStoreStats();
  return ok(stats);
}

export async function updateStore(
  actor: StoresActor,
  storeId: string,
  data: StoreUpdateInput,
): Promise<
  Result<
    {
      updated: boolean;
      store: {
        id: string;
        name: string;
        verified: boolean;
        featured: boolean;
        updatedAt: Date;
      };
    },
    StoresDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const store = await storesRepository.updateStoreById(storeId, data);
  return ok({ updated: true, store });
}

export async function toggleStoreFeatured(
  actor: StoresActor,
  storeId: string,
): Promise<
  Result<
    {
      toggled: boolean;
      store: { id: string; name: string; featured: boolean };
    },
    StoresDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const current = await storesRepository.getStoreFeaturedStatus(storeId);
  if (!current)
    return err({ code: "STORES_NOT_FOUND", message: "Store not found" });

  const store = await storesRepository.updateStoreFeatured(
    storeId,
    !current.featured,
  );
  return ok({ toggled: true, store });
}

export async function verifyStore(
  actor: StoresActor,
  storeId: string,
  notes?: string,
): Promise<
  Result<
    {
      verified: boolean;
      store: { id: string; name: string; verified: boolean };
      oldStatus: string | null;
      notes: string | null;
    },
    StoresDomainError
  >
> {
  const cap = requireVerifyContent(actor);
  if (!cap.ok) return cap;

  const current = await storesRepository.findStoreVerificationStatus(storeId);
  if (!current)
    return err({ code: "STORES_NOT_FOUND", message: "Store not found" });

  const store = await storesRepository.updateStoreVerification(storeId, {
    verified: true,
    verificationStatus: "VERIFIED",
    verifiedAt: new Date(),
    rejectionReason: null,
  });

  return ok({
    verified: true,
    store,
    oldStatus: current.verificationStatus,
    notes: notes ?? null,
  });
}

export async function rejectStore(
  actor: StoresActor,
  storeId: string,
  reason: string,
  notes?: string,
): Promise<
  Result<
    {
      rejected: boolean;
      store: { id: string; name: string; verified: boolean };
      oldStatus: string | null;
    },
    StoresDomainError
  >
> {
  const cap = requireVerifyContent(actor);
  if (!cap.ok) return cap;

  if (!reason.trim()) {
    return err({
      code: "STORES_INVALID_FILTER",
      message: "Rejection reason is required",
    });
  }

  const current = await storesRepository.findStoreVerificationStatus(storeId);
  if (!current)
    return err({ code: "STORES_NOT_FOUND", message: "Store not found" });

  const store = await storesRepository.updateStoreVerification(storeId, {
    verified: false,
    verificationStatus: "REJECTED",
    verifiedAt: null,
    rejectionReason: reason,
  });

  return ok({
    rejected: true,
    store,
    oldStatus: current.verificationStatus,
    notes: notes ?? null,
  } as { rejected: boolean; store: typeof store; oldStatus: string | null });
}

export async function deleteStore(
  actor: StoresActor,
  storeId: string,
): Promise<
  Result<
    { deleted: boolean; storeId: string; storeName: string },
    StoresDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const store = await storesRepository.deleteStoreById(storeId);
  return ok({ deleted: true, storeId: store.id, storeName: store.name });
}

export const storesService = {
  buildStoreListQuery,
  listStorePage,
  getStoreDetail,
  getStoreStats,
  updateStore,
  toggleStoreFeatured,
  verifyStore,
  rejectStore,
  deleteStore,
};
