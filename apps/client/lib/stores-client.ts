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
import type { z } from "zod";
import {
  CreateStoreSchema,
  UpdateStoreSchema,
  StoreQuerySchema,
} from "@/lib/validation/stores-validation";

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

export interface StoreData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  version?: number;
  verificationStatus?: string | null;
  rejectionReason?: string | null;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  views: number;
}

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

    // Adapt to cases where API returns data inside a 'data' key or directly
    return { success: true, data: json?.data !== undefined ? json.data : json };
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
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<any>(`/api/stores?${searchParams.toString()}`);
    });
  }

  async getStore(id: string): Promise<ApiResponse<any>> {
    if (!isValidId(id)) return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() => apiFetch<any>(`/api/stores/${id}`));
  }

  async getMyStores(): Promise<ApiResponse<any[]>> {
    return this.bulkhead.run(() => apiFetch<any[]>("/api/stores/me"));
  }

  async createStore(data: CreateStoreClientInput): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() =>
      apiFetch<any>("/api/stores", {
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
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() =>
      apiFetch<any>("/api/stores", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateStore(input: UpdateStoreClientInput): Promise<ApiResponse<any>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/stores/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...input.data, version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async deleteStore(input: DeleteStoreClientInput): Promise<ApiResponse<any>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/stores/${input.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getStoreDocuments(storeId: string): Promise<ApiResponse<any[]>> {
    if (!isValidId(storeId))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<any[]>(`/api/stores/${storeId}/documents`),
    );
  }

  async addStoreDocument(
    input: AddStoreDocumentClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.storeId))
      return { success: false, error: "Invalid store ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/stores/${input.storeId}/documents`, {
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
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.storeId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(
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
