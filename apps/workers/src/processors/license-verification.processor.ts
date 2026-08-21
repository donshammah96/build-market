import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import type { Job } from "bullmq";
import type { LicenseVerificationJobData } from "@build/queue-server";

const logger = new StructuredLogger("worker-license-verification-processor");

export interface LicenseVerificationJobResult {
  status: "AUTO_VERIFIED" | "NEEDS_MANUAL_REVIEW" | "FAILED";
  licenseId?: string;
  professionalId: string;
  authority: string;
  licenseNumber: string;
  reason?: string;
}

export async function processLicenseVerificationJob(
  job: Job<LicenseVerificationJobData>,
): Promise<LicenseVerificationJobResult> {
  const { professionalId, licenseId, authority, licenseNumber, submittedName } =
    job.data;
  const correlationId =
    job.data.correlationId || CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.info(
    "[LicenseVerificationProcessor] Processing license verification job",
    {
      correlationId,
      professionalId,
      licenseId,
      authority,
      licenseNumber,
      jobId: job.id,
    },
  );

  try {
    // 1. Fetch system settings to check if auto-verification is enabled for authority
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "global" },
    });

    let isAutoVerifyEnabled = false;
    if (authority === "NCA")
      isAutoVerifyEnabled = settings?.enableAutoVerifyNCA ?? false;
    else if (authority === "EPRA")
      isAutoVerifyEnabled = settings?.enableAutoVerifyEPRA ?? false;
    else if (authority === "BORAQS")
      isAutoVerifyEnabled = settings?.enableAutoVerifyBORAQS ?? false;
    else if (authority === "EBK")
      isAutoVerifyEnabled = settings?.enableAutoVerifyEBK ?? false;
    else if (authority === "EARB")
      isAutoVerifyEnabled = settings?.enableAutoVerifyEARB ?? false;
    else if (authority === "VRB")
      isAutoVerifyEnabled = settings?.enableAutoVerifyVRB ?? false;
    else if (authority === "ISK")
      isAutoVerifyEnabled = settings?.enableAutoVerifyISK ?? false;

    const dedupeKey = `${authority}:${licenseNumber}:${professionalId}`;
    const now = new Date();

    // 2. Auto-verify if enabled and format is valid, otherwise route to manual review
    if (
      isAutoVerifyEnabled &&
      licenseNumber &&
      licenseNumber.trim().length > 3
    ) {
      if (licenseId) {
        await prisma.professionalLicense.update({
          where: { id: licenseId },
          data: {
            status: "VERIFIED",
            verifiedAt: now,
          },
        });
      }

      await prisma.regulatorVerificationCase.upsert({
        where: { id: dedupeKey },
        create: {
          id: dedupeKey,
          dedupeKey,
          professionalId,
          authority,
          licenseNumber,
          status: "AUTO_VERIFIED",
          confidence: 95,
          confidenceReasons: [
            "Format validated and authority auto-verify enabled",
          ],
          requestedAt: now,
          completedAt: now,
        },
        update: {
          status: "AUTO_VERIFIED",
          confidence: 95,
          completedAt: now,
        },
      });

      logger.info("[LicenseVerificationProcessor] License auto-verified", {
        correlationId,
        professionalId,
        authority,
        licenseNumber,
      });

      return {
        status: "AUTO_VERIFIED",
        licenseId: licenseId ?? undefined,
        professionalId,
        authority,
        licenseNumber,
      };
    }

    // Manual review fallback
    await prisma.regulatorVerificationCase.upsert({
      where: { id: dedupeKey },
      create: {
        id: dedupeKey,
        dedupeKey,
        professionalId,
        authority,
        licenseNumber,
        status: "NEEDS_MANUAL_REVIEW",
        confidence: 50,
        confidenceReasons: [
          "Auto-verification disabled or requires manual inspection",
        ],
        requestedAt: now,
      },
      update: {
        status: "NEEDS_MANUAL_REVIEW",
      },
    });

    logger.info(
      "[LicenseVerificationProcessor] License routed to manual review",
      {
        correlationId,
        professionalId,
        authority,
        licenseNumber,
      },
    );

    return {
      status: "NEEDS_MANUAL_REVIEW",
      licenseId: licenseId ?? undefined,
      professionalId,
      authority,
      licenseNumber,
      reason: "Routed to manual review",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      "[LicenseVerificationProcessor] License verification failed",
      err instanceof Error ? err : new Error(errorMsg),
      {
        correlationId,
        professionalId,
        authority,
        licenseNumber,
      },
    );

    throw err;
  }
}
