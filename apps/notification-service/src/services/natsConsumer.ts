import {
  createConsumer,
  createNatsClient,
  initializeStreams,
  type TopicConfig,
  type MessagePayload,
  type VerificationEvent,
  type NotificationEvent,
} from "@repo/nats";
import { sendEmail } from "./emailService.js";
import { Notification } from "../models/Notification.js";

let consumer: ReturnType<typeof createConsumer> | null = null;

/**
 * Initialize NATS JetStream consumer for notification events
 */
export async function initializeNatsConsumer(): Promise<void> {
  try {
    // Connect to NATS
    await createNatsClient();

    // Ensure streams exist
    await initializeStreams();

    // Create consumer
    consumer = createConsumer(
      "notification-service",
      "notification-service-group"
    );

    await consumer.connect();

    // Define topic handlers - use type assertion for generic handler compatibility
    const topics: TopicConfig[] = [
      {
        subject: "verification.>",
        handler: handleVerificationEvent as (message: MessagePayload) => Promise<void>,
        consumerOptions: {
          durableName: "notification-verification-consumer",
          deliverPolicy: "new",
          maxDeliver: 5,
        },
      },
      {
        subject: "notification.>",
        handler: handleNotificationEvent as (message: MessagePayload) => Promise<void>,
        consumerOptions: {
          durableName: "notification-dispatch-consumer",
          deliverPolicy: "all", // Workqueue streams require "all" delivery policy
          maxDeliver: 3,
        },
      },
      {
        subject: "user.created",
        handler: handleUserCreatedEvent as (message: MessagePayload) => Promise<void>,
        consumerOptions: {
          durableName: "notification-user-created-consumer",
          deliverPolicy: "new",
        },
      },
      {
        subject: "project.created",
        handler: handleProjectCreatedEvent as (message: MessagePayload) => Promise<void>,
        consumerOptions: {
          durableName: "notification-project-created-consumer",
          deliverPolicy: "new",
        },
      },
    ];

    // Subscribe to topics
    await consumer.subscribe(topics);

    console.log("✓ NATS consumer initialized and subscribed to topics");
  } catch (error) {
    console.error("✗ Failed to initialize NATS consumer:", error);
    // Don't throw - service should still work without NATS
  }
}

/**
 * Handle verification events (professional.verified, store.verified, etc.)
 */
async function handleVerificationEvent(
  message: MessagePayload<VerificationEvent>
): Promise<void> {
  const event = message.data;
  console.log(`[NATS] Received verification event: ${message.subject}`, event);

  try {
    // Determine notification content based on status
    const title = event.success
      ? `${capitalize(event.entityType)} Verified!`
      : `${capitalize(event.entityType)} Verification Update`;

    const content = event.success
      ? `Your ${event.entityType} has been successfully verified. ${event.message}`
      : `Verification status update: ${event.message}`;

    // Create in-app notification
    await Notification.create({
      userId: event.entityId, // Assuming entityId is userId for now
      type: "in_app",
      category: "system",
      title,
      content,
      data: {
        entityType: event.entityType,
        entityId: event.entityId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        verifiedAt: event.verifiedAt,
      },
      read: false,
      sent: true,
      sentAt: new Date(),
    });

    // Send email notification if we have metadata with email
    if (event.metadata?.email) {
      const emailContent = `
        <h2>${title}</h2>
        <p>${content}</p>
        ${event.reason ? `<p><strong>Reason:</strong> ${event.reason}</p>` : ""}
        ${event.notes ? `<p><strong>Notes:</strong> ${event.notes}</p>` : ""}
        <p>Thank you for using Build Market!</p>
      `;

      await sendEmail(
        event.metadata.email as string,
        title,
        emailContent
      );
    }

    console.log(`[NATS] Processed verification event for ${event.entityId}`);
  } catch (error) {
    console.error("[NATS] Failed to process verification event:", error);
    throw error; // Re-throw to trigger NAK and retry
  }
}

/**
 * Handle direct notification events
 */
async function handleNotificationEvent(
  message: MessagePayload<NotificationEvent>
): Promise<void> {
  const event = message.data;
  console.log(`[NATS] Received notification event: ${message.subject}`, event);

  try {
    // Create notification record
    await Notification.create({
      userId: event.userId,
      type: event.type,
      category: event.category,
      title: event.title,
      content: event.content,
      data: event.data,
      read: false,
      sent: event.type !== "email", // Mark email as not sent until actually sent
      sentAt: event.type !== "email" ? new Date() : undefined,
    });

    // Send email if type is email
    if (event.type === "email" && event.data?.email) {
      const sent = await sendEmail(
        event.data.email as string,
        event.title,
        event.content
      );

      // Update sent status
      if (sent) {
        await Notification.updateOne(
          { userId: event.userId, title: event.title },
          { sent: true, sentAt: new Date() }
        );
      }
    }

    console.log(`[NATS] Processed notification for user ${event.userId}`);
  } catch (error) {
    console.error("[NATS] Failed to process notification event:", error);
    throw error;
  }
}

/**
 * Handle user created events - send welcome email
 */
async function handleUserCreatedEvent(
  message: MessagePayload<{ userId: string; email: string; name?: string }>
): Promise<void> {
  const { userId, email, name } = message.data;
  console.log(`[NATS] Received user.created event for ${userId}`);

  try {
    const title = "Welcome to Build Market!";
    const content = `
      <h2>Welcome${name ? `, ${name}` : ""}!</h2>
      <p>Thank you for joining Build Market - your one-stop platform for construction and building services.</p>
      <p>Get started by:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Browse available professionals</li>
        <li>Post your first project</li>
      </ul>
      <p>If you have any questions, our support team is here to help!</p>
    `;

    // Create welcome notification
    await Notification.create({
      userId,
      type: "email",
      category: "system",
      title,
      content,
      read: false,
      sent: false,
    });

    // Send welcome email
    const sent = await sendEmail(email, title, content);

    if (sent) {
      await Notification.updateOne(
        { userId, title },
        { sent: true, sentAt: new Date() }
      );
    }

    console.log(`[NATS] Sent welcome email to ${email}`);
  } catch (error) {
    console.error("[NATS] Failed to send welcome email:", error);
    throw error;
  }
}

/**
 * Handle project created events
 */
async function handleProjectCreatedEvent(
  message: MessagePayload<{
    projectId: string;
    userId: string;
    title: string;
    professionalId?: string;
  }>
): Promise<void> {
  const { projectId, userId, title, professionalId } = message.data;
  console.log(`[NATS] Received project.created event for ${projectId}`);

  try {
    // Notify project owner
    await Notification.create({
      userId,
      type: "in_app",
      category: "project",
      title: "Project Created",
      content: `Your project "${title}" has been created successfully.`,
      data: { projectId },
      read: false,
      sent: true,
      sentAt: new Date(),
    });

    // Notify assigned professional if any
    if (professionalId) {
      await Notification.create({
        userId: professionalId,
        type: "in_app",
        category: "project",
        title: "New Project Assignment",
        content: `You have been assigned to project "${title}".`,
        data: { projectId },
        read: false,
        sent: true,
        sentAt: new Date(),
      });
    }

    console.log(`[NATS] Created project notifications for ${projectId}`);
  } catch (error) {
    console.error("[NATS] Failed to create project notification:", error);
    throw error;
  }
}

/**
 * Gracefully shutdown NATS consumer
 */
export async function shutdownNatsConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log("✓ NATS consumer shutdown complete");
  }
}

/**
 * Capitalize first letter helper
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
