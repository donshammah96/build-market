/**
 * License External Verification Service
 * Handles requesting automatic verification from external APIs (NCA/EBK)
 */

import type { LicenseVerificationEvent } from "@build/nats";
import { getAdminNatsProducer } from "@/lib/infrastructure/nats-client";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("license-external-verification-service");

export async function requestAutoVerification(
  licenseId: string,
  professionalId: string,
  authority: "NCA" | "EBK",
  licenseNumber: string,
  correlationId: string,
): Promise<void> {
  try {
    const producer = await getAdminNatsProducer();
    const event: LicenseVerificationEvent = {
      licenseId,
      professionalId,
      authority,
      licenseNumber,
      previousStatus: "PENDING",
      newStatus: "PENDING",
      action: "auto_verify_requested",
      correlationId,
      timestamp: new Date().toISOString(),
    };

    const subject = "license.auto_verify_requested";
    await producer.publishWithRetry<LicenseVerificationEvent>(subject, event, {
      msgId: `auto-verify-req-${licenseId}-${Date.now()}`,
      maxRetries: 3,
    });

    logger.info("External auto-verification requested", {
      licenseId,
      authority,
      licenseNumber,
      correlationId,
    });
  } catch (error) {
    logger.error(
      "Failed to request external auto-verification",
      error as Error,
      {
        licenseId,
        authority,
        licenseNumber,
      },
    );
  }
}
