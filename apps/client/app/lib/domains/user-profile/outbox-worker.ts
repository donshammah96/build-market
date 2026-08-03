import "server-only";

import { prisma } from "@build/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { updateClerkOnboardingMetadata } from "./clerk-metadata";
import { recordClerkSyncLag } from "@/app/lib/auth/telemetry-metrics";

export const ClerkOnboardingOutboxPayloadSchema = z.object({
  clerkId: z.string(),
  role: z.string(),
  isOnboarded: z.literal(true),
  status: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ClerkOnboardingOutboxPayload = z.infer<
  typeof ClerkOnboardingOutboxPayloadSchema
>;

const MAX_OUTBOX_ATTEMPTS = 5;
const BASE_RETRY_INTERVAL_MS = 5000;

type TransactionOrPrismaClient = Prisma.TransactionClient | typeof prisma;

export async function enqueueClerkMetadataSyncEvent(
  params: {
    userId: string;
    clerkId: string;
    role: string;
    status?: string;
    correlationId?: string;
  },
  client: TransactionOrPrismaClient = prisma,
): Promise<{ id: string }> {
  const event = await client.authOutboxEvent.create({
    data: {
      aggregateType: "User",
      aggregateId: params.userId,
      eventType: "CLERK_ONBOARDING_METADATA_SYNC_REQUESTED",
      payload: {
        clerkId: params.clerkId,
        role: params.role,
        isOnboarded: true,
        status: params.status,
        correlationId: params.correlationId,
      },
      status: "PENDING",
    },
    select: { id: true },
  });

  return event;
}

export async function processPendingAuthOutboxEvents(options?: {
  batchSize?: number;
  client?: typeof prisma;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const db = options?.client ?? prisma;
  const batchSize = options?.batchSize ?? 10;

  const pendingEvents = await db.authOutboxEvent.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let succeeded = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    const parseResult = ClerkOnboardingOutboxPayloadSchema.safeParse(
      event.payload,
    );

    if (!parseResult.success) {
      await db.authOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          attempts: event.attempts + 1,
        },
      });
      failed++;
      continue;
    }

    const payload = parseResult.data;

    try {
      await updateClerkOnboardingMetadata(
        payload.clerkId,
        {
          role: payload.role,
          isOnboarded: true,
          status: payload.status,
        },
        {
          correlationId: payload.correlationId,
          operation: "auth_outbox_clerk_metadata_sync",
        },
      );

      const syncLagMs = Math.max(0, Date.now() - event.createdAt.getTime());
      recordClerkSyncLag(syncLagMs);

      await db.authOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "COMPLETED",
          attempts: event.attempts + 1,
        },
      });
      succeeded++;
    } catch (error) {
      const nextAttempts = event.attempts + 1;
      const isMaxReached = nextAttempts >= MAX_OUTBOX_ATTEMPTS;

      const backoffMs = Math.pow(2, nextAttempts) * BASE_RETRY_INTERVAL_MS;
      const nextAttemptAt = new Date(Date.now() + backoffMs);

      await db.authOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: isMaxReached ? "FAILED" : "PENDING",
          attempts: nextAttempts,
          nextAttemptAt: isMaxReached ? event.nextAttemptAt : nextAttemptAt,
        },
      });

      console.error(
        `Auth outbox sync failed for event ${event.id} (attempt ${nextAttempts}/${MAX_OUTBOX_ATTEMPTS})`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      failed++;
    }
  }

  return {
    processed: pendingEvents.length,
    succeeded,
    failed,
  };
}
