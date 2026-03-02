import Redis, { type Redis as RedisClient } from "ioredis";
import type { RedisConfig } from "./types";

/**
 * Connection health metrics
 */
interface ConnectionMetrics {
  reconnectAttempts: number;
  lastReconnectAt?: Date;
  lastErrorAt?: Date;
  totalErrors: number;
  connectedAt?: Date;
  commandsExecuted: number;
  errors: Array<{ timestamp: Date; error: string }>;
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  connected: boolean;
  ready: boolean;
  host: string;
  port: number;
  db: number;
  metrics: ConnectionMetrics;
  config: {
    keyPrefix?: string;
    tls: boolean;
    environment: string;
  };
}

/**
 * Singleton Redis client instance
 */
let client: RedisClient | null = null;

/**
 * Connection health metrics
 */
let connectionMetrics: ConnectionMetrics = {
  reconnectAttempts: 0,
  totalErrors: 0,
  commandsExecuted: 0,
  errors: [],
};

/**
 * Verbose logging flag
 */
let verboseLogging = false;

/**
 * Track if client is ready
 */
let isClientReady = false;

/**
 * If Redis is disabled via env, provide a no-op in-memory client to avoid
 * attempting network connections during builds or in environments without Redis.
 */
function createNoopClient(): RedisClient {
  const noop = {
    status: "ready",
    get: async (_: string) => null,
    set: async (_: string, __: string) => "OK",
    setex: async (_: string, __: number, ___: string) => "OK",
    del: async (..._: any[]) => 0,
    keys: async (_: string) => [] as string[],
    exists: async (_: string) => 0,
    ttl: async (_: string) => -2,
    ping: async () => "PONG",
    connect: async () => {},
    disconnect: () => {},
    quit: async () => {},
    on: (_: string, __: any) => noop,
    off: (_: string, __: any) => noop,
    sendCommand: function (..._args: any[]) {
      return Promise.resolve();
    },
  } as unknown as RedisClient;

  return noop;
}

/**
 * Get environment-aware default configuration
 */
function getDefaultConfig(): RedisConfig {
  const env = process.env.NODE_ENV || "development";
  const isDev = env === "development";
  const isProd = env === "production";

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || undefined,
    tls: process.env.REDIS_TLS === "true",
    maxRetriesPerRequest: parseInt(
      process.env.REDIS_MAX_RETRIES_PER_REQUEST || "5",
      10,
    ),
    connectTimeout: parseInt(
      process.env.REDIS_CONNECT_TIMEOUT || (isProd ? "10000" : "5000"),
      10,
    ),
  };
}

/**
 * Log helper with verbose mode support
 */
function log(level: "info" | "warn" | "error", message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = `[Redis ${timestamp}]`;

  switch (level) {
    case "info":
      if (verboseLogging) {
        console.log(prefix, message, data || "");
      }
      break;
    case "warn":
      console.warn(prefix, message, data || "");
      break;
    case "error":
      console.error(prefix, message, data || "");
      // Track errors in metrics (keep last 50)
      connectionMetrics.errors.push({
        timestamp: new Date(),
        error: typeof data === "string" ? data : JSON.stringify(data),
      });
      if (connectionMetrics.errors.length > 50) {
        connectionMetrics.errors.shift();
      }
      break;
  }
}

/**
 * Get or create the Redis client singleton
 *
 * @param config - Optional configuration to override defaults
 * @param options - Additional options like verbose logging
 */
export function getRedisClient(
  config?: Partial<RedisConfig>,
  options?: { verbose?: boolean; autoConnect?: boolean },
): RedisClient {
  if (client) {
    log("info", "Reusing existing Redis connection");
    return client;
  }

  // If Redis is disabled via environment, return a noop client to avoid
  // attempting to open network connections (useful during builds/tests).
  const redisEnabled =
    process.env.CACHE_REDIS_ENABLED === "true" ||
    process.env.REDIS_ENABLED === "true";

  if (!redisEnabled) {
    log("info", "Redis disabled by env; returning noop client");
    client = createNoopClient();
    isClientReady = false;
    return client;
  }

  // Set verbose logging
  verboseLogging = options?.verbose ?? process.env.NODE_ENV === "development";
  const autoConnect = options?.autoConnect ?? false;

  const defaultConfig = getDefaultConfig();
  const finalConfig = { ...defaultConfig, ...config };

  log(
    "info",
    `Creating Redis client for ${finalConfig.host}:${finalConfig.port}`,
    {
      db: finalConfig.db,
      environment: process.env.NODE_ENV,
    },
  );

  const maxRetries = process.env.NODE_ENV === "production" ? 10 : 5;
  const retryDelay = process.env.NODE_ENV === "production" ? 2000 : 1000;

  client = new Redis({
    host: finalConfig.host,
    port: finalConfig.port,
    password: finalConfig.password,
    db: finalConfig.db,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    connectTimeout: finalConfig.connectTimeout,
    lazyConnect: !autoConnect,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    keyPrefix: finalConfig.keyPrefix,
    tls: finalConfig.tls ? {} : undefined,
    retryStrategy: (times) => {
      if (times > maxRetries) {
        log(
          "error",
          `Failed to connect to Redis after ${times} attempts. Giving up.`,
        );
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, retryDelay);
      log("warn", `Retry attempt ${times} in ${delay}ms`);
      return delay;
    },
  });

  // Connection event handlers
  client.on("connect", () => {
    log("info", `Connected to ${finalConfig.host}:${finalConfig.port}`);
  });

  client.on("ready", () => {
    isClientReady = true;
    connectionMetrics.connectedAt = new Date();
    log("info", "Redis client ready");
  });

  client.on("error", (error) => {
    connectionMetrics.lastErrorAt = new Date();
    connectionMetrics.totalErrors++;
    log("error", `Connection error: ${error.message}`, error);
  });

  client.on("close", () => {
    isClientReady = false;
    log("warn", "Connection closed");
  });

  client.on("reconnecting", (delay: number) => {
    connectionMetrics.reconnectAttempts++;
    connectionMetrics.lastReconnectAt = new Date();
    log("info", `Reconnecting in ${delay}ms...`, {
      attempts: connectionMetrics.reconnectAttempts,
    });
  });

  client.on("end", () => {
    isClientReady = false;
    log("info", "Connection ended");
  });

  // Track commands executed
  const originalSendCommand = client.sendCommand;
  client.sendCommand = function (...args) {
    connectionMetrics.commandsExecuted++;
    return originalSendCommand.apply(this, args);
  };

  // Register graceful shutdown handlers
  registerShutdownHandlers();

  return client;
}

/**
 * Create a Redis client with auto-connect
 * Useful when you need to ensure connection before operations
 */
export async function createRedisClient(
  config?: Partial<RedisConfig>,
  options?: { verbose?: boolean },
): Promise<RedisClient> {
  const redisClient = getRedisClient(config, {
    ...options,
    autoConnect: false,
  });

  try {
    await redisClient.connect();
    log("info", "Redis client connected and ready");
    return redisClient;
  } catch (error) {
    log("error", "Failed to connect Redis client", error);
    throw error;
  }
}

/**
 * Check if Redis client exists and is connected
 */
export function isRedisConnected(): boolean {
  return client !== null && client.status === "ready";
}

/**
 * Check if Redis client is ready to accept commands
 */
export function isRedisReady(): boolean {
  return isClientReady && client !== null && client.status === "ready";
}

/**
 * Get detailed connection status and health metrics
 */
export function getConnectionStatus(): ConnectionStatus {
  const defaultConfig = getDefaultConfig();

  return {
    connected: isRedisConnected(),
    ready: isRedisReady(),
    host: defaultConfig.host,
    port: defaultConfig.port,
    db: defaultConfig.db || 0,
    metrics: { ...connectionMetrics },
    config: {
      keyPrefix: defaultConfig.keyPrefix,
      tls: defaultConfig.tls || false,
      environment: process.env.NODE_ENV || "development",
    },
  };
}

/**
 * Get connection health metrics
 */
export function getMetrics(): ConnectionMetrics {
  return { ...connectionMetrics };
}

/**
 * Reset connection metrics (useful for testing)
 */
export function resetMetrics(): void {
  connectionMetrics = {
    reconnectAttempts: 0,
    totalErrors: 0,
    commandsExecuted: 0,
    errors: [],
  };
}

/**
 * Disconnect and cleanup the Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    log("info", "Disconnecting Redis client...");
    try {
      await client.quit();
      client = null;
      isClientReady = false;
      log("info", "Redis disconnected and cleaned up");
    } catch (error) {
      log("error", "Error during disconnect", error);
      // Force disconnect
      if (client) {
        client.disconnect();
      }
      client = null;
      isClientReady = false;
    }
  }
}

/**
 * Check if Redis is connected and healthy
 * Performs a PING command to verify connectivity
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!client || !isRedisConnected()) {
      log("warn", "Health check failed: client not connected");
      return false;
    }

    const pong = await client.ping();
    const healthy = pong === "PONG";

    if (healthy) {
      log("info", "Health check passed");
    } else {
      log("warn", `Health check failed: unexpected response '${pong}'`);
    }

    return healthy;
  } catch (error) {
    log("error", "Health check failed with exception", error);
    return false;
  }
}

/**
 * Get Redis server info
 * Returns parsed server information
 */
export async function getServerInfo(): Promise<Record<string, string>> {
  try {
    if (!client || !isRedisConnected()) {
      throw new Error("Redis client not connected");
    }

    const info = await client.info();
    const parsed: Record<string, string> = {};

    info.split("\r\n").forEach((line) => {
      if (line && !line.startsWith("#")) {
        const [key, value] = line.split(":");
        if (key && value) {
          parsed[key] = value;
        }
      }
    });

    return parsed;
  } catch (error) {
    log("error", "Failed to get server info", error);
    throw error;
  }
}

/**
 * Register graceful shutdown handlers for process termination
 * Ensures Redis connections are properly closed before exit
 */
let shutdownHandlersRegistered = false;

function registerShutdownHandlers(): void {
  if (shutdownHandlersRegistered || typeof process === "undefined") {
    return;
  }

  shutdownHandlersRegistered = true;

  const gracefulShutdown = async (signal: string) => {
    log("info", `Received ${signal}, initiating graceful shutdown...`);
    try {
      await disconnectRedis();
      log("info", "Redis connection closed successfully");
      process.exit(0);
    } catch (error) {
      log("error", "Error during graceful shutdown", error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", async (error) => {
    log("error", "Uncaught exception", error);
    await disconnectRedis();
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason) => {
    log("error", "Unhandled rejection", reason);
    await disconnectRedis();
    process.exit(1);
  });

  log("info", "Graceful shutdown handlers registered");
}

export type { RedisClient };
