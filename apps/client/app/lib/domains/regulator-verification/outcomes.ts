import { prisma } from "@build/db";
import type { JetStreamProducer, LicenseVerificationEvent } from "@build/nats";
import { recordVerificationAttempt } from "./evidence-store";
import type {
  RegulatorVerificationRequest,
  RegulatorVerificationResult,
} from "./gateway";
import {
  PROFESSIONAL_FUNNEL_EVENTS,
  trackProfessionalFunnelEvent,
} from "@/app/lib/analytics/professional-funnel-events";
import { getProductionFunnelSink } from "@/app/lib/analytics/professional-funnel-sink";

const SYSTEM_ACTOR = "SYSTEM_AUTO_VERIFY";

export type VerificationOutcomeParams = {
  producer: JetStreamProducer;
  event: LicenseVerificationEvent;
  request: RegulatorVerificationRequest;
  result: RegulatorVerificationResult;
  timestamp: string;
  attemptNumber: number;
  maxAttempts: number;
};

/**
 * Persists the AUTO_VERIFIED outcome (license status + audit log + durable
 * verification-case row) in a single transaction, then publishes
 * `license.auto_verified` with a deterministic msgId for replay safety.
 */
export async function handleVerificationSuccess(
  params: VerificationOutcomeParams,
): Promise<void> {
  const {
    producer,
    event,
    request,
    result,
    timestamp,
    attemptNumber,
    maxAttempts,
  } = params;
  const { licenseId, authority, licenseNumber, professionalId, correlationId } =
    event;

  await prisma.$transaction(async (tx) => {
    await tx.professionalLicense.update({
      where: { id: licenseId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verificationMethod: `API_${authority}`,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: "SYSTEM",
        adminName: SYSTEM_ACTOR,
        adminEmail: "system@buildmarket",
        adminRole: "SUPER_ADMIN",
        action: "AUTO_VERIFY_LICENSE",
        targetType: "ProfessionalLicense",
        targetId: licenseId,
        details: {
          authority,
          licenseNumber,
          method: `API_${authority}`,
          newStatus: "VERIFIED",
          correlationId,
        },
      },
    });

    await recordVerificationAttempt(tx, {
      request,
      result,
      attemptNumber,
      maxAttempts,
    });
  });

  await producer.publishWithRetry(
    `license.auto_verified`,
    {
      licenseId,
      professionalId,
      authority,
      licenseNumber,
      previousStatus: "PENDING",
      newStatus: "VERIFIED",
      action: "auto_verified",
      verificationMethod: `API_${authority}`,
      correlationId,
      timestamp,
    },
    {
      maxRetries: 3,
      msgId: `license-verify-success-${licenseId}-${correlationId}`,
    },
  );

  trackProfessionalFunnelEvent(
    getProductionFunnelSink(),
    PROFESSIONAL_FUNNEL_EVENTS.verificationTransitioned,
    { correlationId, status: "AUTO_VERIFIED", role: "professional" },
  );
}

/**
 * Persists the non-auto-verified outcome (NEEDS_MANUAL_REVIEW,
 * REGULATOR_UNAVAILABLE, LOW_CONFIDENCE, AUTO_REJECTED) and the durable
 * verification-case row, then publishes `license.auto_verify_failed`.
 *
 * Note: "failure" here means "did not auto-verify", not "the worker
 * threw" - regulator outages and low-confidence matches both land here and
 * are still routed to manual review rather than retried indefinitely by
 * this path (the BullMQ queue layer owns request-level retry/backoff).
 */
export async function handleVerificationFailure(
  params: VerificationOutcomeParams,
): Promise<void> {
  const {
    producer,
    event,
    request,
    result,
    timestamp,
    attemptNumber,
    maxAttempts,
  } = params;
  const { licenseId, authority, licenseNumber, professionalId, correlationId } =
    event;

  await prisma.$transaction(async (tx) => {
    await tx.professionalLicense.update({
      where: { id: licenseId },
      data: {
        status: "NEEDS_CORRECTION",
        notes:
          "Automated verification failed. Please check your license details.",
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: "SYSTEM",
        adminName: SYSTEM_ACTOR,
        adminEmail: "system@buildmarket",
        adminRole: "SUPER_ADMIN",
        action: "AUTO_VERIFY_LICENSE_FAILED",
        targetType: "ProfessionalLicense",
        targetId: licenseId,
        details: {
          authority,
          licenseNumber,
          method: `API_${authority}`,
          newStatus: "NEEDS_CORRECTION",
          reason:
            result.manualFallbackReason ?? "verification_not_auto_approved",
          correlationId,
        },
      },
    });

    await recordVerificationAttempt(tx, {
      request,
      result,
      attemptNumber,
      maxAttempts,
    });
  });

  await producer.publishWithRetry(
    `license.auto_verify_failed`,
    {
      licenseId,
      professionalId,
      authority,
      licenseNumber,
      previousStatus: "PENDING",
      newStatus: "NEEDS_CORRECTION",
      action: "auto_verify_failed",
      verificationMethod: `API_${authority}`,
      correlationId,
      timestamp,
      metadata: {
        reason: result.manualFallbackReason ?? "verification_not_auto_approved",
        verificationStatus: result.status,
      },
    },
    {
      maxRetries: 3,
      msgId: `license-verify-failure-${licenseId}-${correlationId}`,
    },
  );

  trackProfessionalFunnelEvent(
    getProductionFunnelSink(),
    PROFESSIONAL_FUNNEL_EVENTS.verificationTransitioned,
    {
      correlationId,
      status: result.status,
      role: "professional",
      errorCode: result.manualFallbackReason,
      retryable: result.retryable,
    },
  );
}
