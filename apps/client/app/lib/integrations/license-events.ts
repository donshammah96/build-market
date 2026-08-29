import { env, envConfig } from "@/app/lib/infrastructure/env";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { createProducer } from "@build/nats";
import type { JetStreamProducer, LicenseVerificationEvent } from "@build/nats";

// NATS producer instance (lazy initialized)
let natsProducer: JetStreamProducer | null = null;

async function getNatsProducer(): Promise<JetStreamProducer | null> {
  // Guard 1: Next.js static build phase
  if (env.isBuildPhase) {
    return null;
  }

  // Guard 2: Missing NATS URL
  if (!envConfig.nats?.url) {
    return null;
  }

  if (!natsProducer) {
    natsProducer = createProducer("client-license-events");
    await natsProducer.connect();
  }
  return natsProducer;
}

/**
 * Thin NATS adapter for license domain events.
 * Fire-and-forget: never throws — failures are structured-logged only.
 */
export async function publishLicenseEvent(
  event: Omit<LicenseVerificationEvent, "timestamp"> & { timestamp?: string },
  opts?: { correlationId?: string },
): Promise<void> {
  const fullEvent: LicenseVerificationEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  try {
    const producer = await getNatsProducer();
    if (!producer) {
      getClientLogger().info(
        "NATS client is not configured or in build phase, skipping license event publish",
        {
          licenseId: event.licenseId,
          action: event.action,
        },
      );
      return;
    }

    const subject = `license.${fullEvent.action}`;
    const msgId = `${fullEvent.licenseId}-${Date.now()}`;

    // Publish to NATS
    await producer.publishWithRetry(subject, fullEvent, {
      msgId,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    getClientLogger().info("License verification event published to NATS", {
      subject,
      licenseId: fullEvent.licenseId,
      action: fullEvent.action,
      correlationId: opts?.correlationId || fullEvent.correlationId,
    });
  } catch (error) {
    getClientLogger().error(
      "Failed to publish license verification event to NATS",
      error as Error,
      {
        licenseId: fullEvent.licenseId,
        action: fullEvent.action,
      },
    );
  }
}

export type ProfessionalOnboardingSubmittedEvent = {
  professionalId: string;
  correlationId: string;
  licenses: Array<{
    licenseId: string;
    authority: string;
    licenseNumber: string;
    submittedName?: string | null;
    companyName?: string | null;
  }>;
};

export async function publishOnboardingSubmittedEvent(
  event: ProfessionalOnboardingSubmittedEvent,
): Promise<void> {
  try {
    const producer = await getNatsProducer();
    if (!producer) {
      getClientLogger().info(
        "NATS client is not configured or in build phase, skipping onboarding submitted event publish",
        { professionalId: event.professionalId },
      );
      return;
    }

    const subject = "professional.onboarding_submitted";
    const msgId = `onboarding-sub-${event.professionalId}-${Date.now()}`;

    await producer.publishWithRetry(subject, event, {
      msgId,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    getClientLogger().info(
      "Professional onboarding submitted event published to NATS",
      {
        subject,
        professionalId: event.professionalId,
        licenseCount: event.licenses.length,
      },
    );
  } catch (error) {
    getClientLogger().error(
      "Failed to publish onboarding submitted event to NATS",
      error as Error,
      { professionalId: event.professionalId },
    );
  }
}
