/**
 * Verification Ops Data Access & Domain DTO Adapter
 *
 * Fetches RegulatorVerificationCase records from Prisma and maps them to
 * VerificationOpsCaseDTO instances from @build/verification-domain.
 */

import { prisma } from "@build/db";
import type {
  VerificationOpsCaseDTO,
  CompoundQueueType,
  VerificationStatutoryAuthority,
  VerificationCaseStatus,
  ConfidenceBreakdown,
  RegulatorEvidenceSnapshot,
} from "@build/verification-domain";

export interface FetchVerificationOpsCasesParams {
  queue: CompoundQueueType;
  authority?: VerificationStatutoryAuthority;
  page?: number;
  pageSize?: number;
}

export interface FetchVerificationOpsCasesResult {
  cases: VerificationOpsCaseDTO[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  slaHours: number;
}

const DEFAULT_PAGE_SIZE = 20;
const SLA_HOURS = 48;

/**
 * Maps queue tab name to corresponding Prisma status query criteria.
 * Mutually exclusive tab handling to prevent overlap.
 */
function buildQueueWhereClause(queue: CompoundQueueType, slaThreshold: Date) {
  switch (queue) {
    case "PENDING":
      return {
        status: {
          in: [
            "QUEUED",
            "PROCESSING",
            "NEEDS_MANUAL_REVIEW",
            "LOW_CONFIDENCE",
            "REGULATOR_UNAVAILABLE",
          ] as VerificationCaseStatus[],
        },
      };
    case "AUTOMATED_REVIEW":
      return {
        status: "PROCESSING" as VerificationCaseStatus,
      };
    case "NEEDS_CHANGES":
      return {
        status: "NEEDS_MANUAL_REVIEW" as VerificationCaseStatus,
      };
    case "ESCALATED":
      return {
        status: "NEEDS_MANUAL_REVIEW" as VerificationCaseStatus,
        decisions: {
          some: {},
        },
      };
    case "SLA_BREACHED":
      return {
        status: {
          in: [
            "QUEUED",
            "PROCESSING",
            "NEEDS_MANUAL_REVIEW",
            "LOW_CONFIDENCE",
            "REGULATOR_UNAVAILABLE",
          ] as VerificationCaseStatus[],
        },
        createdAt: {
          lt: slaThreshold,
        },
      };
    case "VERIFIED":
      return {
        status: {
          in: [
            "AUTO_VERIFIED",
            "MANUALLY_VERIFIED",
          ] as VerificationCaseStatus[],
        },
      };
    case "REJECTED":
      return {
        status: {
          in: [
            "AUTO_REJECTED",
            "MANUALLY_REJECTED",
          ] as VerificationCaseStatus[],
        },
      };
    default:
      return {
        status: {
          in: [
            "QUEUED",
            "PROCESSING",
            "NEEDS_MANUAL_REVIEW",
            "LOW_CONFIDENCE",
            "REGULATOR_UNAVAILABLE",
          ] as VerificationCaseStatus[],
        },
      };
  }
}

export async function fetchVerificationOpsCases(
  params: FetchVerificationOpsCasesParams,
): Promise<FetchVerificationOpsCasesResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || DEFAULT_PAGE_SIZE);

  const systemSettings = await prisma.systemSettings.findUnique({
    where: { id: "global" },
    select: { verificationSlaHours: true },
  });
  const slaHours = systemSettings?.verificationSlaHours ?? SLA_HOURS;

  const now = new Date();
  const slaThreshold = new Date(now.getTime() - slaHours * 60 * 60 * 1000);

  const queueWhere = buildQueueWhereClause(params.queue, slaThreshold);
  const authorityWhere = params.authority
    ? { authority: params.authority }
    : {};

  const where = {
    ...queueWhere,
    ...authorityWhere,
  };

  const [totalCount, rawCases] = await Promise.all([
    prisma.regulatorVerificationCase.count({ where }),
    prisma.regulatorVerificationCase.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        professionalId: true,
        licenseId: true,
        authority: true,
        licenseNumber: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        confidence: true,
        confidenceReasons: true,
        confidenceAlgorithmVersion: true,
        confidenceBreakdown: true,
        evidence: true,
        retryable: true,
        retryAfterSeconds: true,
        manualFallbackReason: true,
        correlationId: true,
        requestedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        license: {
          select: {
            professional: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const cases: VerificationOpsCaseDTO[] = rawCases.map(
    (item: (typeof rawCases)[number]) => {
      const user = item.license?.professional?.user;
      const professionalName = user
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
        : `Professional (${item.professionalId.substring(0, 8)})`;

      const isSlaBreached =
        [
          "QUEUED",
          "PROCESSING",
          "NEEDS_MANUAL_REVIEW",
          "LOW_CONFIDENCE",
          "REGULATOR_UNAVAILABLE",
        ].includes(item.status) && item.createdAt < slaThreshold;

      const slaDueDate = new Date(
        item.createdAt.getTime() + slaHours * 60 * 60 * 1000,
      ).toISOString();

      return {
        caseId: item.id,
        professionalId: item.professionalId,
        professionalName,
        licenseId: item.licenseId ?? "",
        authority: item.authority as VerificationStatutoryAuthority,
        licenseNumber: item.licenseNumber,
        status: item.status as VerificationCaseStatus,
        confidenceScore: item.confidence ?? 0.0,
        confidenceAlgorithmVersion: item.confidenceAlgorithmVersion ?? "v1.0.0",
        confidenceReasons: (item.confidenceReasons as string[]) ?? [],
        confidenceBreakdown:
          (item.confidenceBreakdown as ConfidenceBreakdown | null) ?? undefined,
        evidenceSnapshot:
          (item.evidence as RegulatorEvidenceSnapshot | null) ?? undefined,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        submittedAt: item.requestedAt.toISOString(),
        completedAt: item.completedAt
          ? item.completedAt.toISOString()
          : undefined,
        slaDueDate,
        isSlaBreached,
      };
    },
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    cases,
    totalCount,
    totalPages,
    page,
    pageSize,
    slaHours,
  };
}
