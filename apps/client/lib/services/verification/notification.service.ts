/**
 * Notification Service Integration
 * Handles notification dispatch for verification events
 */

import { prisma } from "@build/db";
import { VerificationResult, type EntityType } from "./types";
import { StructuredLogger } from "@build/resilience";
import {
  getVerificationTemplate,
  type NotificationType,
} from "./notification-templates";
import { queueFailedNotification } from "./notification-queue";
import {
  createProducer,
  type JetStreamProducer,
  type VerificationEvent,
} from "@build/nats";

const logger = new StructuredLogger("verification-notification-service");

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3011";

// NATS producer instance (lazy initialized)
let natsProducer: JetStreamProducer | null = null;

/**
 * Get or create NATS producer
 */
async function getNatsProducer(): Promise<JetStreamProducer> {
  if (!natsProducer) {
    natsProducer = createProducer("verification-service");
    await natsProducer.connect();
  }
  return natsProducer;
}

export async function notifyVerificationResult(
  result: VerificationResult,
  recipientUserId: string
): Promise<void> {
  try {
    // Create in-database notification
    await createDatabaseNotification(result, recipientUserId);

    // Optionally send to external notification service
    if (process.env.ENABLE_NOTIFICATION_SERVICE === "true") {
      await sendToNotificationService(result, recipientUserId);
    }

    logger.info("Verification notification sent", {
      entityType: result.entityType,
      entityId: result.entityId,
      recipientId: recipientUserId,
      status: result.newStatus,
    });
  } catch (error) {
    logger.error("Failed to send verification notification", error as Error, {
      entityType: result.entityType,
      entityId: result.entityId,
    });

    // Queue for retry instead of silently failing
    await queueFailedNotification(result, recipientUserId, error as Error);

    // Don't throw - notification failure shouldn't block verification
  }
}

async function createDatabaseNotification(
  result: VerificationResult,
  recipientUserId: string
): Promise<void> {
  // Get entity name for better notification context
  const entityName = await getEntityName(result.entityType, result.entityId);

  // Map verification status to notification type
  const notificationType: NotificationType =
    result.newStatus === "VERIFIED"
      ? "VERIFIED"
      : result.newStatus === "REJECTED"
        ? "REJECTED"
        : result.newStatus === "NEEDS_CORRECTION"
          ? "NEEDS_CORRECTION"
          : "VERIFIED"; // fallback

  // Get template from centralized configuration
  // Use reason and notes from VerificationResult for proper context
  const template = getVerificationTemplate(
    notificationType,
    result.entityType,
    {
      entityName,
      entityId: result.entityId,
      rejectionReason: result.reason,
      correctionNotes:
        result.newStatus === "NEEDS_CORRECTION" ? result.reason : undefined,
      adminNotes: result.notes,
    }
  );

  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      title: template.title,
      message: template.message,
      type: template.type,
      link: template.link,
    },
  });
}

export async function sendToNotificationService(
  result: VerificationResult,
  recipientUserId: string
): Promise<void> {
  const entityName = await getEntityName(result.entityType, result.entityId);

  const notificationType: NotificationType =
    result.newStatus === "VERIFIED"
      ? "VERIFIED"
      : result.newStatus === "REJECTED"
        ? "REJECTED"
        : result.newStatus === "NEEDS_CORRECTION"
          ? "NEEDS_CORRECTION"
          : "VERIFIED";

  // Use reason and notes from VerificationResult for proper context
  const template = getVerificationTemplate(
    notificationType,
    result.entityType,
    {
      entityName,
      entityId: result.entityId,
      rejectionReason: result.reason,
      correctionNotes:
        result.newStatus === "NEEDS_CORRECTION" ? result.reason : undefined,
      adminNotes: result.notes,
    }
  );

  const response = await fetch(
    `${NOTIFICATION_SERVICE_URL}/api/notifications`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: recipientUserId,
        type: "in_app",
        category: "verification",
        title: template.title,
        content: template.message,
        emailSubject: template.emailSubject,
        emailBody: template.emailBody,
        data: {
          entityType: result.entityType,
          entityId: result.entityId,
          verificationStatus: result.newStatus,
          link: template.link,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Notification service responded with ${response.status}: ${await response.text()}`
    );
  }
}

/**
 * Get entity name for notification context
 */
async function getEntityName(
  entityType: EntityType,
  entityId: string
): Promise<string> {
  try {
    switch (entityType) {
      case "professional": {
        const professional = await prisma.professionalProfile.findUnique({
          where: { userId: entityId },
          select: { companyName: true },
        });
        return professional?.companyName || "Professional Profile";
      }
      case "store": {
        const store = await prisma.store.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        return store?.name || "Store";
      }
      case "property": {
        const property = await prisma.property.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return property?.title || "Property";
      }
      case "certificate": {
        // Certificates are documents, fetch certificate name
        const certificate = await prisma.certificate.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        return certificate?.name || "Certificate";
      }
      default:
        return "Your submission";
    }
  } catch (error) {
    logger.warn("Failed to fetch entity name for notification", {
      error: error instanceof Error ? error.message : String(error),
      entityType,
      entityId,
    });
    return "Your submission";
  }
}

// Email notification via NATS JetStream
export async function publishVerificationEvent(
  result: VerificationResult,
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    const producer = await getNatsProducer();

    // Build verification event payload
    const event: VerificationEvent = {
      entityType: result.entityType,
      entityId: result.entityId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      success: result.success,
      message: result.message,
      verifiedAt: result.verifiedAt?.toISOString(),
      reason: result.reason,
      notes: result.notes,
      metadata: {
        email: userEmail,
        userName,
      },
    };

    // Publish to verification stream
    // Subject format: verification.<entityType>.<action>
    const subject = `verification.${result.entityType}.${result.newStatus.toLowerCase()}`;

    await producer.publishWithRetry(subject, event, {
      msgId: `${result.entityType}-${result.entityId}-${Date.now()}`,
      maxRetries: 3,
      retryDelay: 1000,
    });

    logger.info("Verification event published to NATS", {
      subject,
      entityId: result.entityId,
      status: result.newStatus,
      userEmail,
    });
  } catch (error) {
    logger.error("Failed to publish verification event to NATS", error as Error, {
      entityType: result.entityType,
      entityId: result.entityId,
    });

    // Queue for retry - don't throw to prevent blocking verification flow
    await queueFailedNotification(result, userEmail, error as Error);
  }
}

/**
 * Shutdown NATS producer gracefully (call on app shutdown)
 */
export async function shutdownNatsProducer(): Promise<void> {
  if (natsProducer) {
    await natsProducer.disconnect();
    natsProducer = null;
    logger.info("NATS producer shutdown complete");
  }
}
