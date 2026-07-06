import { StringCodec, headers, PubAck } from "nats";
import { propagation, context } from "@opentelemetry/api";
import { getNatsClient, createNatsClient } from "./client.js";
import type { NatsClient, NatsConfig, PublishOptions } from "./types.js";

const sc = StringCodec();

function buildHeaders(customHeaders?: Record<string, string>) {
  const h = headers();
  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      h.append(key, value);
    }
  }
  try {
    propagation.inject(context.active(), h, {
      set: (carrier, key, value) => {
        carrier.set(key, value);
      },
    });
  } catch {
    // OTel not initialized or context injection failed
  }
  return h;
}

/**
 * JetStream Producer for publishing messages
 */
export class JetStreamProducer {
  private client: NatsClient | null = null;
  private serviceName: string;
  private config?: Partial<NatsConfig> | undefined;

  constructor(serviceName: string, config?: Partial<NatsConfig>) {
    this.serviceName = serviceName;
    this.config = config;
  }

  /**
   * Connect to NATS and initialize the producer
   */
  async connect(): Promise<void> {
    this.client = await createNatsClient({
      ...this.config,
      name: `${this.serviceName}-producer`,
    });
    console.log(`[NATS Producer] ${this.serviceName} connected`);
  }

  /**
   * Publish a message to a subject with JetStream acknowledgment
   */
  async publish<T extends object>(
    subject: string,
    message: T,
    options?: PublishOptions,
  ): Promise<PubAck> {
    if (!this.client) {
      throw new Error("[NATS Producer] Not connected. Call connect() first.");
    }

    const js = this.client.jetstream;
    const payload = sc.encode(JSON.stringify(message));

    // Build publish options
    const pubOpts: Parameters<typeof js.publish>[2] = {};

    if (options?.msgId) {
      pubOpts.msgID = options.msgId;
    }

    if (options?.timeout) {
      pubOpts.timeout = options.timeout;
    }

    if (options?.expect) {
      pubOpts.expect = {};
      if (options.expect.lastMsgId !== undefined) {
        pubOpts.expect.lastMsgID = options.expect.lastMsgId;
      }
      if (options.expect.lastSequence !== undefined) {
        pubOpts.expect.lastSequence = options.expect.lastSequence;
      }
      if (options.expect.streamName !== undefined) {
        pubOpts.expect.streamName = options.expect.streamName;
      }
    }

    pubOpts.headers = buildHeaders(options?.headers);

    try {
      const ack = await js.publish(subject, payload, pubOpts);
      console.log(
        `[NATS Producer] Published to ${subject}, seq: ${ack.seq}, stream: ${ack.stream}`,
      );
      return ack;
    } catch (error) {
      console.error(`[NATS Producer] Failed to publish to ${subject}:`, error);
      throw error;
    }
  }

  /**
   * Publish without waiting for JetStream acknowledgment (fire-and-forget)
   * Uses core NATS publish - faster but no delivery guarantee
   */
  async publishFast<T extends object>(
    subject: string,
    message: T,
  ): Promise<void> {
    if (!this.client) {
      throw new Error("[NATS Producer] Not connected. Call connect() first.");
    }

    const payload = sc.encode(JSON.stringify(message));
    this.client.connection.publish(subject, payload);
    console.log(`[NATS Producer] Published (fast) to ${subject}`);
  }

  /**
   * Publish with automatic retry on failure
   */
  async publishWithRetry<T extends object>(
    subject: string,
    message: T,
    options?: PublishOptions & { maxRetries?: number; retryDelayMs?: number },
  ): Promise<PubAck> {
    const maxRetries = options?.maxRetries ?? 3;
    const retryDelayMs = options?.retryDelayMs ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.publish(subject, message, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[NATS Producer] Publish attempt ${attempt + 1}/${maxRetries} failed:`,
          error,
        );
        if (attempt < maxRetries - 1) {
          // Exponential back-off with randomized jitter
          const delay =
            retryDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Disconnect from NATS
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      console.log(`[NATS Producer] ${this.serviceName} disconnecting...`);
      // Don't close shared connection, just release reference
      this.client = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.isConnected();
  }
}

/**
 * Create a producer instance
 */
export function createProducer(
  serviceName: string,
  config?: Partial<NatsConfig>,
): JetStreamProducer {
  return new JetStreamProducer(serviceName, config);
}

/**
 * Convenience function for one-off publishes using existing connection
 */
export async function publishMessage<T extends object>(
  subject: string,
  message: T,
  options?: PublishOptions,
): Promise<PubAck> {
  const client = getNatsClient();
  const payload = sc.encode(JSON.stringify(message));

  const pubOpts: Parameters<typeof client.jetstream.publish>[2] = {};
  if (options?.msgId) pubOpts.msgID = options.msgId;
  if (options?.timeout) pubOpts.timeout = options.timeout;
  pubOpts.headers = buildHeaders(options?.headers);

  return client.jetstream.publish(subject, payload, pubOpts);
}
