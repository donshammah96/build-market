/**
 * Stores Client
 *
 * Client-side facade for the stores subsystem. Provides a resilient,
 * type-safe API that interacts directly with browser-safe REST APIs.
 *
 * Features:
 * - Bulkhead (concurrency limiter) for heavy operations
 * - Normalized ApiResponse format
 * - Safe for browser and client-side bundlers (No Server Actions)
 */
import type { ApiResponse } from "@build/types";
import { STORES_CLIENT_CONFIG } from "@/lib/config/stores.config";
import { isValidId } from "@/lib/utils/validators";
import { z } from "zod";
import {
  CreateStoreSchema,
  UpdateStoreSchema,
  StoreQuerySchema,
} from "@/app/lib/validation/stores-validation";
import type {
  StoreListItem,
  StoreDetail,
  StoreDocumentItem,
  MyStoreWithStats,
  StoreUpdateResultEnvelope,
  StoreDeleteResultEnvelope,
} from "@/app/lib/domains/stores/contracts";

const { BULKHEAD_CONCURRENCY } = STORES_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type StoreQueryInput = z.infer<typeof StoreQuerySchema>;

export type CreateStoreClientInput = CreateStoreInput & {
  idempotencyKey?: string;
};
export type CreateStoresBatchClientInput = {
  stores: CreateStoreInput[];
  idempotencyKey?: string;
};
export type UpdateStoreClientInput = {
  id: string;
  data: UpdateStoreInput;
  version: number;
  idempotencyKey?: string;
};
export type DeleteStoreClientInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};
export type AddStoreDocumentClientInput = {
  storeId: string;
  type: string;
  assetId: string;
  notes?: string;
};
export type RemoveStoreDocumentClientInput = {
  storeId: string;
  documentId: string;
};

export type StoreListPayload = {
  stores: StoreListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type StoreBatchCreatePayload = {
  stores: StoreListItem[];
  count: number;
};

// ─── Helper API Fetcher ─────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `API Error: ${res.statusText}`,
      };
    }

    const payload = json?.data !== undefined ? json.data : json;
    return { success: true, data: payload as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Concurrency Limiter (Bulkhead Pattern) ─────────────────────────────────

class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      next?.();
    }
  }
}

// ─── Stores Client ──────────────────────────────────────────────────────────

class StoresClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getStores(
    filters?: Partial<StoreQueryInput>,
  ): Promise<ApiResponse<StoreListPayload>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<StoreListPayload>(
        `/api/stores?${searchParams.toString()}`,
      );
    });
  }

  async getStore(id: string): Promise<ApiResponse<StoreDetail>> {
    if (!isValidId(id)) return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() => apiFetch<StoreDetail>(`/api/stores/${id}`));
  }

  async getMyStores(): Promise<ApiResponse<MyStoreWithStats[]>> {
    return this.bulkhead.run(() =>
      apiFetch<MyStoreWithStats[]>("/api/stores/me"),
    );
  }

  async createStore(
    data: CreateStoreClientInput,
  ): Promise<ApiResponse<StoreDetail>> {
    return this.bulkhead.run(() =>
      apiFetch<StoreDetail>("/api/stores", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async createStoresBatch(
    data: CreateStoresBatchClientInput,
  ): Promise<ApiResponse<StoreBatchCreatePayload>> {
    return this.bulkhead.run(() =>
      apiFetch<StoreBatchCreatePayload>("/api/stores", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateStore(
    input: UpdateStoreClientInput,
  ): Promise<ApiResponse<StoreUpdateResultEnvelope>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<StoreUpdateResultEnvelope>(`/api/stores/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...input.data, version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async deleteStore(
    input: DeleteStoreClientInput,
  ): Promise<ApiResponse<StoreDeleteResultEnvelope>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<StoreDeleteResultEnvelope>(`/api/stores/${input.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getStoreDocuments(
    storeId: string,
  ): Promise<ApiResponse<{ documents: StoreDocumentItem[] }>> {
    if (!isValidId(storeId))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<{ documents: StoreDocumentItem[] }>(
        `/api/stores/${storeId}/documents`,
      ),
    );
  }

  async addStoreDocument(
    input: AddStoreDocumentClientInput,
  ): Promise<ApiResponse<StoreDocumentItem>> {
    if (!isValidId(input.storeId))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<StoreDocumentItem>(`/api/stores/${input.storeId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          type: input.type,
          assetId: input.assetId,
          notes: input.notes,
        }),
      }),
    );
  }

  async removeStoreDocument(
    input: RemoveStoreDocumentClientInput,
  ): Promise<ApiResponse<{ success: true }>> {
    if (!isValidId(input.storeId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<{ success: true }>(
        `/api/stores/${input.storeId}/documents/${input.documentId}`,
        {
          method: "DELETE",
        },
      ),
    );
  }
}

export const storesClient = new StoresClient();
export default storesClient;
