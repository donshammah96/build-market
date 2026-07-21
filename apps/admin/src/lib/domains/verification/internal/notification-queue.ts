/**
 * Notification Queue Service
 *
 * Handles retry logic for failed notifications using configurable queue strategies:
 * - MEMORY: In-memory queue (development/testing only)
 * - DB: Database-backed queue using Prisma
 * - REDIS: Redis-backed queue using BullMQ
 *
 * Supports exponential backoff retries, dead letter queue, and manual requeueing.
 */

import { StructuredLogger } from "@build/resilience";
import { VerificationResult, type EntityType } from "./types";
import { getEntityName } from "./notification-helpers";
import { Queue, Job } from "bullmq";
import type { VerificationStatus } from "@build/db";
import { FailedNotificationStatus } from "@build/db";
import { getBullMQConnectionOptions } from "@build/queue-server";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { omitUndefined } from "@/lib/utils";
import { prisma } from "@build/db";

// Config and Types
const logger = new StructuredLogger("notification-queue-service");

/**
 * Attempt to resend a notification
 * Returns true on success, false on failure
 */
export async function resendNotification(
  result: VerificationResult,
  recipientUserId: string,
): Promise<boolean> {
  try {
    // Import notification templates and create notification
    const { getVerificationTemplate } =
      await import("./notification-templates");

    // Get entity name for better notification context
    const entityName = await getEntityName(result.entityType, result.entityId);

    // Map verification status to notification type
    const notificationType =
      result.newStatus === "VERIFIED"
        ? "VERIFIED"
        : result.newStatus === "REJECTED"
          ? "REJECTED"
          : result.newStatus === "NEEDS_CORRECTION"
            ? "NEEDS_CORRECTION"
            : "VERIFIED";

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
      },
    );

    // Create database notification
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        title: template.title,
        message: template.message,
        type: template.type,
        link: template.link,
      },
    });

    // Optionally send to external notification service
    if (adminEnvConfig.ENABLE_NOTIFICATION_SERVICE) {
      const notificationServiceUrl =
        adminEnvConfig.NOTIFICATION_SERVICE_URL ?? "http://localhost:3011";

      const response = await fetch(
        `${notificationServiceUrl}/api/notifications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        },
      );

      if (!response.ok) {
        throw new Error(
          `Notification service responded with ${response.status}`,
        );
      }
    }

    return true;
  } catch (error) {
    logger.error("Failed to resend notification", error as Error, {
      entityId: result.entityId,
      recipientUserId,
    });
    return false;
  }
}

// Config enums
export enum QueueProvider {
  MEMORY = "MEMORY",
  DB = "DB",
  REDIS = "REDIS",
}

// Current Provider Selection
const CURRENT_PROVIDER: QueueProvider =
  adminEnvConfig.QUEUE_PROVIDER === "redis" ||
  adminEnvConfig.QUEUE_PROVIDER === "bullmq"
    ? QueueProvider.REDIS
    : adminEnvConfig.QUEUE_PROVIDER === "db"
      ? QueueProvider.DB
      : QueueProvider.MEMORY;

// Maximum retry attempts before moving to dead letter
const MAX_RETRY_ATTEMPTS = 3;

// Retry delays in milliseconds (exponential backoff)
const RETRY_DELAYS: readonly number[] = [60000, 300000, 900000] as const; // 1min, 5min, 15min

// Default retry delay fallback
const DEFAULT_RETRY_DELAY = 60000;

export interface FailedNotificationEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  recipientUserId: string;
  newStatus: string;
  reason?: string | undefined;
  notes?: string | undefined;
  attemptCount: number;
  lastAttemptAt: Date;
  nextRetryAt: Date;
  lastError: string;
  createdAt: Date;
  status: FailedNotificationStatus;
}

// Interface Definition
interface NotificationQueueStrategy {
  queueNotification(
    result: VerificationResult,
    recipientUserId: string,
    error: Error,
  ): Promise<void>;
  processRetries(): Promise<void>; // Called by a cron or worker
  getStats(): Promise<{
    pending: number;
    deadLetter: number;
    completed: number;
  }>;
  requeueDeadLetter(id: string): Promise<void>;
  clearCompletedNotifications(): Promise<number>;
  shutdown?(): Promise<void>; // Optional cleanup method
}

// Notification job data structure for Redis queue
interface NotificationJobData {
  result: VerificationResult;
  recipientUserId: string;
  errorMessage: string;
}

// DB Backed Queue Strategy
class DatabaseQueueStrategy implements NotificationQueueStrategy {
  // 1. Queue a failed notification
  async queueNotification(
    result: VerificationResult,
    recipientUserId: string,
    error: Error,
  ): Promise<void> {
    // Calculate the next retry time (e.g. 1 minute from now)
    const nextRetryAt = new Date(
      Date.now() + (RETRY_DELAYS[0] ?? DEFAULT_RETRY_DELAY),
    );

    await prisma.failedNotification.create({
      data: {
        entityType: result.entityType,
        entityId: result.entityId,
        recipientUserId,
        newStatus: result.newStatus,
        reason: result.reason ?? null,
        notes: result.notes ?? null,
        lastError: error.message,
        nextRetryAt,
        status: "PENDING",
        attemptCount: 1,
      },
    });

    logger.info("Queued failed notification to DB", {
      entityId: result.entityId,
    });
  }

  // 2. Process pending retries
  async processRetries(): Promise<void> {
    const now = new Date();

    // Fetch pending notifications due for retry
    const pending = await prisma.failedNotification.findMany({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: now },
      },
      take: 50, // Batch size
    });

    for (const item of pending) {
      try {
        // Skip items without required data
        if (!item.newStatus) {
          logger.warn("Skipping notification without newStatus", {
            id: item.id,
          });
          continue;
        }

        // Reconstruct the VerificationResult from stored data
        const verificationResult: VerificationResult = {
          success: true,
          entityType: item.entityType as EntityType,
          entityId: item.entityId,
          previousStatus: "PENDING" as VerificationStatus, // Not stored, use default
          newStatus: item.newStatus as VerificationStatus,
          message: "Retry notification",
          ...omitUndefined({
            reason: item.reason ?? undefined,
            notes: item.notes ?? undefined,
          }),
        };

        // Attempt to resend the notification
        const success = await resendNotification(
          verificationResult,
          item.recipientUserId,
        );

        if (success) {
          await prisma.failedNotification.update({
            where: { id: item.id },
            data: {
              status: "COMPLETED",
              lastAttemptAt: new Date(),
            },
          });

          logger.info("Notification retry succeeded", {
            id: item.id,
            entityId: item.entityId,
          });
        } else {
          // Retry failed, schedule next attempt
          await this.handleFailure(
            item as FailedNotificationEntry,
            "Notification send returned false",
          );
        }
      } catch (e: unknown) {
        // Exception occurred, schedule next attempt
        await this.handleFailure(
          item as FailedNotificationEntry,
          e instanceof Error ? e.message : "Unknown error",
        );
      }
    }
  }

  private async handleFailure(
    item: FailedNotificationEntry,
    errorMessage?: string,
  ): Promise<void> {
    const newCount = item.attemptCount + 1;

    // Check if we have exceeded max retries
    if (newCount >= MAX_RETRY_ATTEMPTS) {
      await prisma.failedNotification.update({
        where: { id: item.id },
        data: {
          status: "DEAD_LETTER",
          lastError: errorMessage || "Retry limits exceeded",
          lastAttemptAt: new Date(),
        },
      });

      logger.warn("Notification moved to dead letter after max retries", {
        id: item.id,
        entityId: item.entityId,
        attemptCount: newCount,
      });
    } else {
      // Calculate delay based on attempt count (Exponential Backoff)
      const delayIndex = Math.min(newCount - 1, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIndex] ?? DEFAULT_RETRY_DELAY;

      await prisma.failedNotification.update({
        where: { id: item.id },
        data: {
          attemptCount: newCount,
          nextRetryAt: new Date(Date.now() + delay),
          lastAttemptAt: new Date(),
          lastError: errorMessage ?? "Unknown error",
        },
      });

      logger.info("Notification retry scheduled", {
        id: item.id,
        attemptCount: newCount,
        nextRetryIn: `${delay / 1000}s`,
      });
    }
  }

  // 3. Get queue statistics
  async getStats(): Promise<{
    pending: number;
    deadLetter: number;
    completed: number;
  }> {
    const [pending, deadLetter, completed] = await Promise.all([
      prisma.failedNotification.count({ where: { status: "PENDING" } }),
      prisma.failedNotification.count({
        where: { status: "DEAD_LETTER" },
      }),
      prisma.failedNotification.count({ where: { status: "COMPLETED" } }),
    ]);
    return { pending, deadLetter, completed };
  }

  // 4. Requeue a dead letter notification
  async requeueDeadLetter(id: string): Promise<void> {
    await prisma.failedNotification.update({
      where: { id },
      data: {
        status: "PENDING",
        attemptCount: 0,
        nextRetryAt: new Date(),
        lastError: "",
      },
    });
  }

  // 5. Clear completed notifications
  async clearCompletedNotifications(): Promise<number> {
    const cleared = await prisma.failedNotification.deleteMany({
      where: { status: "COMPLETED" },
    });
    return cleared.count;
  }
}

// Redis Backed Queue Strategy
class RedisQueueStrategy implements NotificationQueueStrategy {
  private queue: Queue<NotificationJobData>;
  private readonly queueName = "notification-retries";

  constructor() {
    const redisConfig = getBullMQConnectionOptions();

    this.queue = new Queue<NotificationJobData>(this.queueName, {
      connection: redisConfig,
    });
  }

  async queueNotification(
    result: VerificationResult,
    recipientUserId: string,
    error: Error,
  ): Promise<void> {
    await this.queue.add(
      "send-notification",
      {
        result,
        recipientUserId,
        errorMessage: error.message,
      },
      {
        attempts: MAX_RETRY_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: DEFAULT_RETRY_DELAY,
        },
      },
    );

    logger.info("Queued failed notification to Redis", {
      entityId: result.entityId,
    });
  }

  async processRetries(): Promise<void> {
    // BullMQ handles this automatically via the worker
    logger.debug("Redis queue processes retries automatically");
  }

  async getStats(): Promise<{
    pending: number;
    deadLetter: number;
    completed: number;
  }> {
    const counts = await this.queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
    );
    return {
      pending: (counts.wait ?? 0) + (counts.active ?? 0),
      deadLetter: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  }

  async requeueDeadLetter(id: string): Promise<void> {
    const job = await this.queue.getJob(id);
    if (job) {
      await job.retry();
      logger.info("Requeued dead letter notification from Redis", { id });
    } else {
      logger.warn("Job not found in Redis queue", { id });
    }
  }

  async clearCompletedNotifications(): Promise<number> {
    const completed = await this.queue.getJobs(["completed"]);
    const count = completed.length;

    await Promise.all(completed.map((job) => job.remove()));

    logger.info("Cleared completed notifications from Redis", { count });
    return count;
  }

  async shutdown(): Promise<void> {
    await this.queue.close();
    logger.info("Redis queue strategy shutdown complete");
  }
}

// In-memory queue for failed notifications (development/testing only)
const failedNotificationsQueue = new Map<string, FailedNotificationEntry>();

/**
 * Generate a unique ID for a failed notification
 */
function generateId(): string {
  return `fn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// In-Memory Queue Strategy (for development/testing)
class MemoryQueueStrategy implements NotificationQueueStrategy {
  async queueNotification(
    result: VerificationResult,
    recipientUserId: string,
    error: Error,
  ): Promise<void> {
    const id = generateId();
    const retryDelay = RETRY_DELAYS[0] ?? DEFAULT_RETRY_DELAY;
    const nextRetryAt = new Date(Date.now() + retryDelay);

    const entry: FailedNotificationEntry = {
      id,
      entityType: result.entityType,
      entityId: result.entityId,
      recipientUserId,
      newStatus: result.newStatus,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      nextRetryAt,
      lastError: error.message,
      createdAt: new Date(),
      status: "PENDING",
      ...omitUndefined({
        reason: result.reason,
        notes: result.notes,
      }),
    };

    failedNotificationsQueue.set(id, entry);

    logger.info("Failed notification queued to memory", {
      id,
      entityType: result.entityType,
      entityId: result.entityId,
      recipientUserId,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  }

  async processRetries(): Promise<void> {
    const now = new Date();

    for (const [id, entry] of failedNotificationsQueue.entries()) {
      if (entry.status === "PENDING" && entry.nextRetryAt <= now) {
        try {
          // Reconstruct the VerificationResult from stored data
          const verificationResult: VerificationResult = {
            success: true,
            entityType: entry.entityType,
            entityId: entry.entityId,
            previousStatus: "PENDING" as VerificationStatus,
            newStatus: entry.newStatus as VerificationStatus,
            message: "Retry notification",
            ...omitUndefined({
              reason: entry.reason,
              notes: entry.notes,
            }),
          };

          // Attempt to resend the notification
          const success = await resendNotification(
            verificationResult,
            entry.recipientUserId,
          );

          if (success) {
            entry.status = "COMPLETED";
            entry.lastAttemptAt = new Date();
            failedNotificationsQueue.set(id, entry);

            logger.info("Memory queue notification retry succeeded", {
              id,
              entityId: entry.entityId,
            });
          } else {
            await this.handleRetryFailure(
              id,
              new Error("Notification send returned false"),
            );
          }
        } catch (e: unknown) {
          await this.handleRetryFailure(
            id,
            e instanceof Error ? e : new Error("Unknown error"),
          );
        }
      }
    }
  }

  private async handleRetryFailure(id: string, error: Error): Promise<void> {
    const entry = failedNotificationsQueue.get(id);
    if (!entry) return;

    const newAttemptCount = entry.attemptCount + 1;

    if (newAttemptCount >= MAX_RETRY_ATTEMPTS) {
      entry.status = "DEAD_LETTER";
      entry.attemptCount = newAttemptCount;
      entry.lastAttemptAt = new Date();
      entry.lastError = error.message;

      logger.warn("Failed notification moved to dead letter", {
        id,
        entityId: entry.entityId,
        attemptCount: newAttemptCount,
      });
    } else {
      const delayIndex = Math.min(newAttemptCount - 1, RETRY_DELAYS.length - 1);
      const retryDelay = RETRY_DELAYS[delayIndex] ?? DEFAULT_RETRY_DELAY;

      entry.attemptCount = newAttemptCount;
      entry.lastAttemptAt = new Date();
      entry.nextRetryAt = new Date(Date.now() + retryDelay);
      entry.lastError = error.message;

      logger.info("Failed notification scheduled for next retry", {
        id,
        attemptCount: newAttemptCount,
        nextRetryAt: entry.nextRetryAt.toISOString(),
      });
    }

    failedNotificationsQueue.set(id, entry);
  }

  async getStats(): Promise<{
    pending: number;
    deadLetter: number;
    completed: number;
  }> {
    let pending = 0;
    let deadLetter = 0;
    let completed = 0;

    for (const entry of failedNotificationsQueue.values()) {
      switch (entry.status) {
        case "PENDING":
          pending++;
          break;
        case "DEAD_LETTER":
          deadLetter++;
          break;
        case "COMPLETED":
          completed++;
          break;
      }
    }

    return { pending, deadLetter, completed };
  }

  async requeueDeadLetter(id: string): Promise<void> {
    const entry = failedNotificationsQueue.get(id);

    if (!entry) {
      logger.warn("Dead letter notification not found for requeue", { id });
      return;
    }

    entry.status = "PENDING";
    entry.attemptCount = 0;
    entry.nextRetryAt = new Date();
    failedNotificationsQueue.set(id, entry);

    logger.info("Dead letter notification requeued", { id });
  }

  async clearCompletedNotifications(): Promise<number> {
    let cleared = 0;

    for (const [id, entry] of failedNotificationsQueue.entries()) {
      if (entry.status === "COMPLETED") {
        failedNotificationsQueue.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info("Cleared completed notifications from memory", {
        count: cleared,
      });
    }

    return cleared;
  }
}

// Strategy Factory
let strategyInstance: NotificationQueueStrategy | null = null;

function getStrategy(): NotificationQueueStrategy {
  if (!strategyInstance) {
    switch (CURRENT_PROVIDER) {
      case QueueProvider.DB:
        strategyInstance = new DatabaseQueueStrategy();
        logger.info("Initialized Database queue strategy");
        break;
      case QueueProvider.REDIS:
        strategyInstance = new RedisQueueStrategy();
        logger.info("Initialized Redis queue strategy");
        break;
      case QueueProvider.MEMORY:
      default:
        strategyInstance = new MemoryQueueStrategy();
        logger.info("Initialized Memory queue strategy (development only)");
        break;
    }
  }
  return strategyInstance;
}

/**
 * Queue a failed notification for retry
 */
export async function queueFailedNotification(
  result: VerificationResult,
  recipientUserId: string,
  error: Error,
): Promise<void> {
  try {
    await getStrategy().queueNotification(result, recipientUserId, error);
  } catch (queueError) {
    // If we can't even queue the failed notification, log it with full details
    logger.error(
      "Failed to queue notification for retry - notification lost",
      queueError as Error,
      {
        entityType: result.entityType,
        entityId: result.entityId,
        recipientUserId,
        newStatus: result.newStatus,
        originalError: error.message,
      },
    );
  }
}

/**
 * Process pending retry notifications (call from cron job or worker)
 */
export async function processRetryNotifications(): Promise<void> {
  try {
    await getStrategy().processRetries();
  } catch (error) {
    logger.error("Failed to process retry notifications", error as Error);
  }
}

/**
 * Update a failed notification after a retry attempt (for in-memory strategy compatibility)
 */
export async function updateFailedNotificationRetry(
  id: string,
  success: boolean,
  error?: Error,
): Promise<void> {
  try {
    const notification = failedNotificationsQueue.get(id);

    if (!notification) {
      logger.warn("Failed notification not found for update", { id });
      return;
    }

    if (success) {
      // Successfully sent - mark as completed
      notification.status = "COMPLETED";
      failedNotificationsQueue.set(id, notification);

      logger.info("Failed notification retry succeeded", {
        id,
        entityType: notification.entityType,
        entityId: notification.entityId,
      });
      return;
    }

    const newAttemptCount = notification.attemptCount + 1;

    if (newAttemptCount >= MAX_RETRY_ATTEMPTS) {
      // Move to dead letter
      notification.status = "DEAD_LETTER";
      notification.attemptCount = newAttemptCount;
      notification.lastAttemptAt = new Date();
      notification.lastError = error?.message || "Unknown error";
      failedNotificationsQueue.set(id, notification);

      logger.warn(
        "Failed notification moved to dead letter after max retries",
        {
          id,
          entityType: notification.entityType,
          entityId: notification.entityId,
          attemptCount: newAttemptCount,
        },
      );
      return;
    }

    // Schedule next retry with exponential backoff
    const delayIndex = Math.min(newAttemptCount - 1, RETRY_DELAYS.length - 1);
    const retryDelay = RETRY_DELAYS[delayIndex] ?? DEFAULT_RETRY_DELAY;
    const nextRetryAt = new Date(Date.now() + retryDelay);

    notification.attemptCount = newAttemptCount;
    notification.lastAttemptAt = new Date();
    notification.nextRetryAt = nextRetryAt;
    notification.lastError = error?.message || "Unknown error";
    failedNotificationsQueue.set(id, notification);

    logger.info("Failed notification scheduled for next retry", {
      id,
      entityType: notification.entityType,
      attemptCount: newAttemptCount,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  } catch (updateError) {
    logger.error(
      "Failed to update notification retry status",
      updateError as Error,
      { id },
    );
  }
}

/**
 * Get pending notifications ready for retry (for in-memory strategy)
 * @deprecated Use processRetryNotifications() instead for automatic processing
 */
export async function getPendingRetryNotifications(
  limit: number = 10,
): Promise<FailedNotificationEntry[]> {
  const now = new Date();
  const pending: FailedNotificationEntry[] = [];

  for (const entry of failedNotificationsQueue.values()) {
    if (entry.status === "PENDING" && entry.nextRetryAt <= now) {
      pending.push(entry);
      if (pending.length >= limit) break;
    }
  }

  // Sort by nextRetryAt ascending
  return pending.sort(
    (a, b) => a.nextRetryAt.getTime() - b.nextRetryAt.getTime(),
  );
}

/**
 * Get dead letter notifications for manual review (for in-memory strategy)
 */
export async function getDeadLetterNotifications(
  limit: number = 50,
): Promise<FailedNotificationEntry[]> {
  const deadLetter: FailedNotificationEntry[] = [];

  for (const entry of failedNotificationsQueue.values()) {
    if (entry.status === "DEAD_LETTER") {
      deadLetter.push(entry);
      if (deadLetter.length >= limit) break;
    }
  }

  // Sort by lastAttemptAt descending
  return deadLetter.sort(
    (a, b) => b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime(),
  );
}

/**
 * Manually retry a dead letter notification
 */
export async function requeueDeadLetterNotification(id: string): Promise<void> {
  try {
    await getStrategy().requeueDeadLetter(id);
  } catch (error) {
    logger.error("Failed to requeue dead letter notification", error as Error, {
      id,
    });
  }
}

/**
 * Get notification queue statistics
 */
export async function getNotificationQueueStats(): Promise<{
  pending: number;
  deadLetter: number;
  completed: number;
}> {
  try {
    return await getStrategy().getStats();
  } catch (error) {
    logger.error("Failed to get queue stats", error as Error);
    return { pending: 0, deadLetter: 0, completed: 0 };
  }
}

/**
 * Clear completed notifications from queue (cleanup)
 */
export async function clearCompletedNotifications(): Promise<number> {
  try {
    return await getStrategy().clearCompletedNotifications();
  } catch (error) {
    logger.error("Failed to clear completed notifications", error as Error);
    return 0;
  }
}

/**
 * Gracefully shutdown the queue (important for Redis strategy)
 */
export async function shutdownQueue(): Promise<void> {
  try {
    const strategy = getStrategy();
    if (strategy.shutdown) {
      await strategy.shutdown();
    }
    strategyInstance = null;
    logger.info("Queue shutdown complete");
  } catch (error) {
    logger.error("Failed to shutdown queue", error as Error);
  }
}

/**
 * Get the current queue provider type
 */
export function getCurrentProvider(): QueueProvider {
  return CURRENT_PROVIDER;
}
