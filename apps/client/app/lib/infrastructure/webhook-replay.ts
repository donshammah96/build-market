import { getRedisClient } from "@build/redis";
import { env } from "@/app/lib/infrastructure/env";

type ReplayClaimResult =
  | { status: "accepted"; deliveryId: string }
  | { status: "duplicate"; deliveryId: string };

function getReplayKeys(deliveryId: string) {
  return {
    processing: `clerk-webhook:processing:${deliveryId}`,
    processed: `clerk-webhook:processed:${deliveryId}`,
  };
}

/**
 * Returns the Upstash REST client for webhook replay protection.
 *
 * Uses @upstash/redis via @build/redis — the REST client is serverless-safe
 * and requires no persistent TCP connection. Startup validation in env.ts
 * guarantees UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are present
 * in production before this is called.
 *
 * NOTE: Upstash REST uses an options-object API for SET, not positional args:
 *   client.set(key, value, { ex: seconds, nx: true })
 * This differs from the ioredis positional API ("EX", n, "NX").
 */
function getReplayClient() {
  return getRedisClient();
}

export function isWebhookTimestampFresh(
  timestampHeader: string | null,
  maxAgeSeconds: number,
): boolean {
  if (!timestampHeader) {
    return false;
  }

  const timestampSeconds = Number.parseInt(timestampHeader, 10);
  if (Number.isNaN(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= maxAgeSeconds;
}

export async function claimClerkWebhookDelivery(
  deliveryId: string,
): Promise<ReplayClaimResult> {
  const client = getReplayClient();
  const keys = getReplayKeys(deliveryId);

  if ((await client.exists(keys.processed)) > 0) {
    return { status: "duplicate", deliveryId };
  }

  // Upstash REST API: options object, not positional flags
  const claimed = await client.set(keys.processing, "processing", {
    ex: env.clerk.processingTtlSeconds,
    nx: true,
  });

  if (claimed !== "OK") {
    return { status: "duplicate", deliveryId };
  }

  return { status: "accepted", deliveryId };
}

export async function markClerkWebhookDeliveryProcessed(
  deliveryId: string,
): Promise<void> {
  const client = getReplayClient();
  const keys = getReplayKeys(deliveryId);

  // Upstash REST API: options object
  await client.set(keys.processed, "processed", {
    ex: env.clerk.processedTtlSeconds,
  });
  await client.del(keys.processing);
}

export async function releaseClerkWebhookDelivery(
  deliveryId: string,
): Promise<void> {
  const client = getReplayClient();
  const keys = getReplayKeys(deliveryId);
  await client.del(keys.processing);
}
