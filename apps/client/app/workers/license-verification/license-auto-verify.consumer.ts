import { prisma } from "@build/db";
import type { LicenseAuthority } from "@prisma/client";
import {
  createConsumer,
  createProducer,
  JetStreamConsumer,
  JetStreamProducer,
  MessagePayload,
  LicenseVerificationEvent,
} from "@build/nats";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { envConfig } from "@/app/lib/infrastructure/env";
import {
  RegulatorVerificationGateway,
  handleVerificationSuccess,
  handleVerificationFailure,
} from "@/app/lib/domains/regulator-verification";

const logger = getClientLogger();

// Regulator adapters are resolved lazily per verification attempt (rather
// than once at module load) so that flipping a SystemSettings kill switch
// (enableAutoVerifyNCA/EPRA/BORAQS) takes effect on the very next message
// without requiring a worker restart.
async function buildRegulatorGateway(): Promise<RegulatorVerificationGateway> {
  const { buildProductionAdapterMap } =
    await import("@/app/lib/domains/regulator-verification/adapters");
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "global" },
  });

  return new RegulatorVerificationGateway({
    adapters: buildProductionAdapterMap({
      enableAutoVerifyNCA: settings?.enableAutoVerifyNCA ?? false,
      enableAutoVerifyEPRA: settings?.enableAutoVerifyEPRA ?? false,
      enableAutoVerifyBORAQS: settings?.enableAutoVerifyBORAQS ?? false,
      enableAutoVerifyEBK: settings?.enableAutoVerifyEBK ?? false,
      enableAutoVerifyEARB: settings?.enableAutoVerifyEARB ?? false,
      enableAutoVerifyVRB: settings?.enableAutoVerifyVRB ?? false,
      enableAutoVerifyISK: settings?.enableAutoVerifyISK ?? false,
    }),
  });
}

let consumer: JetStreamConsumer | null = null;
let producer: JetStreamProducer | null = null;

async function getProducer(): Promise<JetStreamProducer> {
  if (!producer) {
    producer = createProducer("license-auto-verify-worker");
    await producer.connect();
  }
  return producer;
}

export async function startLicenseAutoVerifyConsumer(): Promise<void> {
  if (typeof window !== "undefined") return; // Avoid running on client side

  try {
    if (!envConfig.nats?.url) {
      logger.info("NATS not configured, skipping auto-verify consumer start");
      return;
    }

    consumer = createConsumer(
      "license-auto-verify-worker",
      "license-auto-verify-group",
    );
    await consumer.connect();

    await consumer.subscribe([
      {
        subject: "license.auto_verify_requested",
        consumerOptions: {
          durableName: "license-auto-verify-worker",
        },
        handler: async (msg: MessagePayload) => {
          const event = msg.data as LicenseVerificationEvent;
          const { licenseId, authority, licenseNumber, professionalId } = event;

          logger.info("Auto-verify consumer received event", {
            licenseId,
            authority,
            licenseNumber,
          });

          try {
            // Signal message is being actively processed before executing external I/O
            msg.working();

            const regulatorGateway = await buildRegulatorGateway();
            const request = {
              professionalId,
              licenseId,
              authority: authority as LicenseAuthority,
              licenseNumber,
              correlationId: event.correlationId,
            };
            const verification = await regulatorGateway.verify(request);

            const prod = await getProducer();
            const timestamp = new Date().toISOString();
            // This legacy NATS path is not attempt-tracked by a durable
            // queue - attemptNumber is always 1 here. Onboarding submissions
            // routed through license-verification-queue.ts (TODO 3) carry
            // real attempt/backoff bookkeeping instead.
            const outcomeParams = {
              producer: prod,
              event,
              request,
              result: verification,
              timestamp,
              attemptNumber: 1,
              maxAttempts: 1,
            };

            if (verification.status === "AUTO_VERIFIED") {
              await handleVerificationSuccess(outcomeParams);
              logger.info("License auto-verified successfully", {
                licenseId,
                licenseNumber,
                confidence: verification.confidence,
                confidenceReasons: verification.confidenceReasons,
              });
            } else {
              await handleVerificationFailure(outcomeParams);
              logger.warn(
                "License auto-verification routed to manual fallback",
                {
                  licenseId,
                  licenseNumber,
                  verificationStatus: verification.status,
                  confidence: verification.confidence,
                  confidenceReasons: verification.confidenceReasons,
                  manualFallbackReason: verification.manualFallbackReason,
                  retryable: verification.retryable,
                },
              );
            }
          } catch (handlerErr) {
            logger.error(
              "Error inside auto-verify message handler",
              handlerErr as Error,
              {
                licenseId,
              },
            );
            // Re-throw so that the outer NATS consumer wrapper catches it, triggers msg.nak() and records error on the span
            throw handlerErr;
          }
        },
      },
    ]);

    logger.info("License auto-verify NATS consumer started successfully");
  } catch (err) {
    logger.error(
      "Failed to start license auto-verify NATS consumer",
      err as Error,
    );
  }
}

export async function stopLicenseAutoVerifyConsumer(): Promise<void> {
  try {
    if (consumer) {
      await consumer.disconnect();
      consumer = null;
      logger.info("License auto-verify NATS consumer stopped");
    }
    if (producer) {
      await producer.disconnect();
      producer = null;
      logger.info("License auto-verify NATS producer stopped");
    }
  } catch (err) {
    logger.error(
      "Error stopping license auto-verify NATS worker services",
      err as Error,
    );
  }
}
