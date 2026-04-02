import type { ApiResponse } from "@build/types";
import { PROPERTIES_CLIENT_CONFIG } from "@/lib/config/properties.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
} from "@/lib/validation/properties-validation";

import type {
  PropertyListItem,
  PropertyDetail,
  PropertyListResultEnvelope,
  PropertyDetailResultEnvelope,
  MyPropertyListing,
  PropertyDocumentDto,
  PropertyAttachmentDto,
  PropertyCreateResultDto,
  PropertyMutationResultDto,
} from "@/app/lib/domains/properties/contracts";

export type {
  PropertyListItem,
  PropertyDetail,
  PropertyListResultEnvelope,
  MyPropertyListing,
  PropertyDocumentDto,
  PropertyAttachmentDto,
  PropertyCreateResultDto,
  PropertyMutationResultDto,
};

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

/** Backward-compatible alias for components still using the old name. */
export type PropertyListPayload = PropertyListResultEnvelope;
export type PropertyDetailPayload = PropertyDetailResultEnvelope;
export type MyPropertiesPayload = { properties: MyPropertyListing[] };
export type SimilarPropertiesPayload = { properties: PropertyListItem[] };

/** Create returns PropertyCreateResultDto; update/delete return PropertyMutationResultDto. */
export type PropertyMutationPayload =
  | PropertyCreateResultDto
  | PropertyMutationResultDto;

export type CreatePropertiesBatchPayload = {
  properties: PropertyCreateResultDto[];
  count?: number;
};

/** @deprecated Use PropertyDocumentDto for documents. */
export type PropertyAttachment = PropertyDocumentDto;

export type PropertyDocumentsPayload = PropertyDocumentDto[];

export type PropertyDocumentMutationPayload = PropertyMutationResultDto;

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
  ): Promise<ApiResponse<PropertyListPayload>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<PropertyListPayload>(
        `/api/properties?${searchParams.toString()}`,
      );
    });
  }

  async getProperty(id: string): Promise<ApiResponse<PropertyDetailPayload>> {
    if (!isValidId(id)) return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<PropertyDetailPayload>(`/api/properties/${id}`),
    );
  }

  async getMyProperties(options?: {
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<MyPropertiesPayload>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (options?.limit) searchParams.append("limit", String(options.limit));
      if (options?.status) searchParams.append("status", options.status);
      return apiFetch<MyPropertiesPayload>(
        `/api/properties/my-listings?${searchParams.toString()}`,
      );
    });
  }

  async getSimilarProperties(
    propertyId: string,
    limit?: number,
  ): Promise<ApiResponse<SimilarPropertiesPayload>> {
    if (!isValidId(propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() => {
      const limitQuery = limit ? `?limit=${limit}` : "";
      return apiFetch<SimilarPropertiesPayload>(
        `/api/properties/${propertyId}/similar${limitQuery}`,
      );
    });
  }

  async createProperty(
    data: CreatePropertyClientInput,
  ): Promise<ApiResponse<PropertyMutationPayload>> {
    return this.bulkhead.run(() =>
      apiFetch<PropertyMutationPayload>("/api/properties", {
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
  ): Promise<ApiResponse<CreatePropertiesBatchPayload>> {
    return this.bulkhead.run(() =>
      apiFetch<CreatePropertiesBatchPayload>("/api/properties", {
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
  ): Promise<ApiResponse<PropertyMutationPayload>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<PropertyMutationPayload>(`/api/properties/${input.id}`, {
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
  ): Promise<ApiResponse<PropertyMutationPayload>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<PropertyMutationPayload>(`/api/properties/${input.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getPropertyDocuments(
    propertyId: string,
  ): Promise<ApiResponse<PropertyDocumentsPayload>> {
    if (!isValidId(propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<PropertyDocumentsPayload>(
        `/api/properties/${propertyId}/documents`,
      ),
    );
  }

  async addPropertyDocument(
    input: AddPropertyDocumentClientInput,
  ): Promise<ApiResponse<PropertyDocumentMutationPayload>> {
    if (!isValidId(input.propertyId))
      return { success: false, error: "Invalid property ID" };
    return this.bulkhead.run(() =>
      apiFetch<PropertyDocumentMutationPayload>(
        `/api/properties/${input.propertyId}/documents`,
        {
          method: "POST",
          body: JSON.stringify({
            type: input.type,
            assetId: input.assetId,
            notes: input.notes,
          }),
        },
      ),
    );
  }

  async removePropertyDocument(
    input: RemovePropertyDocumentClientInput,
  ): Promise<ApiResponse<PropertyDocumentMutationPayload>> {
    if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<PropertyDocumentMutationPayload>(
        `/api/properties/${input.propertyId}/documents/${input.documentId}`,
        {
          method: "DELETE",
        },
      ),
    );
  }

  async replacePropertyDocument(
    input: ReplacePropertyDocumentClientInput,
  ): Promise<ApiResponse<PropertyDocumentMutationPayload>> {
    if (!isValidId(input.propertyId) || !isValidId(input.documentId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<PropertyDocumentMutationPayload>(
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
