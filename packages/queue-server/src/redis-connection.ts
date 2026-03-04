import { Redis } from "ioredis";

export const redisConnection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 500, 30000);
      console.log(`[Redis] Reconnecting attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  },
);

redisConnection.on("error", (err: Error) => {
  console.error("[Redis] Connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redisConnection.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

redisConnection.on("close", () => {
  console.log("[Redis] Connection closed");
});

process.on("SIGTERM", async () => {
  console.log("[Redis] Shutting down gracefully...");
  await redisConnection.quit();
});

process.on("SIGINT", async () => {
  console.log("[Redis] Received SIGINT, shutting down...");
  await redisConnection.quit();
});
