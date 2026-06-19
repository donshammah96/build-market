import { prisma } from "@build/db";
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

const logger = getClientLogger();
const SYSTEM_ACTOR = "SYSTEM_AUTO_VERIFY";

let consumer: JetStreamConsumer | null = null;
let producer: JetStreamProducer | null = null;

async function getProducer(): Promise<JetStreamProducer> {
  if (!producer) {
    producer = createProducer("license-auto-verify-worker");
    await producer.connect();
  }
  return producer;
}

async function handleVerificationSuccess(
  prod: JetStreamProducer,
  event: LicenseVerificationEvent,
  timestamp: string,
): Promise<void> {
  const { licenseId, authority, licenseNumber, professionalId, correlationId } =
    event;
  await prisma.$transaction(async (tx) => {
    // 1. Update status to VERIFIED
    await tx.professionalLicense.update({
      where: { id: licenseId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verificationMethod: `API_${authority}`,
      },
    });

    // 2. Create Audit Log
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
  });

  // 3. Publish license.auto_verified with deterministic msgId
  await prod.publishWithRetry(
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
}

async function handleVerificationFailure(
  prod: JetStreamProducer,
  event: LicenseVerificationEvent,
  timestamp: string,
): Promise<void> {
  const { licenseId, authority, licenseNumber, professionalId, correlationId } =
    event;
  await prisma.$transaction(async (tx) => {
    // 1. Update status to NEEDS_CORRECTION
    await tx.professionalLicense.update({
      where: { id: licenseId },
      data: {
        status: "NEEDS_CORRECTION",
        notes:
          "Automated verification failed. Please check your license details.",
      },
    });

    // 2. Create Audit Log
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
          reason: "External registry returned invalid record",
          correlationId,
        },
      },
    });
  });

  // 3. Publish license.auto_verify_failed with deterministic msgId
  await prod.publishWithRetry(
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
        reason: "External registry returned invalid record",
      },
    },
    {
      maxRetries: 3,
      msgId: `license-verify-failure-${licenseId}-${correlationId}`,
    },
  );
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
          const { licenseId, authority, licenseNumber } = event;

          logger.info("Auto-verify consumer received event", {
            licenseId,
            authority,
            licenseNumber,
          });

          try {
            // Signal message is being actively processed before executing external I/O
            msg.working();

            // Simulate external API call to NCA/EBK
            const isMockValid =
              !licenseNumber.toUpperCase().includes("FAIL") &&
              !licenseNumber.toUpperCase().includes("INVALID");

            // Add short delay to simulate network call
            await new Promise((resolve) => setTimeout(resolve, 500));

            const prod = await getProducer();
            const timestamp = new Date().toISOString();

            if (isMockValid) {
              await handleVerificationSuccess(prod, event, timestamp);
              logger.info("License auto-verified successfully", {
                licenseId,
                licenseNumber,
              });
            } else {
              await handleVerificationFailure(prod, event, timestamp);
              logger.warn("License auto-verification failed", {
                licenseId,
                licenseNumber,
              });
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
