import { connect, NatsConnection, JetStreamClient, JetStreamManager } from "nats";
import type { NatsConfig, NatsClient } from "./types";

/**
 * Default NATS configuration
 */
const defaultConfig: NatsConfig = {
  servers: process.env.NATS_URL || "localhost:4222",
  name: process.env.NATS_CLIENT_NAME || "build-market",
  reconnect: true,
  maxReconnectAttempts: -1, // Infinite reconnection attempts
  reconnectTimeWait: 2000,
  timeout: 10000,
};

/**
 * Singleton NATS client instance
 */
let natsClient: NatsClient | null = null;

/**
 * Merge user config with defaults
 */
function mergeConfig(config?: Partial<NatsConfig>): NatsConfig {
  return {
    ...defaultConfig,
    ...config,
    servers: config?.servers || defaultConfig.servers,
  };
}

/**
 * Create a new NATS connection with JetStream support
 * Uses singleton pattern - returns existing connection if available
 */
export async function createNatsClient(
  config?: Partial<NatsConfig>
): Promise<NatsClient> {
  // Return existing client if connected
  if (natsClient && natsClient.isConnected()) {
    return natsClient;
  }

  const mergedConfig = mergeConfig(config);

  console.log(`[NATS] Connecting to ${mergedConfig.servers}...`);

  try {
    // Build connection options
    const connectionOptions: Parameters<typeof connect>[0] = {
      servers: Array.isArray(mergedConfig.servers)
        ? mergedConfig.servers
        : [mergedConfig.servers],
      name: mergedConfig.name,
      reconnect: mergedConfig.reconnect,
      maxReconnectAttempts: mergedConfig.maxReconnectAttempts,
      reconnectTimeWait: mergedConfig.reconnectTimeWait,
      timeout: mergedConfig.timeout,
    };

    // Add authentication if provided
    if (mergedConfig.token) {
      connectionOptions.token = mergedConfig.token;
    }
    if (mergedConfig.user && mergedConfig.pass) {
      connectionOptions.user = mergedConfig.user;
      connectionOptions.pass = mergedConfig.pass;
    }

    // Connect to NATS
    const nc: NatsConnection = await connect(connectionOptions);

    console.log(`[NATS] Connected to ${nc.getServer()}`);

    // Get JetStream client and manager
    const js: JetStreamClient = nc.jetstream();
    const jsm: JetStreamManager = await nc.jetstreamManager();

    // Create client wrapper
    natsClient = {
      connection: nc,
      jetstream: js,
      jetstreamManager: jsm,
      close: async () => {
        console.log("[NATS] Closing connection...");
        await nc.drain();
        natsClient = null;
        console.log("[NATS] Connection closed");
      },
      isConnected: () => !nc.isClosed(),
    };

    // Handle connection events
    (async () => {
      for await (const status of nc.status()) {
        switch (status.type) {
          case "disconnect":
            console.log(`[NATS] Disconnected from ${status.data}`);
            break;
          case "reconnect":
            console.log(`[NATS] Reconnected to ${status.data}`);
            break;
          case "error":
            console.error(`[NATS] Error:`, status.data);
            break;
          case "ldm":
            console.log("[NATS] Server signaled lame duck mode");
            break;
        }
      }
    })().catch(console.error);

    return natsClient;
  } catch (error) {
    console.error("[NATS] Connection failed:", error);
    throw error;
  }
}

/**
 * Get existing NATS client or throw if not connected
 */
export function getNatsClient(): NatsClient {
  if (!natsClient || !natsClient.isConnected()) {
    throw new Error(
      "[NATS] Client not connected. Call createNatsClient() first."
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
  config?: Partial<NatsConfig>
): Promise<NatsClient> {
  return createNatsClient({
    ...config,
    name: `${serviceName}-${process.env.NODE_ENV || "development"}`,
  });
}
