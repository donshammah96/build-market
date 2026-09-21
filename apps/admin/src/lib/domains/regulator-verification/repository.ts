import { prisma } from "@build/db";
import type {
  Prisma,
  RegulatorVerificationDecisionOutcome,
  RegulatorVerificationCaseStatus,
  LicenseAuthority,
} from "@prisma/client";
import type {
  RegulatorVerificationCaseFilter,
  RegulatorVerificationCaseItem,
  RegulatorVerificationCaseDetail,
} from "./contracts";

function redactEvidenceForOperator(
  evidence: Record<string, unknown> | null,
  viewerRole: string,
): Record<string, unknown> | null {
  if (!evidence) return null;
  if (viewerRole === "SUPER_ADMIN") return evidence;

  const { rawRecord: _rawRecord, ...redacted } = evidence;
  return redacted;
}

export const regulatorVerificationRepository = {
  async listCases(
    filters: Partial<RegulatorVerificationCaseFilter> = {
      page: 1,
      pageSize: 25,
    },
  ) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);

    const where: Prisma.RegulatorVerificationCaseWhereInput = {
      ...(filters.status?.length
        ? {
            status: { in: filters.status as RegulatorVerificationCaseStatus[] },
          }
        : {}),
      ...(filters.authority
        ? { authority: filters.authority as LicenseAuthority }
        : {}),
      ...(filters.professionalId
        ? { professionalId: filters.professionalId }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.regulatorVerificationCase.findMany({
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
      prisma.regulatorVerificationCase.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })) as RegulatorVerificationCaseItem[],
      total,
      page,
      pageSize,
    };
  },

  async getCaseDetail(
    caseId: string,
    viewerRole: string,
  ): Promise<RegulatorVerificationCaseDetail | null> {
    const verificationCase = await prisma.regulatorVerificationCase.findUnique({
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
    });

    if (!verificationCase) return null;

    const duplicates = await prisma.regulatorVerificationCase.findMany({
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
      createdAt: verificationCase.createdAt.toISOString(),
      updatedAt: verificationCase.updatedAt.toISOString(),
      evidence: redactEvidenceForOperator(
        verificationCase.evidence as Record<string, unknown> | null,
        viewerRole,
      ),
      decisions: verificationCase.decisions.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
      duplicates: duplicates.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
      license: verificationCase.license
        ? {
            ...verificationCase.license,
            validFrom:
              verificationCase.license.validFrom?.toISOString() ?? null,
            validUntil:
              verificationCase.license.validUntil?.toISOString() ?? null,
          }
        : null,
    };
  },

  async recordManualDecision(params: {
    caseId: string;
    adminId: string;
    adminName: string;
    adminEmail: string;
    adminRole: string;
    outcome: RegulatorVerificationDecisionOutcome;
    reasonCode: string;
    reasonNotes?: string | null | undefined;
    highRiskReview: boolean;
    requestId?: string | null | undefined;
    ipAddress?: string | null | undefined;
  }): Promise<{ caseStatus: string; requiresSecondApprover: boolean }> {
    const FINAL_CASE_STATUS: Record<
      RegulatorVerificationDecisionOutcome,
      "MANUALLY_VERIFIED" | "MANUALLY_REJECTED" | null
    > = {
      APPROVE: "MANUALLY_VERIFIED",
      REJECT: "MANUALLY_REJECTED",
      REQUEST_MORE_INFO: null,
    };

    return prisma.$transaction(async (tx) => {
      const existingCase = await tx.regulatorVerificationCase.findUniqueOrThrow(
        {
          where: { id: params.caseId },
          include: { decisions: true },
        },
      );

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
          reasonNotes: params.reasonNotes ?? null,
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

        // Also update ProfessionalLicense status if licenseId is linked
        if (existingCase.licenseId) {
          const licenseStatusMap = {
            MANUALLY_VERIFIED: "VERIFIED",
            MANUALLY_REJECTED: "REJECTED",
          } as const;

          if (finalStatus in licenseStatusMap) {
            await tx.professionalLicense
              .update({
                where: { id: existingCase.licenseId },
                data: {
                  status:
                    licenseStatusMap[
                      finalStatus as keyof typeof licenseStatusMap
                    ],
                },
              })
              .catch(() => {
                // Ignore if license row not found
              });
          }
        }
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
          requestId: params.requestId ?? null,
          ipAddress: params.ipAddress ?? null,
        },
      });

      return {
        caseStatus: requiresSecondApprover
          ? existingCase.status
          : (finalStatus ?? existingCase.status),
        requiresSecondApprover,
      };
    });
  },
};
