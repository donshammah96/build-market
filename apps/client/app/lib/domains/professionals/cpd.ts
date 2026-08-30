import {
  prisma,
  CpdActivityType,
  LicenseAuthority,
  type ProfessionalCpdRecord,
} from "@build/db";
import { ok, err, type Result } from "@/app/lib/errors/result";

export interface LogCpdActivityInput {
  professionalId: string;
  activityType: CpdActivityType;
  providerName: string;
  activityTitle: string;
  pointsEarned: number;
  completedAt: Date;
  evidenceAssetId?: string;
}

export interface CpdComplianceSummary {
  professionalId: string;
  currentYear: number;
  totalPointsEarned: number;
  targetPoints: number; // e.g. 10 for NCA
  isCompliant: boolean;
  pointsRemaining: number;
  activityCount: number;
  records: Array<{
    id: string;
    activityType: CpdActivityType;
    providerName: string;
    activityTitle: string;
    pointsEarned: number;
    completedAt: Date;
    verified: boolean;
    evidenceAssetId: string | null;
  }>;
}

export interface CpdDomainError {
  code: "NOT_FOUND" | "INVALID_INPUT" | "DATABASE_ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export class ClientCpdService {
  /**
   * Logs a completed professional CPD activity.
   */
  async logCpdActivity(
    input: LogCpdActivityInput,
  ): Promise<Result<{ id: string; pointsEarned: number }, CpdDomainError>> {
    if (
      !input.activityTitle ||
      !input.providerName ||
      input.pointsEarned <= 0
    ) {
      return err({
        code: "INVALID_INPUT",
        message:
          "Activity title, provider name, and points earned (>0) are required",
      });
    }

    try {
      const record = await prisma.professionalCpdRecord.create({
        data: {
          professionalId: input.professionalId,
          activityType: input.activityType,
          providerName: input.providerName,
          activityTitle: input.activityTitle,
          pointsEarned: input.pointsEarned,
          completedAt: input.completedAt,
          evidenceAssetId: input.evidenceAssetId,
        },
      });

      return ok({
        id: record.id,
        pointsEarned: record.pointsEarned,
      });
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to record CPD activity",
        details: { error: String(error) },
      });
    }
  }

  /**
   * Retrieves annual CPD compliance status for a professional.
   */
  async getComplianceSummary(
    professionalId: string,
    year?: number,
  ): Promise<Result<CpdComplianceSummary, CpdDomainError>> {
    const targetYear = year ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(targetYear, 0, 1));
    const yearEnd = new Date(Date.UTC(targetYear + 1, 0, 1));

    try {
      // Check if professional holds regulated licenses (e.g. NCA)
      const licenses = await prisma.professionalLicense.findMany({
        where: { professionalId },
      });

      const hasNca = licenses.some((l) => l.authority === LicenseAuthority.NCA);
      const targetPoints = hasNca ? 10 : 10; // National standard requirement

      const records: ProfessionalCpdRecord[] =
        await prisma.professionalCpdRecord.findMany({
          where: {
            professionalId,
            completedAt: {
              gte: yearStart,
              lt: yearEnd,
            },
          },
          orderBy: { completedAt: "desc" },
        });

      const totalPoints = records.reduce(
        (sum: number, r: ProfessionalCpdRecord) => sum + r.pointsEarned,
        0,
      );
      const isCompliant = totalPoints >= targetPoints;
      const pointsRemaining = Math.max(0, targetPoints - totalPoints);

      return ok({
        professionalId,
        currentYear: targetYear,
        totalPointsEarned: totalPoints,
        targetPoints,
        isCompliant,
        pointsRemaining,
        activityCount: records.length,
        records: records.map((r: ProfessionalCpdRecord) => ({
          id: r.id,
          activityType: r.activityType,
          providerName: r.providerName,
          activityTitle: r.activityTitle,
          pointsEarned: r.pointsEarned,
          completedAt: r.completedAt,
          verified: r.verified,
          evidenceAssetId: r.evidenceAssetId,
        })),
      });
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to retrieve CPD compliance summary",
        details: { error: String(error) },
      });
    }
  }
}

export const clientCpdService = new ClientCpdService();
