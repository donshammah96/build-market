import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import { err, ok, type Result } from "@/lib/result";
import { getAuditHistory } from "./internal/audit-service";
import { notifyVerificationResult } from "./internal/notification.service";
import {
  getProfessionalVerificationDetails,
  verifyProfessional,
} from "./internal/professional-verification.service";
import {
  getPropertyVerificationDetails,
  verifyProperty,
} from "./internal/property-verification.service";
import {
  getStoreVerificationDetails,
  verifyStore,
} from "./internal/store-verification.service";
import { verifyLicense as verifyLicenseInternal } from "./internal/license-verification.service";
import type { VerificationRequest } from "./internal/types";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import type {
  BatchVerifyDocumentsInput,
  BatchVerifyEntitiesInput,
  PrismaVerificationStatus,
  ProfessionalEntityDetail,
  PropertyEntityDetail,
  StoreEntityDetail,
  VerificationDetails,
  VerificationActor,
  VerificationDomainError,
  VerificationDocumentSummary,
  VerificationEntitySummary,
  VerificationEntityType,
  VerificationQueueInput,
  VerificationQueuePage,
  VerificationQueueQuery,
  VerificationQueueSortBy,
  VerificationQueueSortOrder,
  VerificationQueueStatus,
  VerificationStats,
  VerificationStatsPeriod,
  VerifyDocumentInput,
  VerifyEntityInput,
  VerifyLicenseInput,
  LicenseSummary,
} from "./contracts";
import { PRISMA_VERIFICATION_STATUSES } from "./contracts";
import { verificationRepository } from "./repository";

const ENTITY_TYPES = [
  "all",
  "professional",
  "store",
  "property",
  "license",
] as const;
const STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "IN_REVIEW",
  "VERIFIED",
  "REJECTED",
  "NEEDS_CORRECTION",
  "EXPIRED",
  "SUSPENDED",
] as const;
const SORT_BY = ["submittedAt", "createdAt"] as const;
const SORT_ORDER = ["asc", "desc"] as const;
const PERIODS = ["today", "week", "month", "all"] as const;

function isOneOf<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function invalidFilter(message: string): VerificationDomainError {
  return { code: "VERIFICATION_INVALID_FILTER", message };
}

function policyDenied(message: string): VerificationDomainError {
  return { code: "VERIFICATION_POLICY_DENIED", message };
}

function notFound(message: string): VerificationDomainError {
  return { code: "VERIFICATION_NOT_FOUND", message };
}

function requireVerificationCapability(
  actor: VerificationActor,
): Result<true, VerificationDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );

  if (!policy.ok) {
    return err(policyDenied(policy.message));
  }

  return ok(true);
}

export function buildVerificationQueueQuery(
  input: VerificationQueueInput = {},
): Result<VerificationQueueQuery, VerificationDomainError> {
  const entityType = input.entityType ?? "all";
  const status = input.status ?? "PENDING";
  const sortBy = input.sortBy ?? "submittedAt";
  const sortOrder = input.sortOrder ?? "desc";

  if (!isOneOf(ENTITY_TYPES, entityType)) {
    return err(invalidFilter("Invalid verification entity type"));
  }
  if (!isOneOf(STATUSES, status)) {
    return err(invalidFilter("Invalid verification status"));
  }
  if (!isOneOf(SORT_BY, sortBy)) {
    return err(invalidFilter("Invalid verification sort field"));
  }
  if (!isOneOf(SORT_ORDER, sortOrder)) {
    return err(invalidFilter("Invalid verification sort order"));
  }

  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20)));

  return ok({
    entityType,
    status,
    page,
    limit,
    sortBy,
    sortOrder,
    skip: (page - 1) * limit,
  });
}

function isPrismaStatus(
  status: VerificationQueueStatus,
): status is PrismaVerificationStatus {
  return PRISMA_VERIFICATION_STATUSES.includes(
    status as PrismaVerificationStatus,
  );
}

function sortQueueItems(
  items: VerificationQueuePage["items"],
  sortBy: VerificationQueueSortBy,
  sortOrder: VerificationQueueSortOrder,
) {
  return [...items].sort((a, b) => {
    const aDate = sortBy === "submittedAt" ? a.submittedAt : a.createdAt;
    const bDate = sortBy === "submittedAt" ? b.submittedAt : b.createdAt;
    const aTime = aDate?.getTime() ?? 0;
    const bTime = bDate?.getTime() ?? 0;
    return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
  });
}

async function listQueueForEntity(
  query: VerificationQueueQuery & { status: PrismaVerificationStatus },
) {
  if (query.entityType === "professional") {
    const [items, total] = await Promise.all([
      verificationRepository.listProfessionalQueue(query),
      verificationRepository.countProfessionalQueue(query.status),
    ]);
    return { items, total };
  }

  if (query.entityType === "store") {
    const [items, total] = await Promise.all([
      verificationRepository.listStoreQueue(query),
      verificationRepository.countStoreQueue(query.status),
    ]);
    return { items, total };
  }

  if (query.entityType === "license") {
    if (!adminEnvConfig.NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE) {
      return { items: [], total: 0 };
    }
    const [items, total] = await Promise.all([
      verificationRepository.listLicenseQueue(query),
      verificationRepository.countLicenseQueue(query.status),
    ]);
    return { items, total };
  }

  const [items, total] = await Promise.all([
    verificationRepository.listPropertyQueue(query),
    verificationRepository.countPropertyQueue(query.status),
  ]);
  return { items, total };
}

export async function listVerificationQueue(
  actor: VerificationActor,
  input: VerificationQueueInput = {},
): Promise<Result<VerificationQueuePage, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  const queryResult = buildVerificationQueueQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  if (!isPrismaStatus(query.status)) {
    return ok({
      items: [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
      filters: query,
    });
  }

  if (query.entityType !== "all") {
    const { items, total } = await listQueueForEntity({
      ...query,
      entityType: query.entityType,
      status: query.status,
    });

    return ok({
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      filters: query,
    });
  }

  const showLicenseQueue =
    adminEnvConfig.NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE;
  const [professionals, stores, properties, licenses] = await Promise.all([
    verificationRepository.listProfessionalQueue({
      ...query,
      status: query.status,
    }),
    verificationRepository.listStoreQueue({ ...query, status: query.status }),
    verificationRepository.listPropertyQueue({
      ...query,
      status: query.status,
    }),
    showLicenseQueue
      ? verificationRepository.listLicenseQueue({
          ...query,
          status: query.status,
        })
      : Promise.resolve([]),
  ]);
  const combined = sortQueueItems(
    [...professionals, ...stores, ...properties, ...licenses],
    query.sortBy,
    query.sortOrder,
  );
  const items = combined.slice(query.skip, query.skip + query.limit);

  return ok({
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: combined.length,
      totalPages: Math.ceil(combined.length / query.limit),
    },
    filters: query,
  });
}

export function normalizeStatsPeriod(
  period: unknown,
): Result<VerificationStatsPeriod, VerificationDomainError> {
  if (period === undefined || period === null || period === "") {
    return ok("all");
  }
  if (!isOneOf(PERIODS, period)) {
    return err(invalidFilter("Invalid verification stats period"));
  }
  return ok(period);
}

async function countStatusSet(
  period: VerificationStatsPeriod,
  status: PrismaVerificationStatus,
) {
  const [professionals, stores, properties] = await Promise.all([
    verificationRepository.countVerificationStatus(
      "professional",
      status,
      period,
    ),
    verificationRepository.countVerificationStatus("store", status, period),
    verificationRepository.countVerificationStatus("property", status, period),
  ]);

  return {
    professionals,
    stores,
    properties,
    total: professionals + stores + properties,
  };
}

function toVerificationRequest(
  actor: VerificationActor,
  input: VerifyEntityInput,
  metadata?: {
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  },
): VerificationRequest {
  return {
    ...input,
    adminId: actor.dbUserId,
    ...(metadata?.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
    ...(metadata?.userAgent ? { userAgent: metadata.userAgent } : {}),
  };
}

async function resolveVerificationRecipient(
  entityType: VerificationEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === "professional") {
    return entityId;
  }

  if (entityType === "store") {
    return verificationRepository.findStoreOwnerId(entityId);
  }

  return verificationRepository.findPropertyOwnerId(entityId);
}

function mapAuditEntry(entry: {
  id: string;
  action: string;
  createdAt: Date;
  reason: string | null;
  details: unknown;
  admin: {
    firstName: string | null;
    lastName: string | null;
  } | null;
}) {
  const details =
    typeof entry.details === "object" && entry.details
      ? (entry.details as Record<string, unknown>)
      : {};

  return {
    id: entry.id,
    action: entry.action,
    oldStatus:
      typeof details.oldStatus === "string" ? details.oldStatus : "UNKNOWN",
    newStatus:
      typeof details.newStatus === "string" ? details.newStatus : "UNKNOWN",
    ...(entry.reason ? { reason: entry.reason } : {}),
    createdAt: entry.createdAt.toISOString(),
    admin: {
      firstName: entry.admin?.firstName ?? null,
      lastName: entry.admin?.lastName ?? null,
    },
  };
}

function mapProfessionalDetails(
  entityId: string,
  details: Awaited<ReturnType<typeof getProfessionalVerificationDetails>>,
  auditHistory: Awaited<ReturnType<typeof getAuditHistory>>,
): VerificationDetails {
  if (!details) {
    throw new Error("Professional profile not found");
  }

  return {
    entityType: "professional",
    entityId,
    status: details.verificationStatus,
    ...(details.verifiedAt
      ? { verifiedAt: details.verifiedAt.toISOString() }
      : {}),
    ...(details.verificationNotes
      ? { verificationNotes: details.verificationNotes }
      : {}),
    entity: details as unknown as ProfessionalEntityDetail,
    documents: details.documents.map((document: any) => ({
      id: document.id,
      type: String(document.category),
      fileUrl: document.fileUrl ?? "",
      isVerified: document.status === "VERIFIED",
      ...(document.verifiedAt
        ? { verifiedAt: document.verifiedAt.toISOString() }
        : {}),
    })),
    auditHistory: auditHistory.map(mapAuditEntry),
  };
}

function mapStoreDetails(
  entityId: string,
  details: Awaited<ReturnType<typeof getStoreVerificationDetails>>,
  auditHistory: Awaited<ReturnType<typeof getAuditHistory>>,
): VerificationDetails {
  if (!details) {
    throw new Error("Store not found");
  }

  return {
    entityType: "store",
    entityId,
    status: details.verificationStatus,
    ...(details.submittedAt
      ? { submittedAt: details.submittedAt.toISOString() }
      : {}),
    ...(details.verifiedAt
      ? { verifiedAt: details.verifiedAt.toISOString() }
      : {}),
    ...(details.rejectionReason
      ? { rejectionReason: details.rejectionReason }
      : {}),
    entity: details as unknown as StoreEntityDetail,
    documents: [],
    auditHistory: auditHistory.map(mapAuditEntry),
  };
}

function mapPropertyDetails(
  entityId: string,
  details: Awaited<ReturnType<typeof getPropertyVerificationDetails>>,
  auditHistory: Awaited<ReturnType<typeof getAuditHistory>>,
): VerificationDetails {
  if (!details) {
    throw new Error("Property not found");
  }

  return {
    entityType: "property",
    entityId,
    status: details.verificationStatus,
    ...(details.submittedAt
      ? { submittedAt: details.submittedAt.toISOString() }
      : {}),
    ...(details.verifiedAt
      ? { verifiedAt: details.verifiedAt.toISOString() }
      : {}),
    ...(details.verificationNotes
      ? { verificationNotes: details.verificationNotes }
      : {}),
    ...(details.rejectionReason
      ? { rejectionReason: details.rejectionReason }
      : {}),
    entity: details as unknown as PropertyEntityDetail,
    documents: details.documents.map((document: any) => ({
      id: document.id,
      type: String(document.type),
      fileUrl: document.url ?? "",
      isVerified: document.status === "APPROVED",
      ...(document.verifiedAt
        ? { verifiedAt: document.verifiedAt.toISOString() }
        : {}),
      ...(document.notes ? { notes: document.notes } : {}),
    })),
    auditHistory: auditHistory.map(mapAuditEntry),
  };
}

export async function getVerificationDetails(
  actor: VerificationActor,
  input: {
    entityType: VerificationEntityType;
    entityId: string;
  },
): Promise<Result<VerificationDetails, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  if (input.entityType === "professional") {
    const [details, auditHistory] = await Promise.all([
      getProfessionalVerificationDetails(input.entityId),
      getAuditHistory("ProfessionalProfile", input.entityId),
    ]);

    if (!details) {
      return err(notFound("Professional profile not found"));
    }

    return ok(mapProfessionalDetails(input.entityId, details, auditHistory));
  }

  if (input.entityType === "store") {
    const [details, auditHistory] = await Promise.all([
      getStoreVerificationDetails(input.entityId),
      getAuditHistory("Store", input.entityId),
    ]);

    if (!details) {
      return err(notFound("Store not found"));
    }

    return ok(mapStoreDetails(input.entityId, details, auditHistory));
  }

  const [details, auditHistory] = await Promise.all([
    getPropertyVerificationDetails(input.entityId),
    getAuditHistory("Property", input.entityId),
  ]);

  if (!details) {
    return err(notFound("Property not found"));
  }

  return ok(mapPropertyDetails(input.entityId, details, auditHistory));
}

export async function verifyEntity(
  actor: VerificationActor,
  input: VerifyEntityInput,
  metadata?: {
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  },
): Promise<Result<VerificationEntitySummary, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  try {
    const request = toVerificationRequest(actor, input, metadata);
    const result =
      input.entityType === "professional"
        ? await verifyProfessional(request)
        : input.entityType === "store"
          ? await verifyStore(request)
          : await verifyProperty(request);

    const recipientUserId = await resolveVerificationRecipient(
      input.entityType,
      input.entityId,
    );

    if (recipientUserId) {
      await notifyVerificationResult(result, recipientUserId);
    }

    return ok({
      entityType: input.entityType,
      entityId: input.entityId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      message: result.message,
      ...(result.verifiedAt ? { verifiedAt: result.verifiedAt } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.notes ? { notes: result.notes } : {}),
    });
  } catch (error) {
    return err({
      code: "VERIFICATION_REPOSITORY_ERROR",
      message: error instanceof Error ? error.message : "Verification failed",
    });
  }
}

export async function verifyDocument(
  actor: VerificationActor,
  input: VerifyDocumentInput,
): Promise<Result<VerificationDocumentSummary, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  try {
    const result = await verificationRepository.updateDocumentVerification({
      ...input,
      adminId: actor.dbUserId,
    });

    return ok(result);
  } catch (error) {
    return err({
      code: "VERIFICATION_REPOSITORY_ERROR",
      message:
        error instanceof Error ? error.message : "Document verification failed",
    });
  }
}

export async function batchVerifyDocuments(
  actor: VerificationActor,
  input: BatchVerifyDocumentsInput,
): Promise<
  Result<
    {
      summary: { total: number; successful: number; failed: number };
      results: Array<{ documentId: string; success: boolean; error?: string }>;
    },
    VerificationDomainError
  >
> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  const results: Array<{
    documentId: string;
    success: boolean;
    error?: string;
  }> = [];

  // Sort documents lexicographically by documentId to prevent database transaction deadlocks
  const sortedDocuments = [...input.documents].sort((a, b) =>
    a.documentId.localeCompare(b.documentId),
  );

  for (const document of sortedDocuments) {
    try {
      const result = await verificationRepository.updateDocumentVerification({
        ...document,
        adminId: actor.dbUserId,
      });
      results.push({
        documentId: result.documentId,
        success: true,
      });
    } catch (error) {
      results.push({
        documentId: document.documentId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successful = results.filter((result) => result.success).length;

  return ok({
    summary: {
      total: results.length,
      successful,
      failed: results.length - successful,
    },
    results,
  });
}

export async function batchVerifyEntities(
  actor: VerificationActor,
  input: BatchVerifyEntitiesInput,
): Promise<
  Result<
    {
      summary: { total: number; successful: number; failed: number };
      results: Array<{
        entityType: VerificationEntityType;
        entityId: string;
        success: boolean;
        error?: string;
      }>;
    },
    VerificationDomainError
  >
> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  const results: Array<{
    entityType: VerificationEntityType;
    entityId: string;
    success: boolean;
    error?: string;
  }> = [];

  // Sort entities lexicographically by entityId to prevent database transaction deadlocks
  const sortedEntities = [...input.entities].sort((a, b) =>
    a.entityId.localeCompare(b.entityId),
  );

  for (const entity of sortedEntities) {
    const result = await verifyEntity(actor, {
      ...entity,
      action: input.action,
      ...(input.reason ? { reason: input.reason } : {}),
    });

    if (result.ok) {
      results.push({
        entityType: entity.entityType,
        entityId: entity.entityId,
        success: true,
      });
      continue;
    }

    results.push({
      entityType: entity.entityType,
      entityId: entity.entityId,
      success: false,
      error: result.message,
    });
  }

  const successful = results.filter((result) => result.success).length;

  return ok({
    summary: {
      total: results.length,
      successful,
      failed: results.length - successful,
    },
    results,
  });
}

export async function getVerificationStats(
  actor: VerificationActor,
  periodInput: unknown = "all",
): Promise<Result<VerificationStats, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  const periodResult = normalizeStatsPeriod(periodInput);
  if (!periodResult.ok) return periodResult;

  const period = periodResult.data;
  const [pending, verified, rejected, needsCorrection] = await Promise.all([
    countStatusSet(period, "PENDING"),
    countStatusSet(period, "VERIFIED"),
    countStatusSet(period, "REJECTED"),
    countStatusSet(period, "NEEDS_CORRECTION"),
  ]);

  return ok({
    pending,
    verified,
    rejected,
    needsCorrection,
    period,
  });
}

export async function verifyLicense(
  actor: VerificationActor,
  input: VerifyLicenseInput,
  metadata?: {
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  },
): Promise<Result<LicenseSummary, VerificationDomainError>> {
  const capability = requireVerificationCapability(actor);
  if (!capability.ok) return capability;

  if (!adminEnvConfig.NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE) {
    return err(
      policyDenied("License verification queue is disabled by feature flag"),
    );
  }

  try {
    const requestData: any = {
      licenseId: input.licenseId,
      action: input.action,
      adminId: actor.dbUserId,
    };
    if (input.notes !== undefined) requestData.notes = input.notes;
    if (input.reason !== undefined) requestData.reason = input.reason;
    if (metadata?.ipAddress !== undefined)
      requestData.ipAddress = metadata.ipAddress;
    if (metadata?.userAgent !== undefined)
      requestData.userAgent = metadata.userAgent;

    const result = await verifyLicenseInternal(requestData);

    const recipientUserId = result.professionalId;
    await notifyVerificationResult(
      {
        success: true,
        entityType: "professional",
        entityId: result.professionalId,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        message: result.message,
        ...(result.verifiedAt ? { verifiedAt: result.verifiedAt } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      },
      recipientUserId,
    );

    return ok({
      licenseId: result.licenseId,
      authority: result.authority,
      licenseNumber: result.licenseNumber,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      message: result.message,
      ...(result.verifiedAt ? { verifiedAt: result.verifiedAt } : {}),
    });
  } catch (error) {
    return err({
      code: "VERIFICATION_REPOSITORY_ERROR",
      message:
        error instanceof Error ? error.message : "License verification failed",
    });
  }
}

export const verificationService = {
  buildVerificationQueueQuery,
  listVerificationQueue,
  normalizeStatsPeriod,
  getVerificationStats,
  getVerificationDetails,
  verifyEntity,
  verifyLicense,
  verifyDocument,
  batchVerifyDocuments,
  batchVerifyEntities,
};
