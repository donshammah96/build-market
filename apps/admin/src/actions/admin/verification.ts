"use server";

import { revalidatePath } from "next/cache";
import { safeVerificationAction, callClientApi } from "./shared";
import type {
  ActionResponse,
  PaginationMeta,
  EntityType,
  VerificationAction,
  VerificationStatus,
  VerificationQueueItem,
  VerificationStats,
  VerificationDetails,
  VerificationFilterInput,
  VerifyEntityInput,
  VerifyDocumentInput,
  BatchVerifyDocumentsInput,
} from "./types";
import {
  parseVerificationFilter,
  parseVerifyEntity,
  parseVerifyDocument,
  parseBatchVerifyDocuments,
} from "./types";

// Re-export types for consumers
export type {
  EntityType,
  VerificationAction,
  DocumentAction,
  VerificationStatus,
  VerificationQueueItem,
  VerificationStats,
  VerificationDetails,
  VerificationFilterInput,
  VerifyEntityInput,
  VerifyDocumentInput,
  BatchVerifyDocumentsInput,
} from "./types";

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get pending verifications with filters
 */
export async function getPendingVerifications(
  filters: Partial<VerificationFilterInput> = {}
): Promise<
  ActionResponse<{
    items: VerificationQueueItem[];
    pagination: PaginationMeta;
    filters: VerificationFilterInput;
  }>
> {
  return safeVerificationAction("getPendingVerifications", async () => {
    const validatedFilters = parseVerificationFilter(filters);

    const params = new URLSearchParams({
      entityType: validatedFilters.entityType,
      status: validatedFilters.status,
      page: String(validatedFilters.page),
      limit: String(validatedFilters.limit),
      sortBy: validatedFilters.sortBy,
      sortOrder: validatedFilters.sortOrder,
    });

    const response = await callClientApi<{
      success: boolean;
      data: {
        data: unknown[];
        pagination: PaginationMeta;
        filters: VerificationFilterInput;
      };
    }>(`/api/admin/pending-verifications?${params}`);

    // Transform API response to consistent shape
    const items: VerificationQueueItem[] = response.data.data.map(
      (item: unknown) => {
        const rawItem = item as Record<string, unknown>;
        return {
          entityType: rawItem.entityType as EntityType,
          entityId: String(rawItem.entityId ?? ""),
          name: String(
            rawItem.companyName ?? rawItem.name ?? rawItem.title ?? "Unknown"
          ),
          status: rawItem.status as VerificationStatus,
          submittedAt: rawItem.submittedAt ? String(rawItem.submittedAt) : null,
          createdAt: String(rawItem.createdAt ?? ""),
          owner: (rawItem.user ||
            rawItem.owner ||
            rawItem.agent) as VerificationQueueItem["owner"],
          documentCount: Number(rawItem.documentCount ?? 0),
          certificateCount: Number(rawItem.certificateCount ?? 0),
          productCount: Number(rawItem.productCount ?? 0),
          attachmentCount: Number(rawItem.attachmentCount ?? 0),
          imageCount: Number(rawItem.imageCount ?? 0),
          city: rawItem.city ? String(rawItem.city) : undefined,
          county: rawItem.county ? String(rawItem.county) : undefined,
          location: rawItem.location ? String(rawItem.location) : undefined,
        };
      }
    );

    return {
      items,
      pagination: response.data.pagination,
      filters: validatedFilters,
    };
  });
}

/**
 * Get verification statistics for dashboard
 */
export async function getVerificationStats(): Promise<
  ActionResponse<VerificationStats>
> {
  return safeVerificationAction("getVerificationStats", async () => {
    const response = await callClientApi<{
      success: boolean;
      data: VerificationStats;
    }>("/api/admin/verification-stats");

    return response.data;
  });
}

/**
 * Get detailed verification information for an entity
 */
export async function getVerificationDetails(
  entityType: EntityType,
  entityId: string
): Promise<ActionResponse<VerificationDetails>> {
  return safeVerificationAction("getVerificationDetails", async () => {
    const response = await callClientApi<{
      success: boolean;
      data: VerificationDetails;
    }>(`/api/admin/verification-details/${entityId}?entityType=${entityType}`);

    return response.data;
  });
}

/**
 * Verify, reject, or request correction for an entity
 */
export async function verifyEntity(
  input: VerifyEntityInput
): Promise<ActionResponse<{ newStatus: VerificationStatus; message: string }>> {
  return safeVerificationAction("verifyEntity", async () => {
    const validated = parseVerifyEntity(input);

    // Validate rejection requires reason
    if (validated.action === "REJECT" && !validated.reason) {
      throw new Error("Reason is required when rejecting");
    }

    const response = await callClientApi<{
      success: boolean;
      data: {
        newStatus: VerificationStatus;
        message: string;
      };
      message: string;
    }>("/api/admin/verify", {
      method: "POST",
      body: validated,
    });

    // Revalidate affected paths
    revalidatePath("/verifications");
    revalidatePath(
      `/verifications/${validated.entityType}/${validated.entityId}`
    );

    if (validated.entityType === "professional") {
      revalidatePath("/professionals");
    }

    return {
      newStatus: response.data.newStatus,
      message: response.message || response.data.message,
    };
  });
}

/**
 * Verify or reject a single document
 */
export async function verifyDocument(
  input: VerifyDocumentInput
): Promise<ActionResponse<{ message: string }>> {
  return safeVerificationAction("verifyDocument", async () => {
    const validated = parseVerifyDocument(input);

    const response = await callClientApi<{
      success: boolean;
      data: unknown;
      message: string;
    }>("/api/admin/verify-document", {
      method: "POST",
      body: validated,
    });

    // Revalidate verification pages
    revalidatePath("/verifications");

    return {
      message:
        response.message ||
        `Document ${validated.action.toLowerCase()}d successfully`,
    };
  });
}

/**
 * Batch verify/reject multiple documents
 */
export async function batchVerifyDocuments(
  input: BatchVerifyDocumentsInput
): Promise<
  ActionResponse<{
    summary: { total: number; successful: number; failed: number };
    results: Array<{ documentId: string; success: boolean; error?: string }>;
  }>
> {
  return safeVerificationAction("batchVerifyDocuments", async () => {
    const validated = parseBatchVerifyDocuments(input);

    const response = await callClientApi<{
      success: boolean;
      data: {
        results: Array<{
          documentId: string;
          success: boolean;
          result?: unknown;
        }>;
        errors: Array<{ documentId: string; success: boolean; error: string }>;
        summary: { total: number; successful: number; failed: number };
      };
    }>("/api/admin/verify-document", {
      method: "POST",
      body: validated,
    });

    // Revalidate verification pages
    revalidatePath("/verifications");

    return {
      summary: response.data.summary,
      results: [
        ...response.data.results.map((r) => ({
          documentId: r.documentId,
          success: r.success,
        })),
        ...response.data.errors.map((e) => ({
          documentId: e.documentId,
          success: false,
          error: e.error,
        })),
      ],
    };
  });
}

/**
 * Batch verify multiple entities at once
 */
export async function batchVerifyEntities(
  entities: Array<{ entityType: EntityType; entityId: string }>,
  action: VerificationAction,
  reason?: string
): Promise<
  ActionResponse<{
    summary: { total: number; successful: number; failed: number };
    results: Array<{
      entityType: EntityType;
      entityId: string;
      success: boolean;
      error?: string;
    }>;
  }>
> {
  return safeVerificationAction("batchVerifyEntities", async () => {
    // Validate rejection requires reason
    if (action === "REJECT" && !reason) {
      throw new Error("Reason is required when rejecting");
    }

    const results: Array<{
      entityType: EntityType;
      entityId: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process entities sequentially to avoid overwhelming the API
    for (const entity of entities) {
      try {
        await callClientApi("/api/admin/verify", {
          method: "POST",
          body: {
            entityType: entity.entityType,
            entityId: entity.entityId,
            action,
            reason,
          },
        });
        results.push({ ...entity, success: true });
      } catch (error) {
        results.push({
          ...entity,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Revalidate paths
    revalidatePath("/verifications");
    revalidatePath("/professionals");

    return {
      summary: {
        total: entities.length,
        successful,
        failed,
      },
      results,
    };
  });
}

// ============================================================================
// Polling Support
// ============================================================================

/**
 * Get verification queue updates for polling
 * Returns only items modified since the given timestamp
 */
export async function getVerificationUpdates(
  since: string,
  entityType: EntityType | "all" = "all"
): Promise<
  ActionResponse<{
    items: VerificationQueueItem[];
    hasUpdates: boolean;
    timestamp: string;
  }>
> {
  return safeVerificationAction("getVerificationUpdates", async () => {
    // For now, we'll fetch the full list and let the client filter
    // In production, you'd want a dedicated endpoint with timestamp filtering
    const response = await getPendingVerifications({
      entityType: entityType === "all" ? "all" : entityType,
      status: "PENDING",
      limit: 100,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to fetch updates");
    }

    const now = new Date().toISOString();
    const sinceDate = new Date(since);

    // Filter items that were updated after the given timestamp
    const updatedItems = response.data.items.filter((item) => {
      const itemDate = new Date(item.submittedAt || item.createdAt);
      return itemDate > sinceDate;
    });

    return {
      items: updatedItems,
      hasUpdates: updatedItems.length > 0,
      timestamp: now,
    };
  });
}
