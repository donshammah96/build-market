import { createRedisClient, getRedisClient } from "@build/redis";
import { getEnvConfig } from "@/app/lib/infrastructure/env";

type ReplayClaimResult =
  | { status: "accepted"; deliveryId: string }
  | { status: "duplicate"; deliveryId: string };

function getReplayKeys(deliveryId: string) {
  return {
    processing: `clerk-webhook:processing:${deliveryId}`,
    processed: `clerk-webhook:processed:${deliveryId}`,
  };
}

async function getReplayClient() {
  const env = getEnvConfig();

  if (env.isProd) {
    if (!env.redis.enabled) {
      throw new Error(
        "Webhook replay protection requires Redis in production.",
      );
    }

    return createRedisClient();
  }

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
  const env = getEnvConfig();
  const client = await getReplayClient();
  const keys = getReplayKeys(deliveryId);

  if ((await client.exists(keys.processed)) > 0) {
    return { status: "duplicate", deliveryId };
  }

  const claimed = await client.set(
    keys.processing,
    "processing",
    "EX",
    env.clerk.processingTtlSeconds,
    "NX",
  );

  if (claimed !== "OK") {
    return { status: "duplicate", deliveryId };
  }

  return { status: "accepted", deliveryId };
}

export async function markClerkWebhookDeliveryProcessed(
  deliveryId: string,
): Promise<void> {
  const env = getEnvConfig();
  const client = await getReplayClient();
  const keys = getReplayKeys(deliveryId);

  await client.set(keys.processed, "processed", "EX", env.clerk.processedTtlSeconds);
  await client.del(keys.processing);
}

export async function releaseClerkWebhookDelivery(
  deliveryId: string,
): Promise<void> {
  const client = await getReplayClient();
  const keys = getReplayKeys(deliveryId);
  await client.del(keys.processing);
}
