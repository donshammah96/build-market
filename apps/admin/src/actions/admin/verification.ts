"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runWithIdempotency } from "./idempotency";
import { safeAction } from "./shared";
import {
  verificationService,
  type VerificationQueueItem as DomainVerificationQueueItem,
  type VerificationDocumentType,
} from "@/lib/domains/verification";
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

const VERIFICATION_IDEMPOTENCY_TTL_HOURS = 0.25;
const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(1, "Idempotency-Key is required");
const BatchEntitySchema = z
  .object({
    entities: z
      .array(
        z
          .object({
            entityType: z.enum(["professional", "store", "property"]),
            entityId: z.string().uuid(),
          })
          .strict(),
      )
      .min(1, "At least one entity is required"),
    action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
    reason: z.string().optional(),
  })
  .strict();

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}

function mapQueueItem(item: DomainVerificationQueueItem): VerificationQueueItem {
  return {
    entityType: item.entityType,
    entityId: item.entityId,
    name: item.name,
    status: item.status as VerificationStatus,
    submittedAt: item.submittedAt ? item.submittedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    owner: item.owner,
    ...(item.documentCount !== undefined
      ? { documentCount: item.documentCount }
      : {}),
    ...(item.certificateCount !== undefined
      ? { certificateCount: item.certificateCount }
      : {}),
    ...(item.productCount !== undefined
      ? { productCount: item.productCount }
      : {}),
    ...(item.attachmentCount !== undefined
      ? { attachmentCount: item.attachmentCount }
      : {}),
    ...(item.imageCount !== undefined ? { imageCount: item.imageCount } : {}),
    ...(item.city !== undefined ? { city: item.city } : {}),
    ...(item.county !== undefined ? { county: item.county } : {}),
    ...(item.location ?? undefined ? { location: item.location ?? undefined } : {}),
  };
}

function toDocumentAuditResourceType(documentType: VerificationDocumentType) {
  if (documentType === "property_document") {
    return "property_document";
  }

  if (documentType === "certificate") {
    return "certificate";
  }

  return "professional_document";
}

function revalidateVerificationEntity(
  entityType: EntityType,
  entityId: string,
): void {
  revalidatePath("/verifications");
  revalidatePath(`/verifications/${entityType}/${entityId}`);

  if (entityType === "professional") {
    revalidatePath("/professionals");
    return;
  }

  if (entityType === "store") {
    revalidatePath("/stores");
    return;
  }

  revalidatePath("/properties");
}

export async function getPendingVerifications(
  filters: Partial<VerificationFilterInput> = {},
): Promise<
  ActionResponse<{
    items: VerificationQueueItem[];
    pagination: PaginationMeta;
    filters: VerificationFilterInput;
  }>
> {
  return safeAction("getPendingVerifications", async ({ actor }) => {
    const validatedFilters = parseVerificationFilter(filters);
    const result = await verificationService.listVerificationQueue(
      actor,
      validatedFilters,
    );

    if (!result.ok) {
      throw new Error(result.message);
    }

    return {
      items: result.data.items.map(mapQueueItem),
      pagination: result.data.pagination,
      filters: validatedFilters,
    };
  });
}

export async function getVerificationStats(): Promise<
  ActionResponse<VerificationStats>
> {
  return safeAction("getVerificationStats", async ({ actor }) => {
    const result = await verificationService.getVerificationStats(actor);

    if (!result.ok) {
      throw new Error(result.message);
    }

    return {
      ...result.data,
      recentActivity: [],
    };
  });
}

export async function getVerificationDetails(
  entityType: EntityType,
  entityId: string,
): Promise<ActionResponse<VerificationDetails>> {
  return safeAction("getVerificationDetails", async ({ actor }) => {
    const parsedEntity = parseActionInput(
      z.object({
        entityType: z.enum(["professional", "store", "property"]),
        entityId: z.string().uuid(),
      }),
      { entityType, entityId },
      "Valid verification target is required",
    );

    const result = await verificationService.getVerificationDetails(
      actor,
      parsedEntity,
    );

    if (!result.ok) {
      throw new Error(result.message);
    }

    return result.data as VerificationDetails;
  });
}

export async function verifyEntity(
  input: VerifyEntityInput,
  idempotencyKey: string,
): Promise<ActionResponse<{ newStatus: VerificationStatus; message: string }>> {
  return safeAction(
    "verifyEntity",
    async ({ actor, adminUserId }) => {
      const validated = parseVerifyEntity(input);
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "verifyEntity",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: `${validated.entityType}:${validated.entityId}:${validated.action}`,
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await verificationService.verifyEntity(actor, validated);

          if (!result.ok) {
            throw new Error(result.message);
          }

          revalidateVerificationEntity(
            validated.entityType,
            validated.entityId,
          );

          return {
            newStatus: result.data.newStatus as VerificationStatus,
            message: result.data.message,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "VERIFY_ENTITY",
        resourceType: parseVerifyEntity(input).entityType,
        getTargetId: () => parseVerifyEntity(input).entityId,
        getDetails: ({ data }) => {
          const validated = parseVerifyEntity(input);
          const result = data as { newStatus: string; message: string };
          return {
            requestedAction: validated.action,
            ...(validated.reason ? { reason: validated.reason } : {}),
            ...(validated.notes ? { notes: validated.notes } : {}),
            newStatus: result.newStatus,
          };
        },
        getReason: () => parseVerifyEntity(input).reason,
      },
    },
  );
}

export async function verifyDocument(
  input: VerifyDocumentInput,
  idempotencyKey: string,
): Promise<ActionResponse<{ message: string }>> {
  return safeAction(
    "verifyDocument",
    async ({ actor, adminUserId }) => {
      const validated = parseVerifyDocument(input);
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "verifyDocument",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: `${validated.documentType}:${validated.documentId}:${validated.action}`,
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await verificationService.verifyDocument(actor, validated);

          if (!result.ok) {
            throw new Error(result.message);
          }

          revalidatePath("/verifications");
          if (result.data.targetEntityType === "professional") {
            revalidatePath(`/professionals/${result.data.targetEntityId}`);
          }
          if (result.data.targetEntityType === "property") {
            revalidatePath(`/properties/${result.data.targetEntityId}`);
          }

          return {
            message: result.data.message,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "VERIFY_DOCUMENT",
        resourceType: toDocumentAuditResourceType(
          parseVerifyDocument(input).documentType,
        ),
        getTargetId: () => parseVerifyDocument(input).documentId,
        getDetails: () => {
          const validated = parseVerifyDocument(input);
          return {
            documentType: validated.documentType,
            requestedAction: validated.action,
            ...(validated.notes ? { notes: validated.notes } : {}),
          };
        },
        getReason: () => parseVerifyDocument(input).notes,
      },
    },
  );
}

export async function batchVerifyDocuments(
  input: BatchVerifyDocumentsInput,
  idempotencyKey: string,
): Promise<
  ActionResponse<{
    summary: { total: number; successful: number; failed: number };
    results: Array<{ documentId: string; success: boolean; error?: string }>;
  }>
> {
  return safeAction(
    "batchVerifyDocuments",
    async ({ actor, adminUserId }) => {
      const validated = parseBatchVerifyDocuments(input);
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "batchVerifyDocuments",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: validated.documents
          .map(
            (document) =>
              `${document.documentType}:${document.documentId}:${document.action}`,
          )
          .sort()
          .join(","),
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await verificationService.batchVerifyDocuments(
            actor,
            validated,
          );

          if (!result.ok) {
            throw new Error(result.message);
          }

          revalidatePath("/verifications");

          return result.data;
        },
      });
    },
    {
      auditLog: {
        operation: "BATCH_VERIFY_DOCUMENTS",
        resourceType: "document",
        getTargetId: () => "batch",
        getDetails: ({ data }) => {
          const validated = parseBatchVerifyDocuments(input);
          const result = data as {
            summary: { total: number; successful: number; failed: number };
          };
          return {
            total: validated.documents.length,
            summary: result.summary,
          };
        },
      },
    },
  );
}

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
  return safeAction(
    "batchVerifyEntities",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        BatchEntitySchema,
        { entities, action, reason },
        "Valid batch verification payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "batchVerifyEntities",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.entities
          .map((entity) => `${entity.entityType}:${entity.entityId}`)
          .sort()
          .join(","),
        ttlHours: VERIFICATION_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await verificationService.batchVerifyEntities(actor, {
            entities: parsedInput.entities,
            action: parsedInput.action,
            ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          revalidatePath("/verifications");
          revalidatePath("/professionals");

          return {
            summary: result.data.summary,
            results: result.data.results,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "BATCH_VERIFY_ENTITIES",
        resourceType: "verification",
        getTargetId: () => "batch",
        getDetails: ({ data }) => {
          const parsedInput = parseActionInput(
            BatchEntitySchema,
            { entities, action, reason },
            "Valid batch verification payload is required",
          );
          const result = data as {
            summary: { total: number; successful: number; failed: number };
          };
          return {
            requestedAction: parsedInput.action,
            total: parsedInput.entities.length,
            successful: result.summary.successful,
            failed: result.summary.failed,
            ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
          };
        },
        getReason: () =>
          parseActionInput(
            BatchEntitySchema,
            { entities, action, reason },
            "Valid batch verification payload is required",
          ).reason,
      },
    },
  );
}

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
  return safeAction("getVerificationUpdates", async () => {
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
