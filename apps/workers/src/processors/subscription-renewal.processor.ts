import { prisma, SubscriptionStatus, SubscriptionTierKey } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import type { Job } from "bullmq";

const logger = new StructuredLogger("worker-subscription-renewal-processor");

export interface SubscriptionRenewalJobData {
  correlationId?: string;
}

export interface SubscriptionRenewalJobResult {
  remindersSent: number;
  gracePeriodTransitions: number;
  downgradesToFree: number;
}

export async function processSubscriptionRenewalJob(
  job: Job<SubscriptionRenewalJobData>,
): Promise<SubscriptionRenewalJobResult> {
  const correlationId =
    job.data?.correlationId || CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.info(
    "[SubscriptionRenewalProcessor] Starting subscription lifecycle sweep",
    {
      correlationId,
      jobId: job.id,
    },
  );

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let remindersSent = 0;
  let gracePeriodTransitions = 0;
  let downgradesToFree = 0;

  try {
    // 1. Fetch free plan ID
    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { key: SubscriptionTierKey.FREE },
      select: { id: true },
    });

    if (!freePlan) {
      throw new Error("FREE SubscriptionPlan not found in database");
    }

    // 2. Renewal Reminders: Active paid subscriptions ending in <= 3 days
    const upcomingRenewals = await prisma.professionalSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        plan: { key: { not: SubscriptionTierKey.FREE } },
        currentPeriodEnd: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      select: {
        id: true,
        professionalId: true,
        currentPeriodEnd: true,
        plan: { select: { name: true } },
      },
    });

    for (const sub of upcomingRenewals) {
      // In production, dispatch WhatsApp / SMS notification through notification queue
      logger.info("[SubscriptionRenewalProcessor] Renewal reminder queued", {
        professionalId: sub.professionalId,
        planName: sub.plan.name,
        expiresAt: sub.currentPeriodEnd,
      });
      remindersSent++;
    }

    // 3. Grace Period Soft Landing: Active paid subscriptions whose period has expired
    const expiredActive = await prisma.professionalSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        plan: { key: { not: SubscriptionTierKey.FREE } },
        currentPeriodEnd: {
          lt: now,
        },
      },
      select: { id: true, professionalId: true },
    });

    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    for (const sub of expiredActive) {
      await prisma.professionalSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.GRACE_PERIOD,
          graceEndsAt: fiveDaysFromNow,
        },
      });
      logger.info("[SubscriptionRenewalProcessor] Moved to GRACE_PERIOD", {
        professionalId: sub.professionalId,
        graceEndsAt: fiveDaysFromNow,
      });
      gracePeriodTransitions++;
    }

    // 4. Downgrade to FREE: Subscriptions in GRACE_PERIOD whose grace period has ended
    const expiredGrace = await prisma.professionalSubscription.findMany({
      where: {
        status: SubscriptionStatus.GRACE_PERIOD,
        graceEndsAt: {
          lt: now,
        },
      },
      select: { id: true, professionalId: true },
    });

    for (const sub of expiredGrace) {
      await prisma.professionalSubscription.update({
        where: { id: sub.id },
        data: {
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: null,
          graceEndsAt: null,
        },
      });
      logger.info(
        "[SubscriptionRenewalProcessor] Auto-downgraded to FREE plan after grace expiry",
        {
          professionalId: sub.professionalId,
        },
      );
      downgradesToFree++;
    }

    logger.info(
      "[SubscriptionRenewalProcessor] Subscription lifecycle sweep completed",
      {
        remindersSent,
        gracePeriodTransitions,
        downgradesToFree,
      },
    );

    return { remindersSent, gracePeriodTransitions, downgradesToFree };
  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    logger.error(
      "[SubscriptionRenewalProcessor] Subscription lifecycle sweep failed",
      errObj,
      {
        correlationId,
      },
    );
    throw error;
  }
}
