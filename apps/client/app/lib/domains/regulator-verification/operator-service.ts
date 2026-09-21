import type {
  AdminRole,
  PrismaClient,
  RegulatorVerificationDecisionOutcome,
} from "@prisma/client";
import { redactEvidenceForOperator } from "./evidence-store";
import { getRegulatorLookupLink } from "./regulator-lookup-links";

export type VerificationCaseListFilters = {
  status?: string[];
  authority?: string;
  professionalId?: string;
  page?: number;
  pageSize?: number;
};

/**
 * TODO 5 (backend half): list view feeding the manual verification operator
 * queue. Deliberately returns only what's needed for a triage list - full
 * evidence is loaded on demand via getVerificationCaseDetail so the queue
 * view stays cheap even with a large backlog.
 */
export async function listVerificationCases(
  db: PrismaClient,
  filters: VerificationCaseListFilters = {},
) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);

  const where = {
    ...(filters.status?.length
      ? { status: { in: filters.status as any } }
      : {}),
    ...(filters.authority ? { authority: filters.authority as any } : {}),
    ...(filters.professionalId
      ? { professionalId: filters.professionalId }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.regulatorVerificationCase.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        professionalId: true,
        licenseId: true,
        authority: true,
        licenseNumber: true,
        status: true,
        confidence: true,
        manualFallbackReason: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.regulatorVerificationCase.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Full case detail for the operator workflow: redacted evidence, confidence
 * reasons, the decision trail so far, and duplicate/history context (other
 * cases against the same authority + license number, across professionals -
 * the thing operators most need to catch reused/stolen license numbers).
 */
export async function getVerificationCaseDetail(
  db: PrismaClient,
  caseId: string,
  viewerRole: AdminRole | string,
) {
  const verificationCase = await db.regulatorVerificationCase.findUniqueOrThrow(
    {
      where: { id: caseId },
      include: {
        decisions: { orderBy: { createdAt: "asc" } },
        license: {
          select: {
            id: true,
            professionalId: true,
            licenseNumber: true,
            authority: true,
            status: true,
            validFrom: true,
            validUntil: true,
          },
        },
      },
    },
  );

  const duplicates = await db.regulatorVerificationCase.findMany({
    where: {
      authority: verificationCase.authority,
      licenseNumber: verificationCase.licenseNumber,
      id: { not: verificationCase.id },
    },
    select: {
      id: true,
      professionalId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    ...verificationCase,
    evidence: redactEvidenceForOperator(
      verificationCase.evidence as Record<string, unknown> | null,
      viewerRole,
    ),
    duplicates,
    // Manual cross-check link for the operator - see
    // regulator-lookup-links.ts. `verified: false` means it's just the
    // authority's homepage, not a confirmed register search page - the
    // UI should present that distinction rather than implying every
    // authority is one click away from a definitive answer.
    lookupLink: getRegulatorLookupLink(verificationCase.authority),
  };
}

export type RecordManualDecisionParams = {
  caseId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  outcome: RegulatorVerificationDecisionOutcome;
  reasonCode: string;
  reasonNotes?: string;
  /** True when confidence was below threshold or an explicit regulator rejection is being overridden. */
  highRiskReview: boolean;
  requestId?: string;
  ipAddress?: string;
};

const FINAL_CASE_STATUS: Record<
  RegulatorVerificationDecisionOutcome,
  "MANUALLY_VERIFIED" | "MANUALLY_REJECTED" | null
> = {
  APPROVE: "MANUALLY_VERIFIED",
  REJECT: "MANUALLY_REJECTED",
  REQUEST_MORE_INFO: null,
};

/**
 * Records a manual decision (TODO 5). A `reasonCode` is required on every
 * call - there is no "just approve" path. High-risk decisions require a
 * SECOND decision from a *different* adminId with the same outcome before
 * the case status is allowed to flip; the first high-risk decision only
 * records the recommendation and leaves the case status untouched.
 *
 * Every decision row is itself the immutable audit log entry for this
 * action (RegulatorVerificationDecision rows are never updated, only
 * inserted) and is additionally mirrored into AdminAuditLog so it shows up
 * in the existing cross-domain admin audit trail/dashboards.
 */
export async function recordManualDecision(
  db: PrismaClient,
  params: RecordManualDecisionParams,
): Promise<{ caseStatus: string; requiresSecondApprover: boolean }> {
  if (!params.reasonCode.trim()) {
    throw new Error("reasonCode is required for every manual decision");
  }

  return db.$transaction(async (tx) => {
    const existingCase = await tx.regulatorVerificationCase.findUniqueOrThrow({
      where: { id: params.caseId },
      include: { decisions: true },
    });

    const priorMatchingApprover = existingCase.decisions.find(
      (d) =>
        d.outcome === params.outcome &&
        d.adminId !== params.adminId &&
        d.highRiskReview,
    );

    const isSecondApprover = Boolean(
      params.highRiskReview && priorMatchingApprover,
    );

    await tx.regulatorVerificationDecision.create({
      data: {
        caseId: params.caseId,
        adminId: params.adminId,
        adminName: params.adminName,
        adminEmail: params.adminEmail,
        outcome: params.outcome,
        reasonCode: params.reasonCode,
        reasonNotes: params.reasonNotes,
        highRiskReview: params.highRiskReview,
        isSecondApprover,
      },
    });

    const finalStatus = FINAL_CASE_STATUS[params.outcome];
    const requiresSecondApprover = params.highRiskReview && !isSecondApprover;

    if (finalStatus && !requiresSecondApprover) {
      await tx.regulatorVerificationCase.update({
        where: { id: params.caseId },
        data: { status: finalStatus, completedAt: new Date() },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminName: params.adminName,
        adminEmail: params.adminEmail,
        adminRole: params.adminRole,
        action: "REGULATOR_VERIFICATION_MANUAL_DECISION",
        status: "SUCCESS",
        targetType: "RegulatorVerificationCase",
        targetId: params.caseId,
        reason: params.reasonCode,
        details: {
          outcome: params.outcome,
          highRiskReview: params.highRiskReview,
          isSecondApprover,
          requiresSecondApprover,
          authority: existingCase.authority,
          licenseNumber: existingCase.licenseNumber,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
      },
    });

    return {
      caseStatus: requiresSecondApprover
        ? existingCase.status
        : (finalStatus ?? existingCase.status),
      requiresSecondApprover,
    };
  });
}
