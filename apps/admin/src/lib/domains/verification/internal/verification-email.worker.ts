import { prisma } from "@build/db";
import {
  createConsumer,
  initializeStreams,
  type JetStreamConsumer,
  type MessagePayload,
  type VerificationEvent,
  type LicenseVerificationEvent,
} from "@build/nats";

import { StructuredLogger } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { sendEmail } from "@/lib/infrastructure/mailer";
import {
  getVerificationTemplate,
  type NotificationType,
} from "./notification-templates";
import { getEntityName } from "./notification-helpers";
import { verificationRepository } from "../repository";
import type { EntityType } from "./types";

const logger = new StructuredLogger("verification-email-worker");
let consumer: JetStreamConsumer | null = null;

/**
 * Resolve recipient email and name for a verification event
 */
async function resolveRecipientEmail(
  event: VerificationEvent,
): Promise<{ email: string; name: string } | null> {
  // 1. Try resolving email and name from metadata
  if (event.metadata?.email && typeof event.metadata.email === "string") {
    const recipientEmail = event.metadata.email;
    const name =
      typeof event.metadata.userName === "string"
        ? event.metadata.userName
        : "";
    return { email: recipientEmail, name };
  }

  // 2. Database lookup fallback
  let recipientUserId: string | null = null;
  try {
    if (event.entityType === "professional") {
      recipientUserId = event.entityId;
    } else if (event.entityType === "store") {
      recipientUserId = await verificationRepository.findStoreOwnerId(
        event.entityId,
      );
    } else if (event.entityType === "property") {
      recipientUserId = await verificationRepository.findPropertyOwnerId(
        event.entityId,
      );
    } else if (event.entityType === "certificate") {
      const doc = await prisma.professionalDocument.findUnique({
        where: { id: event.entityId },
        select: { professionalId: true },
      });
      recipientUserId = doc?.professionalId ?? null;
    }
  } catch (err) {
    logger.error(
      "Failed to resolve recipient user ID from database",
      err as Error,
      {
        entityType: event.entityType,
        entityId: event.entityId,
      },
    );
    return null;
  }

  if (!recipientUserId) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user?.email) {
      return null;
    }

    return {
      email: user.email,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    };
  } catch (err) {
    logger.error("Failed to fetch user details from database", err as Error, {
      recipientUserId,
    });
    return null;
  }
}

/**
 * Start the NATS verification email consumer
 */
export async function startVerificationEmailConsumer(): Promise<void> {
  if (typeof window !== "undefined") return;

  try {
    if (!adminEnvConfig.NATS_URL) {
      logger.info(
        "NATS_URL not configured, skipping verification email consumer start",
      );
      return;
    }

    await initializeStreams({ servers: adminEnvConfig.NATS_URL });

    consumer = createConsumer(
      "verification-email-worker",
      "verification-email-group",
    );
    await consumer.connect();

    await consumer.subscribe([
      {
        subject: "verification.>",
        consumerOptions: {
          durableName: "verification-email-worker",
        },
        handler: async (msg: MessagePayload) => {
          const event = msg.data as VerificationEvent;
          const { entityType, entityId, newStatus } = event;

          logger.info("Verification email consumer received event", {
            entityType,
            entityId,
            newStatus,
          });

          try {
            msg.working();

            // 1. Resolve recipient details
            const recipient = await resolveRecipientEmail(event);
            if (!recipient) {
              logger.info(
                "Skipped sending email: recipient email could not be resolved",
                {
                  entityType,
                  entityId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            // 2. Fetch entity name
            const entityName = await getEntityName(
              entityType as EntityType,
              entityId,
            );

            // 3. Map status to notification type
            const notificationType: NotificationType =
              newStatus === "VERIFIED"
                ? "VERIFIED"
                : newStatus === "REJECTED"
                  ? "REJECTED"
                  : newStatus === "NEEDS_CORRECTION"
                    ? "NEEDS_CORRECTION"
                    : "VERIFIED";

            // 4. Resolve notification templates
            const template = getVerificationTemplate(
              notificationType,
              entityType as EntityType,
              {
                entityName,
                entityId,
                rejectionReason: event.reason,
                correctionNotes:
                  newStatus === "NEEDS_CORRECTION" ? event.reason : undefined,
                adminNotes: event.notes,
              },
            );

            if (!template.emailSubject || !template.emailBody) {
              logger.info(
                "Skipped sending email: template subject or body is missing",
                {
                  entityType,
                  entityId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            // 5. Send email via Resend
            if (!adminEnvConfig.RESEND_API_KEY) {
              logger.warn(
                "Skipped sending email: RESEND_API_KEY is not configured",
                {
                  entityType,
                  entityId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            await sendEmail({
              to: recipient.email,
              subject: template.emailSubject,
              html: template.emailBody,
            });

            logger.info("Verification email sent successfully", {
              entityType,
              entityId,
              outcome: "success",
            });
          } catch (handlerErr) {
            logger.error(
              "Error inside verification email message handler",
              handlerErr as Error,
              {
                entityId,
                outcome: "email_failed",
              },
            );
            throw handlerErr;
          }
        },
      },
      {
        subject: "license.>",
        consumerOptions: {
          durableName: "verification-email-worker-license",
        },
        handler: async (msg: MessagePayload) => {
          const event = msg.data as LicenseVerificationEvent;
          const { licenseId, professionalId, action, newStatus } = event;

          logger.info("Verification email consumer received license event", {
            licenseId,
            action,
            newStatus,
          });

          // only send email for admin-driven, terminal outcomes —
          // not for auto_verify_requested/submitted/expiring_soon
          if (!["verified", "rejected", "needs_correction"].includes(action)) {
            return;
          }

          try {
            msg.working();

            // Resolve recipient details via professionalId
            const user = await prisma.user.findUnique({
              where: { id: professionalId },
              select: { email: true, firstName: true, lastName: true },
            });

            if (!user?.email) {
              logger.info(
                "Skipped sending license email: user email could not be resolved",
                {
                  licenseId,
                  professionalId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            const recipient = {
              email: user.email,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            };

            const entityName = await getEntityName("license", licenseId);

            const notificationType: NotificationType =
              newStatus === "VERIFIED"
                ? "VERIFIED"
                : newStatus === "REJECTED"
                  ? "REJECTED"
                  : newStatus === "NEEDS_CORRECTION"
                    ? "NEEDS_CORRECTION"
                    : "VERIFIED";

            const template = getVerificationTemplate(
              notificationType,
              "license",
              {
                entityName,
                entityId: licenseId,
                rejectionReason:
                  typeof event.metadata?.reason === "string"
                    ? event.metadata.reason
                    : undefined,
                correctionNotes:
                  newStatus === "NEEDS_CORRECTION" &&
                  typeof event.metadata?.reason === "string"
                    ? event.metadata.reason
                    : undefined,
                adminNotes:
                  typeof event.metadata?.notes === "string"
                    ? event.metadata.notes
                    : undefined,
              },
            );

            if (!template.emailSubject || !template.emailBody) {
              logger.info(
                "Skipped sending license email: template subject or body is missing",
                {
                  licenseId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            if (!adminEnvConfig.RESEND_API_KEY) {
              logger.warn(
                "Skipped sending license email: RESEND_API_KEY is not configured",
                {
                  licenseId,
                  outcome: "email_skipped",
                },
              );
              return;
            }

            await sendEmail({
              to: recipient.email,
              subject: template.emailSubject,
              html: template.emailBody,
            });

            logger.info("License verification email sent successfully", {
              licenseId,
              outcome: "success",
            });
          } catch (handlerErr) {
            logger.error(
              "Error inside license verification email message handler",
              handlerErr as Error,
              {
                licenseId,
                outcome: "email_failed",
              },
            );
            throw handlerErr;
          }
        },
      },
    ]);

    logger.info("Verification email NATS consumer started successfully");
  } catch (err) {
    logger.error(
      "Failed to start verification email NATS consumer",
      err as Error,
    );
  }
}

/**
 * Stop the NATS verification email consumer
 */
export async function stopVerificationEmailConsumer(): Promise<void> {
  try {
    if (consumer) {
      await consumer.disconnect();
      consumer = null;
      logger.info("Verification email NATS consumer stopped");
    }
  } catch (err) {
    logger.error(
      "Error stopping verification email NATS worker service",
      err as Error,
    );
  }
}
