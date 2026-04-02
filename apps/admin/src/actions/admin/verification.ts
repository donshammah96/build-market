"use server";

import { revalidatePath } from "next/cache";
import { runWithIdempotency } from "./idempotency";
import {
  safeVerificationAction,
  callClientApi,
  requireAdminGranularRole,
  logAdminAction,
} from "./shared";
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

const VERIFICATION_MUTATION_ROLES = ["VERIFICATION_SPECIALIST"];
const VERIFICATION_IDEMPOTENCY_TTL_HOURS = 0.25;

/**
 * Get pending verifications with filters
 */
export async function getPendingVerifications(
  filters: Partial<VerificationFilterInput> = {},
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
            rawItem.companyName ?? rawItem.name ?? rawItem.title ?? "Unknown",
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
      },
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
  entityId: string,
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
  input: VerifyEntityInput,
  idempotencyKey: string,
): Promise<ActionResponse<{ newStatus: VerificationStatus; message: string }>> {
  return safeVerificationAction("verifyEntity", async ({ adminUserId }) => {
    await requireAdminGranularRole(VERIFICATION_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "verifyEntity",
      idempotencyKey,
      resourceId: `${input.entityType}:${input.entityId}:${input.action}`,
      ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const validated = parseVerifyEntity(input);

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

        revalidatePath("/verifications");
        revalidatePath(
          `/verifications/${validated.entityType}/${validated.entityId}`,
        );

        if (validated.entityType === "professional") {
          revalidatePath("/professionals");
        }

        await logAdminAction({
          userId: adminUserId,
          action: "VERIFY_ENTITY",
          targetType: validated.entityType,
          targetId: validated.entityId,
          details: {
            requestedAction: validated.action,
            reason: validated.reason,
            notes: validated.notes,
            newStatus: response.data.newStatus,
          },
          reason: validated.reason,
        });

        return {
          newStatus: response.data.newStatus,
          message: response.message || response.data.message,
        };
      },
    });
  });
}

/**
 * Verify or reject a single document
 */
export async function verifyDocument(
  input: VerifyDocumentInput,
  idempotencyKey: string,
): Promise<ActionResponse<{ message: string }>> {
  return safeVerificationAction("verifyDocument", async ({ adminUserId }) => {
    await requireAdminGranularRole(VERIFICATION_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "verifyDocument",
      idempotencyKey,
      resourceId: `${input.documentType}:${input.documentId}:${input.action}`,
      ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const validated = parseVerifyDocument(input);

        const response = await callClientApi<{
          success: boolean;
          data: unknown;
          message: string;
        }>("/api/admin/verify-document", {
          method: "POST",
          body: validated,
        });

        revalidatePath("/verifications");

        await logAdminAction({
          userId: adminUserId,
          action: "VERIFY_DOCUMENT",
          targetType: "document",
          targetId: validated.documentId,
          details: {
            documentType: validated.documentType,
            requestedAction: validated.action,
            notes: validated.notes,
          },
          reason: validated.notes,
        });

        return {
          message:
            response.message ||
            `Document ${validated.action.toLowerCase()}d successfully`,
        };
      },
    });
  });
}

/**
 * Batch verify/reject multiple documents
 */
export async function batchVerifyDocuments(
  input: BatchVerifyDocumentsInput,
  idempotencyKey: string,
): Promise<
  ActionResponse<{
    summary: { total: number; successful: number; failed: number };
    results: Array<{ documentId: string; success: boolean; error?: string }>;
  }>
> {
  return safeVerificationAction(
    "batchVerifyDocuments",
    async ({ adminUserId }) => {
      await requireAdminGranularRole(VERIFICATION_MUTATION_ROLES, adminUserId);

      return runWithIdempotency({
        adminUserId,
        actionName: "batchVerifyDocuments",
        idempotencyKey,
        resourceId: input.documents
          .map(
            (document) =>
              `${document.documentType}:${document.documentId}:${document.action}`,
          )
          .sort()
          .join(","),
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const validated = parseBatchVerifyDocuments(input);

          const response = await callClientApi<{
            success: boolean;
            data: {
              results: Array<{
                documentId: string;
                success: boolean;
                result?: unknown;
              }>;
              errors: Array<{
                documentId: string;
                success: boolean;
                error: string;
              }>;
              summary: { total: number; successful: number; failed: number };
            };
          }>("/api/admin/verify-document", {
            method: "POST",
            body: validated,
          });

          revalidatePath("/verifications");

          await logAdminAction({
            userId: adminUserId,
            action: "BATCH_VERIFY_DOCUMENTS",
            targetType: "document",
            targetId: "batch",
            details: {
              total: validated.documents.length,
              summary: response.data.summary,
            },
          });

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
        },
      });
    },
  );
}

/**
 * Batch verify multiple entities at once
 */
export async function batchVerifyEntities(
  entities: Array<{ entityType: EntityType; entityId: string }>,
  action: VerificationAction,
  idempotencyKey: string,
  reason?: string,
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
  return safeVerificationAction(
    "batchVerifyEntities",
    async ({ adminUserId }) => {
      await requireAdminGranularRole(VERIFICATION_MUTATION_ROLES, adminUserId);

      return runWithIdempotency({
        adminUserId,
        actionName: "batchVerifyEntities",
        idempotencyKey,
        resourceId: entities
          .map((entity) => `${entity.entityType}:${entity.entityId}`)
          .sort()
          .join(","),
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          if (action === "REJECT" && !reason) {
            throw new Error("Reason is required when rejecting");
          }

          const results: Array<{
            entityType: EntityType;
            entityId: string;
            success: boolean;
            error?: string;
          }> = [];

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

          revalidatePath("/verifications");
          revalidatePath("/professionals");

          await logAdminAction({
            userId: adminUserId,
            action: "BATCH_VERIFY_ENTITIES",
            targetType: "verification",
            targetId: "batch",
            details: {
              requestedAction: action,
              total: entities.length,
              successful,
              failed,
              reason,
            },
            reason,
          });

          return {
            summary: {
              total: entities.length,
              successful,
              failed,
            },
            results,
          };
        },
      });
    },
  );
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
  entityType: EntityType | "all" = "all",
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
