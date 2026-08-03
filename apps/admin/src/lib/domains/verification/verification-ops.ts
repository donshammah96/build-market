/**
 * Verification Ops Domain Service (ADR-ADMIN-002)
 *
 * Dedicated verification operations domain slice managing queue classification,
 * decision packet generation, SLA monitoring, and four-eyes governance.
 */

import { prisma } from "@build/db";
import { ok, err, type Result } from "@/lib/result";
import type { VerificationActor } from "./contracts";

export type AdminDomainError = {
  code: string;
  message: string;
  details?: unknown;
};

export type VerificationOpsQueueFilter =
  | "PENDING"
  | "AUTOMATED_REVIEW"
  | "NEEDS_CHANGES"
  | "ESCALATED"
  | "REJECTED"
  | "VERIFIED"
  | "SLA_BREACHED";

export type VerificationOpsQueueItem = {
  caseId: string;
  professionalId: string;
  professionalName: string;
  authority: string;
  licenseNumber: string;
  status: string;
  confidenceScore: number;
  confidenceAlgorithmVersion: string;
  submittedAt: Date;
  slaDueDate: Date;
  isSlaBreached: boolean;
  requiresSupervisorApproval: boolean;
};

export type DecisionPacket = {
  packetId: string;
  caseId: string;
  professionalId: string;
  authority: string;
  licenseNumber: string;
  finalStatus: string;
  decidedBy: string;
  supervisorApprovedBy?: string | undefined;
  evidenceSnapshot: unknown;
  auditTrail: { timestamp: Date; action: string; actorId: string }[];
  generatedAt: Date;
};

export class VerificationOpsService {
  /**
   * List cases for the dedicated /verification-ops operator surface.
   */
  async listQueue(
    actor: VerificationActor,
    filter: VerificationOpsQueueFilter = "PENDING",
    page = 1,
    limit = 20,
  ): Promise<
    Result<
      { items: VerificationOpsQueueItem[]; total: number },
      AdminDomainError
    >
  > {
    try {
      const systemSettings = await prisma.systemSettings?.findUnique({
        where: { id: "global" },
        select: { verificationSlaHours: true },
      });
      const slaHours = systemSettings?.verificationSlaHours ?? 48;

      const now = new Date();
      // Calculate SLA threshold using system settings or fallback
      const slaThreshold = new Date(now.getTime() - slaHours * 60 * 60 * 1000);

      const whereClause: Record<string, unknown> = {};

      if (filter === "SLA_BREACHED") {
        whereClause.createdAt = { lt: slaThreshold };
        whereClause.status = { in: ["QUEUED", "NEEDS_MANUAL_REVIEW"] };
      } else if (filter === "AUTOMATED_REVIEW") {
        whereClause.status = "AUTO_VERIFIED";
      } else if (filter === "PENDING") {
        whereClause.status = { in: ["QUEUED", "NEEDS_MANUAL_REVIEW"] };
      } else if (filter === "NEEDS_CHANGES") {
        whereClause.status = "NEEDS_MANUAL_REVIEW";
      } else if (filter === "REJECTED") {
        whereClause.status = { in: ["AUTO_REJECTED", "MANUALLY_REJECTED"] };
      } else if (filter === "VERIFIED") {
        whereClause.status = { in: ["AUTO_VERIFIED", "MANUALLY_VERIFIED"] };
      }

      const total = await prisma.regulatorVerificationCase.count({
        where: whereClause,
      });

      const cases = await prisma.regulatorVerificationCase.findMany({
        where: whereClause,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      });

      const items: VerificationOpsQueueItem[] = cases.map((c) => {
        const slaDueDate = new Date(
          c.createdAt.getTime() + slaHours * 60 * 60 * 1000,
        );
        const isSlaBreached = c.createdAt < slaThreshold;
        const requiresSupervisorApproval =
          c.status === "AUTO_REJECTED" || c.status === "MANUALLY_REJECTED";

        const rawData = (c.evidence ??
          (c as { rawVerificationData?: unknown }).rawVerificationData) as {
          confidence?: number;
        } | null;

        return {
          caseId: c.id,
          professionalId: c.professionalId,
          professionalName: `Professional ${c.professionalId.substring(0, 8)}`,
          authority: c.authority,
          licenseNumber: c.licenseNumber,
          status: c.status,
          confidenceScore: rawData?.confidence ?? c.confidence ?? 0,
          confidenceAlgorithmVersion: c.confidenceAlgorithmVersion ?? "v1.0.0",
          submittedAt: c.createdAt,
          slaDueDate,
          isSlaBreached,
          requiresSupervisorApproval,
        };
      });

      return ok({ items, total });
    } catch (error) {
      return err({
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve verification ops queue",
        details: error,
      });
    }
  }

  /**
   * Generate an immutable decision packet for compliance export.
   */
  async generateDecisionPacket(
    actor: VerificationActor,
    caseId: string,
  ): Promise<Result<DecisionPacket, AdminDomainError>> {
    try {
      const vCase = await prisma.regulatorVerificationCase.findUnique({
        where: { id: caseId },
        include: { decisions: true },
      });

      if (!vCase) {
        return err({
          code: "NOT_FOUND",
          message: "Verification case not found",
        });
      }

      const decision = vCase.decisions[0] as unknown as
        | {
            adminId?: string;
            actorId?: string;
            outcome?: string;
            decision?: string;
          }
        | undefined;

      const packet: DecisionPacket = {
        packetId: `PKT-${vCase.id.substring(0, 8)}-${Date.now()}`,
        caseId: vCase.id,
        professionalId: vCase.professionalId,
        authority: vCase.authority,
        licenseNumber: vCase.licenseNumber,
        finalStatus: vCase.status,
        decidedBy: decision?.adminId ?? decision?.actorId ?? actor.dbUserId,
        supervisorApprovedBy: undefined,
        evidenceSnapshot:
          vCase.evidence ??
          (vCase as { rawVerificationData?: unknown }).rawVerificationData,
        auditTrail: vCase.decisions.map((d) => {
          const dec = d as unknown as {
            createdAt: Date;
            outcome?: string;
            decision?: string;
            adminId?: string;
            actorId?: string;
          };
          return {
            timestamp: dec.createdAt,
            action: dec.outcome ?? dec.decision ?? "UNKNOWN",
            actorId: dec.adminId ?? dec.actorId ?? "unknown",
          };
        }),
        generatedAt: new Date(),
      };

      return ok(packet);
    } catch (error) {
      return err({
        code: "INTERNAL_ERROR",
        message: "Failed to generate decision packet",
        details: error,
      });
    }
  }
}

export const verificationOpsService = new VerificationOpsService();
