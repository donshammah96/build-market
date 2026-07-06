import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
} from "nats";
import type {
  NatsConfig,
  NatsClient,
  ConnectionMetrics,
  ConnectionStatus,
} from "./types.js";

/**
 * Singleton NATS client instance
 */
let natsClient: NatsClient | null = null;

/**
 * Connection health metrics
 */
let connectionMetrics: ConnectionMetrics = {
  reconnectAttempts: 0,
  totalDisconnects: 0,
  errors: [],
};

/**
 * Verbose logging flag
 */
let verboseLogging = false;

/**
 * Get environment-aware default configuration
 */
function getDefaultConfig(): NatsConfig {
  const env = process.env.NODE_ENV || "development";
  const isProd = env === "production";

  const config: NatsConfig = {
    servers: process.env.NATS_URL || "nats://localhost:4222",
    name: process.env.NATS_CLIENT_NAME || `build-market-${env}`,
    reconnect: true,
    maxReconnectAttempts: parseInt(
      process.env.NATS_MAX_RECONNECT_ATTEMPTS || "-1",
      10,
    ),
    reconnectTimeWait: parseInt(
      process.env.NATS_RECONNECT_TIME_WAIT || (isProd ? "2000" : "1000"),
      10,
    ),
    timeout: parseInt(
      process.env.NATS_TIMEOUT || (isProd ? "10000" : "5000"),
      10,
    ),
  };

  if (process.env.NATS_TOKEN !== undefined) {
    config.token = process.env.NATS_TOKEN;
  }
  if (process.env.NATS_USER !== undefined) {
    config.user = process.env.NATS_USER;
  }
  if (process.env.NATS_PASS !== undefined) {
    config.pass = process.env.NATS_PASS;
  }

  return config;
}

/**
 * Merge user config with environment-aware defaults
 */
function mergeConfig(config?: Partial<NatsConfig>): NatsConfig {
  const defaultConfig = getDefaultConfig();
  return {
    ...defaultConfig,
    ...config,
    servers: config?.servers || defaultConfig.servers,
  };
}

/**
 * Log helper with verbose mode support
 */
function log(
  level: "info" | "warn" | "error",
  message: string,
  data?: unknown,
) {
  const timestamp = new Date().toISOString();
  const prefix = `[NATS ${timestamp}]`;

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
        error:
          typeof data === "string"
            ? data
            : (() => {
                try {
                  return JSON.stringify(data);
                } catch {
                  return String(data);
                }
              })(),
      });
      if (connectionMetrics.errors.length > 50) {
        connectionMetrics.errors.shift();
      }
      break;
  }
}

/**
 * Create a new NATS connection with JetStream support
 * Uses singleton pattern - returns existing connection if available
 *
 * @param config - Optional configuration to override defaults
 * @param options - Additional options like verbose logging
 */
export async function createNatsClient(
  config?: Partial<NatsConfig>,
  options?: { verbose?: boolean },
): Promise<NatsClient> {
  // Return existing client if connected
  if (natsClient && natsClient.isConnected()) {
    log("info", "Reusing existing NATS connection");
    return natsClient;
  }

  // Set verbose logging
  verboseLogging = options?.verbose ?? process.env.NODE_ENV === "development";

  const mergedConfig = mergeConfig(config);

  log("info", `Connecting to ${mergedConfig.servers}...`, {
    name: mergedConfig.name,
    environment: process.env.NODE_ENV,
  });

  try {
    // Build connection options
    const connectionOptions: Parameters<typeof connect>[0] = {
      servers: Array.isArray(mergedConfig.servers)
        ? mergedConfig.servers
        : [mergedConfig.servers],
    };

    if (mergedConfig.name !== undefined) {
      connectionOptions.name = mergedConfig.name;
    }
    if (mergedConfig.reconnect !== undefined) {
      connectionOptions.reconnect = mergedConfig.reconnect;
    }
    if (mergedConfig.maxReconnectAttempts !== undefined) {
      connectionOptions.maxReconnectAttempts =
        mergedConfig.maxReconnectAttempts;
    }
    if (mergedConfig.reconnectTimeWait !== undefined) {
      connectionOptions.reconnectTimeWait = mergedConfig.reconnectTimeWait;
    }
    if (mergedConfig.timeout !== undefined) {
      connectionOptions.timeout = mergedConfig.timeout;
    }

    // Add authentication if provided
    if (mergedConfig.token) {
      connectionOptions.token = mergedConfig.token;
      log("info", "Using token authentication");
    }
    if (mergedConfig.user && mergedConfig.pass) {
      connectionOptions.user = mergedConfig.user;
      connectionOptions.pass = mergedConfig.pass;
      log("info", "Using user/password authentication");
    }

    // Connect to NATS
    const nc: NatsConnection = await connect(connectionOptions);

    connectionMetrics.connectedAt = new Date();
    log("info", `Connected to ${nc.getServer()}`);

    // Get JetStream client and manager
    const js: JetStreamClient = nc.jetstream();
    const jsm: JetStreamManager = await nc.jetstreamManager();

    // Create client wrapper with enhanced methods
    natsClient = {
      connection: nc,
      jetstream: js,
      jetstreamManager: jsm,
      close: async () => {
        log("info", "Closing connection...");
        try {
          await nc.drain();
          natsClient = null;
          log("info", "Connection closed gracefully");
        } catch (error) {
          log("error", "Error during connection close", error);
          throw error;
        }
      },
      isConnected: () => !nc.isClosed(),
      getStatus: () => getConnectionStatus(),
      getMetrics: () => ({ ...connectionMetrics }),
    };

    // Handle connection events
    (async () => {
      for await (const status of nc.status()) {
        switch (status.type) {
          case "disconnect":
            connectionMetrics.lastDisconnectAt = new Date();
            connectionMetrics.totalDisconnects++;
            log("warn", `Disconnected from ${status.data}`);
            break;

          case "reconnect":
            connectionMetrics.reconnectAttempts++;
            connectionMetrics.lastReconnectAt = new Date();
            log("info", `Reconnected to ${status.data}`, {
              attempts: connectionMetrics.reconnectAttempts,
            });
            break;

          case "error":
            log("error", "Connection error", status.data);
            break;

          case "ldm":
            log(
              "warn",
              "Server signaled lame duck mode - preparing for shutdown",
            );
            break;

          case "reconnecting":
            log("info", "Attempting to reconnect...");
            break;
        }
      }
    })().catch((error) => {
      log("error", "Error in status handler", error);
    });

    // Register graceful shutdown handlers
    registerShutdownHandlers();

    return natsClient;
  } catch (error) {
    log("error", "Connection failed", error);
    throw error;
  }
}

/**
 * Get existing NATS client or throw if not connected
 */
export function getNatsClient(): NatsClient {
  if (!natsClient || !natsClient.isConnected()) {
    throw new Error(
      "[NATS] Client not connected. Call createNatsClient() first.",
    );
  }
  return natsClient;
}

/**
 * Check if NATS client is connected
 */
export function isNatsConnected(): boolean {
  return natsClient !== null && natsClient.isConnected();
}

/**
 * Get detailed connection status and health metrics
 */
export function getConnectionStatus(): ConnectionStatus {
  const defaultConfig = getDefaultConfig();

  const status: ConnectionStatus = {
    connected: isNatsConnected(),
    metrics: { ...connectionMetrics },
    config: {
      servers: defaultConfig.servers,
      name: defaultConfig.name || "build-market",
      environment: process.env.NODE_ENV || "development",
    },
  };

  const server = natsClient?.connection.getServer();
  if (server !== undefined) {
    status.server = server;
  }

  return status;
}

/**
 * Reset connection metrics (useful for testing)
 */
export function resetMetrics(): void {
  connectionMetrics = {
    reconnectAttempts: 0,
    totalDisconnects: 0,
    errors: [],
  };
}

/**
 * Close NATS connection gracefully
 */
export async function closeNatsConnection(): Promise<void> {
  if (natsClient) {
    await natsClient.close();
  }
}

/**
 * Create a scoped NATS client for a specific service
 * Useful for identifying which service is publishing/consuming
 */
export async function createServiceClient(
  serviceName: string,
  config?: Partial<NatsConfig>,
  options?: { verbose?: boolean },
): Promise<NatsClient> {
  return createNatsClient(
    {
      ...config,
      name: `${serviceName}-${process.env.NODE_ENV || "development"}`,
    },
    options,
  );
}

/**
 * Register graceful shutdown handlers for process termination
 * Ensures NATS connections are properly drained before exit
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
      await closeNatsConnection();
      log("info", "NATS connection closed successfully");
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
    await closeNatsConnection();
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason) => {
    log("error", "Unhandled rejection", reason);
    await closeNatsConnection();
    process.exit(1);
  });

  log("info", "Graceful shutdown handlers registered");
}
