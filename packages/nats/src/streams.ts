import {
  StreamConfig,
  RetentionPolicy,
  StorageType,
  DiscardPolicy,
  StreamInfo,
} from "nats";
import { createNatsClient } from "./client";
import type { NatsConfig, StreamOptions } from "./types";

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "404" ||
    maybeError.message?.includes("not found") === true
  );
}

/**
 * Stream management utilities for JetStream
 */
export class StreamManager {
  private config?: Partial<NatsConfig> | undefined;

  constructor(config?: Partial<NatsConfig>) {
    this.config = config;
  }

  /**
   * Ensure connected and return JetStream manager
   */
  private async getJsm() {
    const client = await createNatsClient(this.config);
    return client.jetstreamManager;
  }

  /**
   * Create or update a stream
   */
  async ensureStream(options: StreamOptions): Promise<StreamInfo> {
    const jsm = await this.getJsm();

    const streamConfig: Partial<StreamConfig> = {
      name: options.name,
      subjects: options.subjects,
      retention: this.mapRetention(options.retention || "limits"),
      storage: this.mapStorage(options.storage || "file"),
      max_msgs: options.maxMsgs ?? -1,
      max_bytes: options.maxBytes ?? -1,
      max_age: options.maxAge ?? 0,
      num_replicas: options.replicas ?? 1,
      discard: this.mapDiscard(options.discard || "old"),
      duplicate_window: options.duplicateWindow ?? 120000000000, // 2 minutes
    };

    try {
      // Try to get existing stream
      await jsm.streams.info(options.name);
      console.log(
        `[NATS Streams] Stream ${options.name} already exists, updating...`,
      );

      // Update stream config
      await jsm.streams.update(options.name, streamConfig);
      return await jsm.streams.info(options.name);
    } catch (error) {
      // Stream doesn't exist, create it
      if (isNotFoundError(error)) {
        console.log(`[NATS Streams] Creating stream ${options.name}...`);
        return await jsm.streams.add(streamConfig);
      }
      throw error;
    }
  }

  /**
   * Delete a stream
   */
  async deleteStream(name: string): Promise<boolean> {
    const jsm = await this.getJsm();
    try {
      await jsm.streams.delete(name);
      console.log(`[NATS Streams] Deleted stream ${name}`);
      return true;
    } catch (error) {
      console.error(`[NATS Streams] Failed to delete stream ${name}:`, error);
      return false;
    }
  }

  /**
   * Get stream info
   */
  async getStream(name: string): Promise<StreamInfo | null> {
    const jsm = await this.getJsm();
    try {
      return await jsm.streams.info(name);
    } catch {
      return null;
    }
  }

  /**
   * List all streams
   */
  async listStreams(): Promise<StreamInfo[]> {
    const jsm = await this.getJsm();
    const streams: StreamInfo[] = [];

    const list = await jsm.streams.list().next();
    for (const stream of list) {
      streams.push(stream);
    }

    return streams;
  }

  /**
   * Purge all messages from a stream
   */
  async purgeStream(name: string): Promise<boolean> {
    const jsm = await this.getJsm();
    try {
      await jsm.streams.purge(name);
      console.log(`[NATS Streams] Purged stream ${name}`);
      return true;
    } catch (error) {
      console.error(`[NATS Streams] Failed to purge stream ${name}:`, error);
      return false;
    }
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(name: string): Promise<{
    messages: number;
    bytes: number;
    firstSeq: number;
    lastSeq: number;
    consumerCount: number;
  } | null> {
    const stream = await this.getStream(name);
    if (!stream) return null;

    return {
      messages: stream.state.messages,
      bytes: stream.state.bytes,
      firstSeq: stream.state.first_seq,
      lastSeq: stream.state.last_seq,
      consumerCount: stream.state.consumer_count,
    };
  }

  /**
   * Map retention policy string to enum
   */
  private mapRetention(retention: string): RetentionPolicy {
    switch (retention) {
      case "interest":
        return RetentionPolicy.Interest;
      case "workqueue":
        return RetentionPolicy.Workqueue;
      default:
        return RetentionPolicy.Limits;
    }
  }

  /**
   * Map storage type string to enum
   */
  private mapStorage(storage: string): StorageType {
    switch (storage) {
      case "memory":
        return StorageType.Memory;
      default:
        return StorageType.File;
    }
  }

  /**
   * Map discard policy string to enum
   */
  private mapDiscard(discard: string): DiscardPolicy {
    switch (discard) {
      case "new":
        return DiscardPolicy.New;
      default:
        return DiscardPolicy.Old;
    }
  }
}

/**
 * Create a stream manager instance
 */
export function createStreamManager(
  config?: Partial<NatsConfig>,
): StreamManager {
  return new StreamManager(config);
}

/**
 * Initialize all predefined streams for Build Market
 */
export async function initializeStreams(
  config?: Partial<NatsConfig>,
): Promise<void> {
  const manager = createStreamManager(config);

  const streams: StreamOptions[] = [
    {
      name: "VERIFICATION",
      subjects: ["verification.>"],
      retention: "limits",
      storage: "file",
      maxAge: 7 * 24 * 60 * 60 * 1000000000, // 7 days
    },
    {
      name: "USERS",
      subjects: ["user.>"],
      retention: "limits",
      storage: "file",
      maxAge: 30 * 24 * 60 * 60 * 1000000000, // 30 days
    },
    {
      name: "ORDERS",
      subjects: ["order.>"],
      retention: "limits",
      storage: "file",
      maxAge: 90 * 24 * 60 * 60 * 1000000000, // 90 days
    },
    {
      name: "PROJECTS",
      subjects: ["project.>"],
      retention: "limits",
      storage: "file",
      maxAge: 90 * 24 * 60 * 60 * 1000000000, // 90 days
    },
    {
      name: "NOTIFICATIONS",
      subjects: ["notification.>"],
      retention: "workqueue",
      storage: "file",
      maxAge: 24 * 60 * 60 * 1000000000, // 24 hours
    },
    {
      name: "LICENSES",
      subjects: ["license.>"],
      retention: "limits",
      storage: "file",
      maxAge: 30 * 24 * 60 * 60 * 1000000000, // 30 days
      duplicateWindow: 120000000000,
    },
  ];

  console.log("[NATS Streams] Initializing streams...");

  for (const stream of streams) {
    try {
      await manager.ensureStream(stream);
      console.log(`[NATS Streams] Stream ${stream.name} ready`);
    } catch (error) {
      console.error(
        `[NATS Streams] Failed to create stream ${stream.name}:`,
        error,
      );
    }
  }

  console.log("[NATS Streams] All streams initialized");
}
