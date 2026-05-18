import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import { err, ok, type Result } from "@/lib/errors/result";
import type {
  PrismaVerificationStatus,
  VerificationActor,
  VerificationDomainError,
  VerificationQueueInput,
  VerificationQueuePage,
  VerificationQueueQuery,
  VerificationQueueSortBy,
  VerificationQueueSortOrder,
  VerificationQueueStatus,
  VerificationStats,
  VerificationStatsPeriod,
} from "./contracts";
import { PRISMA_VERIFICATION_STATUSES } from "./contracts";
import { verificationRepository } from "./repository";

const ENTITY_TYPES = ["all", "professional", "store", "property"] as const;
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

function requireVerificationCapability(
  actor: VerificationActor,
): Result<true, VerificationDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );

  if (!policy.success) {
    return err(policyDenied(policy.error.message));
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

  const [professionals, stores, properties] = await Promise.all([
    verificationRepository.listProfessionalQueue({
      ...query,
      status: query.status,
    }),
    verificationRepository.listStoreQueue({ ...query, status: query.status }),
    verificationRepository.listPropertyQueue({
      ...query,
      status: query.status,
    }),
  ]);
  const combined = sortQueueItems(
    [...professionals, ...stores, ...properties],
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

export const verificationService = {
  buildVerificationQueueQuery,
  listVerificationQueue,
  normalizeStatsPeriod,
  getVerificationStats,
};
