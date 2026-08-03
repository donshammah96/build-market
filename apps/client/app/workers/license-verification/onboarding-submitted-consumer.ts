import type { LicenseAuthority } from "@prisma/client";
import {
  createConsumer,
  type JetStreamConsumer,
  type MessagePayload,
} from "@build/nats";
import { envConfig } from "@/app/lib/infrastructure/env";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { enqueueLicenseVerification } from "@/app/lib/domains/regulator-verification";

const logger = getClientLogger();

let consumer: JetStreamConsumer | null = null;

/**
 * Shape published on `professional.onboarding_submitted` by the onboarding
 * wizard's submit step. One event can carry multiple licenses (e.g. a
 * professional registered under both NCA and a profession-specific board).
 */
type ProfessionalOnboardingSubmittedEvent = {
  professionalId: string;
  correlationId: string;
  licenses: Array<{
    licenseId: string;
    authority: LicenseAuthority;
    licenseNumber: string;
    submittedName?: string | null;
    companyName?: string | null;
  }>;
};

export async function startOnboardingSubmittedConsumer(): Promise<void> {
  if (typeof window !== "undefined") return;

  try {
    if (!envConfig.nats?.url) {
      logger.info(
        "NATS not configured, skipping onboarding-submitted consumer start",
      );
      return;
    }

    consumer = createConsumer(
      "license-verification-enqueue-worker",
      "license-verification-enqueue-group",
    );
    await consumer.connect();

    await consumer.subscribe([
      {
        subject: "professional.onboarding_submitted",
        consumerOptions: {
          durableName: "license-verification-enqueue-worker",
        },
        handler: async (msg: MessagePayload) => {
          const event = msg.data as ProfessionalOnboardingSubmittedEvent;
          msg.working();

          for (const license of event.licenses) {
            const { jobId, alreadyQueued } = await enqueueLicenseVerification({
              professionalId: event.professionalId,
              licenseId: license.licenseId,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
              submittedName: license.submittedName,
              companyName: license.companyName,
              correlationId: event.correlationId,
            });

            logger.info("Onboarding submission routed to verification queue", {
              jobId,
              alreadyQueued,
              authority: license.authority,
              professionalId: event.professionalId,
            });
          }
        },
      },
    ]);

    logger.info(
      "Onboarding-submitted -> license-verification consumer started",
    );
  } catch (err) {
    logger.error("Failed to start onboarding-submitted consumer", err as Error);
  }
}

export async function stopOnboardingSubmittedConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
