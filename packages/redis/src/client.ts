import Redis, { type Redis as RedisClient } from "ioredis";
import type { RedisConfig } from "./types";

let client: RedisClient | null = null;

const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || undefined,
  tls: process.env.REDIS_TLS === "true",
  maxRetriesPerRequest: parseInt(
    process.env.REDIS_MAX_RETRIES_PER_REQUEST || "5",
    10
  ),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || "10000", 10),
};

/**
 * Get or create the Redis client singleton
 */
export function getRedisClient(config?: Partial<RedisConfig>): RedisClient {
  if (!client) {
    const finalConfig = { ...defaultConfig, ...config };

    client = new Redis({
      host: finalConfig.host,
      port: finalConfig.port,
      password: finalConfig.password,
      db: finalConfig.db,
      maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
      connectTimeout: finalConfig.connectTimeout,
      lazyConnect: true,
      enableReadyCheck: true,
      keyPrefix: finalConfig.keyPrefix,
      tls: finalConfig.tls ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error(`Failed to connect to Redis after ${times} attempts`);
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000); // Exponential backoff with max 2s
      },
    });
    client.on("connect", () => {
      console.log(
        `[Redis] connected to ${finalConfig.host}:${finalConfig.port}`
      );
    });
    client.on("error", (error) => {
      console.error(`[Redis] connection error: ${error.message}`);
      client = null;
    });
    client.on("ready", () => {
      console.log(`[Redis] ready`);
    });
    client.on("reconnecting", () => {
      console.log(`[Redis] reconnecting...`);
    });
    client.on("end", () => {
      console.log(`[Redis] disconnected`);
    });
    client.on("close", () => {
      console.log(`[Redis] closed`);
    });
  }
  return client;
}

/**
 * Disconnect and cleanup  the Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    console.log(`[Redis] disconnected and cleaned up`);
  }
}

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const redisClient = getRedisClient();
    const pong = await redisClient.ping();
    return pong === "PONG";
  } catch (error) {
    console.error(`[Redis] health check failed: ${error}`);
    return false;
  } finally {
    await disconnectRedis();
  }
}

export type { RedisClient };
