/**
 * Properties Client
 *
 * Client-side facade for the properties subsystem. Provides a resilient,
 * type-safe API that interacts directly with browser-safe REST APIs.
 *
 * Features:
 * - Bulkhead (concurrency limiter) for heavy operations
 * - Normalized ApiResponse format
 * - Safe for browser and client-side bundlers (No Server Actions)
 */
import type { ApiResponse } from "@build/types";
import { PROPERTIES_CLIENT_CONFIG } from "@/lib/config/properties.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
} from "@/lib/validation/properties-validation";

const { BULKHEAD_CONCURRENCY } = PROPERTIES_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof PropertyQuerySchema>;

export type CreatePropertyClientInput = CreatePropertyInput & {
  idempotencyKey?: string;
};
export type CreatePropertiesBatchClientInput = {
  properties: CreatePropertyInput[];
  idempotencyKey?: string;
};
export type UpdatePropertyClientInput = {
  id: string;
  data: UpdatePropertyInput;
  version: number;
  idempotencyKey?: string;
};
export type DeletePropertyClientInput = {
  id: string;
  version: number;
  idempotencyKey?: string;
};
export type AddPropertyDocumentClientInput = {
  propertyId: string;
  type: string;
  assetId: string;
  notes?: string;
};
export type RemovePropertyDocumentClientInput = {
  propertyId: string;
  documentId: string;
};
export type ReplacePropertyDocumentClientInput = {
  propertyId: string;
  documentId: string;
  type: string;
  assetId: string;
  notes?: string;
};

export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  status: "active" | "pending" | "sold" | "rented";
  views: number;
  inquiries: number;
  images: string[];
  version: number;
  verificationStatus?:
    | "UNVERIFIED"
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "NEEDS_CORRECTION";
  rejectionReason?: string | null;
}

export interface PropertyAttachment {
  id: string;
  asset?: {
    id: string;
    cdnUrl: string;
  } | null;
  /** @deprecated use asset.cdnUrl instead */
  fileUrl?: string | null;
  /** @deprecated */
  fileKey?: string | null;
  type: string;
  isVerified: boolean;
  verifiedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
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

// ─── Properties Client ─────────────────────────────────────────────────────

class PropertiesClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getProperties(
    filters?: Partial<PropertyQueryInput>,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<any>(`/api/properties?${searchParams.toString()}`);
    });
  }

  async getProperty(id: string): Promise<ApiResponse<any>> {
    if (!isValidId(id)) return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() => apiFetch<any>(`/api/properties/${id}`));
  }

  async getMyProperties(options?: {
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (options?.limit) searchParams.append("limit", String(options.limit));
      if (options?.status) searchParams.append("status", options.status);
      return apiFetch<any[]>(
        `/api/properties/my-listings?${searchParams.toString()}`,
      );
    });
  }

  async getSimilarProperties(
    propertyId: string,
    limit?: number,
  ): Promise<ApiResponse<any[]>> {
    if (!isValidId(propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() => {
      const limitQuery = limit ? `?limit=${limit}` : "";
      return apiFetch<any[]>(
        `/api/properties/${propertyId}/similar${limitQuery}`,
      );
    });
  }

  async createProperty(
    data: CreatePropertyClientInput,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() =>
      apiFetch<any>("/api/properties", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async createPropertiesBatch(
    data: CreatePropertiesBatchClientInput,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() =>
      apiFetch<any>("/api/properties", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateProperty(
    input: UpdatePropertyClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/properties/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...input.data, version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async deleteProperty(
    input: DeletePropertyClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/properties/${input.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getPropertyDocuments(propertyId: string): Promise<ApiResponse<any[]>> {
    if (!isValidId(propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<any[]>(`/api/properties/${propertyId}/documents`),
    );
  }

  async addPropertyDocument(
    input: AddPropertyDocumentClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/properties/${input.propertyId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          type: input.type,
          assetId: input.assetId,
          notes: input.notes,
        }),
      }),
    );
  }

  async removePropertyDocument(
    input: RemovePropertyDocumentClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(
        `/api/properties/${input.propertyId}/documents/${input.documentId}`,
        {
          method: "DELETE",
        },
      ),
    );
  }

  async replacePropertyDocument(
    input: ReplacePropertyDocumentClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(
        `/api/properties/${input.propertyId}/documents/${input.documentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            type: input.type,
            assetId: input.assetId,
            notes: input.notes,
          }),
        },
      ),
    );
  }
}

export const propertiesClient = new PropertiesClient();
export default propertiesClient;
