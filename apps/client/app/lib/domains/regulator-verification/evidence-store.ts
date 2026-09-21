import {
  type AdminRole,
  Prisma,
  type PrismaClient,
  type RegulatorVerificationCaseStatus,
} from "@prisma/client";
import { buildRegulatorVerificationJobId } from "./gateway";
import type {
  RegulatorVerificationRequest,
  RegulatorVerificationResult,
} from "./gateway";
/** Accepts either the root Prisma client or a `prisma.$transaction(async (tx) => ...)` handle. */
type Db = PrismaClient | Prisma.TransactionClient;
const STATUS_MAP: Record<
  RegulatorVerificationResult["status"],
  RegulatorVerificationCaseStatus
> = {
  AUTO_VERIFIED: "AUTO_VERIFIED",
  AUTO_REJECTED: "AUTO_REJECTED",
  NEEDS_MANUAL_REVIEW: "NEEDS_MANUAL_REVIEW",
  REGULATOR_UNAVAILABLE: "REGULATOR_UNAVAILABLE",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
} as any;
/**
 * TODO 3 dedupe contract: this MUST stay byte-identical to the dedupe key
 * used for the BullMQ jobId (see app/lib/domains/regulator-verification/queue.ts) - both are
 * derived from buildRegulatorVerificationJobId() so a case row and its queue
 * job can never point at each other incorrectly.
 */
export function dedupeKeyFor(request: RegulatorVerificationRequest): string {
  return buildRegulatorVerificationJobId(request);
}
/**
 * Records/updates the durable verification-case row for one gateway.verify()
 * attempt. Called from inside the same Prisma transaction that updates
 * ProfessionalLicense.status (TODO 2) so the case, the license, and the
 * audit log entry are always consistent with each other.
 */
export async function recordVerificationAttempt(
  db: Db,
  params: {
    request: RegulatorVerificationRequest;
    result: RegulatorVerificationResult;
    attemptNumber: number;
    maxAttempts: number;
  },
): Promise<void> {
  const { request, result, attemptNumber, maxAttempts } = params;
  const dedupeKey = dedupeKeyFor(request);
  await db.regulatorVerificationCase.upsert({
    where: { dedupeKey },
    create: {
      professionalId: request.professionalId,
      licenseId: request.licenseId ?? "",
      authority: request.authority,
      licenseNumber: request.licenseNumber,
      dedupeKey,
      status: STATUS_MAP[result.status],
      attempts: attemptNumber,
      maxAttempts,
      confidence: result.confidence,
      confidenceReasons: result.confidenceReasons,
      confidenceAlgorithmVersion: result.confidenceAlgorithmVersion,
      confidenceBreakdown: (result.confidenceBreakdown as any) ?? undefined,
      evidence: result.evidence as any,
      retryable: result.retryable,
      retryAfterSeconds: result.retryAfterSeconds,
      manualFallbackReason: result.manualFallbackReason,
      correlationId: result.correlationId,
      completedAt: result.retryable ? null : new Date(),
    },
    update: {
      status: STATUS_MAP[result.status],
      attempts: attemptNumber,
      confidence: result.confidence,
      confidenceReasons: result.confidenceReasons,
      confidenceAlgorithmVersion: result.confidenceAlgorithmVersion,
      confidenceBreakdown: (result.confidenceBreakdown as any) ?? undefined,
      evidence: result.evidence as any,
      retryable: result.retryable,
      retryAfterSeconds: result.retryAfterSeconds,
      manualFallbackReason: result.manualFallbackReason,
      completedAt: result.retryable ? null : new Date(),
    },
  });
}
/** Marks a case dead-lettered once the queue's attempt budget is exhausted (TODO 3). */
export async function markDeadLettered(
  db: Db,
  params: { dedupeKey: string; reason: string },
): Promise<void> {
  await db.regulatorVerificationCase.update({
    where: { dedupeKey: params.dedupeKey },
    data: {
      status: "DEAD_LETTER",
      deadLetteredAt: new Date(),
      deadLetterReason: params.reason,
    },
  });
}
/**
 * Operator-view redaction (TODO 2). Only SUPER_ADMIN and COMPLIANCE_OFFICER
 * roles* see the raw regulator payload; every other admin role sees the
 * normalized fields and confidence reasoning only - enough to make a manual
 * decision without needing raw-record access that could contain more PII
 * than was actually submitted (e.g. a regulator record with a national ID
 * or full historical address).
 *
 * *Adjust ADMIN_ROLES_WITH_RAW_ACCESS to match your actual AdminRole enum
 * values - the schema.prisma admin enum wasn't part of this change set.
 */
const ADMIN_ROLES_WITH_RAW_ACCESS = new Set<AdminRole | string>([
  "SUPER_ADMIN",
  "VERIFICATION_COMPLIANCE_OFFICER",
]);
export async function logEvidenceViewedAuditEvent(
  db: Db,
  params: {
    caseId: string;
    viewerId: string;
    viewerRole: string;
    unredacted: boolean;
  },
): Promise<void> {
  await Promise.all([
    db.auditLog.create({
      data: {
        action: "EVIDENCE_VIEWED",
        actorId: params.viewerId,
        actorType: "ADMIN",
        entityType: "RegulatorVerificationCase",
        entityId: params.caseId,
        metadata: {
          viewerRole: params.viewerRole,
          unredacted: params.unredacted,
          viewedAt: new Date().toISOString(),
        },
      },
    }),
    db.regulatorVerificationEvidenceView.create({
      data: {
        caseId: params.caseId,
        viewerId: params.viewerId,
        viewerRole: params.viewerRole,
        unredacted: params.unredacted,
      },
    }),
  ]);
}
export function redactEvidenceForOperator(
  evidence: Record<string, unknown> | null,
  viewerRole: AdminRole | string,
): Record<string, unknown> | null {
  if (!evidence) return null;
  if (ADMIN_ROLES_WITH_RAW_ACCESS.has(viewerRole)) return evidence;
  const { rawRecord: _rawRecord, ...redacted } = evidence;
  return redacted;
}
/**
 * Evidence retention enforcement (TODO 2). Strips `evidence.rawRecord` (the
 * unredacted regulator payload) from cases older than `retentionDays` while
 * preserving the normalized record, confidence, and decision trail so audit
 * history remains intact. Intended to run as a scheduled job alongside the
 * existing DATA_RETENTION_ENFORCED audit action.
 */
export async function enforceEvidenceRetention(
  db: PrismaClient,
  params: { retentionDays: number; batchSize?: number },
): Promise<{ processed: number }> {
  const cutoff = new Date(
    Date.now() - params.retentionDays * 24 * 60 * 60 * 1000,
  );
  const stale = await db.regulatorVerificationCase.findMany({
    where: {
      completedAt: { lt: cutoff },
      evidence: { not: Prisma.JsonNullValueFilter.DbNull },
    },
    select: { id: true, evidence: true },
    take: params.batchSize ?? 500,
  });
  for (const item of stale) {
    const evidence = item.evidence as Record<string, unknown> | null;
    if (!evidence) continue;
    const { rawRecord: _rawRecord, ...retained } = evidence;
    await db.regulatorVerificationCase.update({
      where: { id: item.id },
      data: { evidence: retained as any },
    });
  }
  return { processed: stale.length };
}
