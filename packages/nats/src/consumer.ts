import {
  StringCodec,
  JsMsg,
  ConsumerConfig,
  DeliverPolicy,
  AckPolicy,
  ReplayPolicy,
  Consumer,
} from "nats";
import { createNatsClient } from "./client";
import type {
  NatsClient,
  NatsConfig,
  TopicConfig,
  MessagePayload,
} from "./types";

const sc = StringCodec();

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "408" || maybeError.message === "TIMEOUT";
}

/**
 * JetStream Consumer for subscribing to messages
 */
export class JetStreamConsumer {
  private client: NatsClient | null = null;
  private serviceName: string;
  private groupName: string;
  private config?: Partial<NatsConfig>;
  private consumers: Consumer[] = [];
  private running: boolean = false;

  constructor(
    serviceName: string,
    groupName: string,
    config?: Partial<NatsConfig>,
  ) {
    this.serviceName = serviceName;
    this.groupName = groupName;
    this.config = config;
  }

  /**
   * Connect to NATS and initialize the consumer
   */
  async connect(): Promise<void> {
    this.client = await createNatsClient({
      ...this.config,
      name: `${this.serviceName}-consumer`,
    });
    console.log(`[NATS Consumer] ${this.serviceName} connected`);
  }

  /**
   * Subscribe to multiple topics with handlers
   */
  async subscribe(topics: TopicConfig[]): Promise<void> {
    if (!this.client) {
      throw new Error("[NATS Consumer] Not connected. Call connect() first.");
    }

    this.running = true;
    const js = this.client.jetstream;
    const jsm = this.client.jetstreamManager;

    for (const topic of topics) {
      try {
        // Build consumer config
        const consumerConfig = this.buildConsumerConfig(topic);

        // Get stream name from subject
        const streamName = await this.getStreamForSubject(topic.subject);
        if (!streamName) {
          console.error(
            `[NATS Consumer] No stream found for subject: ${topic.subject}`,
          );
          continue;
        }

        // Create or update durable consumer
        await jsm.consumers.add(streamName, consumerConfig);

        // Get consumer reference for pulling messages
        const consumer = await js.consumers.get(
          streamName,
          consumerConfig.durable_name!,
        );
        this.consumers.push(consumer);

        // Start consuming messages
        this.consumeMessages(consumer, topic.handler, topic.subject);

        console.log(
          `[NATS Consumer] Subscribed to ${topic.subject} on stream ${streamName}`,
        );
      } catch (error) {
        console.error(
          `[NATS Consumer] Failed to subscribe to ${topic.subject}:`,
          error,
        );
      }
    }
  }

  /**
   * Build NATS consumer configuration from options
   */
  private buildConsumerConfig(topic: TopicConfig): Partial<ConsumerConfig> {
    const opts = topic.consumerOptions || {};
    const durableName =
      opts.durableName ||
      `${this.groupName}-${topic.subject.replace(/[.>*]/g, "-")}`;

    const config: Partial<ConsumerConfig> = {
      durable_name: durableName,
      filter_subject: topic.subject,
      ack_policy: this.mapAckPolicy(opts.ackPolicy || "explicit"),
      deliver_policy: this.mapDeliverPolicy(opts.deliverPolicy || "all"),
      max_deliver: opts.maxDeliver ?? 5,
      ack_wait: opts.ackWait ?? 30000000000, // 30 seconds in nanoseconds
      max_ack_pending: opts.maxAckPending ?? 1000,
      replay_policy: this.mapReplayPolicy(opts.replayPolicy || "instant"),
    };

    return config;
  }

  /**
   * Map string ack policy to NATS enum
   */
  private mapAckPolicy(policy: string): AckPolicy {
    switch (policy) {
      case "none":
        return AckPolicy.None;
      case "all":
        return AckPolicy.All;
      default:
        return AckPolicy.Explicit;
    }
  }

  /**
   * Map string deliver policy to NATS enum
   */
  private mapDeliverPolicy(policy: string): DeliverPolicy {
    switch (policy) {
      case "last":
        return DeliverPolicy.Last;
      case "new":
        return DeliverPolicy.New;
      case "by_start_sequence":
        return DeliverPolicy.StartSequence;
      case "by_start_time":
        return DeliverPolicy.StartTime;
      default:
        return DeliverPolicy.All;
    }
  }

  /**
   * Map string replay policy to NATS enum
   */
  private mapReplayPolicy(policy: string): ReplayPolicy {
    switch (policy) {
      case "original":
        return ReplayPolicy.Original;
      default:
        return ReplayPolicy.Instant;
    }
  }

  /**
   * Find the stream that contains a subject
   */
  private async getStreamForSubject(subject: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const jsm = this.client.jetstreamManager;
      const streams = await jsm.streams.list().next();

      for (const stream of streams) {
        // Check if stream subjects match our subject pattern
        for (const streamSubject of stream.config.subjects || []) {
          if (this.subjectMatches(subject, streamSubject)) {
            return stream.config.name;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("[NATS Consumer] Error finding stream:", error);
      return null;
    }
  }

  /**
   * Check if a subject matches a pattern (supports wildcards)
   */
  private subjectMatches(subject: string, pattern: string): boolean {
    // Direct match
    if (subject === pattern) return true;

    // Pattern ends with > (matches any suffix)
    if (pattern.endsWith(">")) {
      const prefix = pattern.slice(0, -1);
      return subject.startsWith(prefix);
    }

    // Pattern contains * (single token wildcard)
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+") + "$",
      );
      return regex.test(subject);
    }

    return false;
  }

  /**
   * Consume messages from subscription
   */
  private async consumeMessages(
    consumer: Consumer,
    handler: (message: MessagePayload) => Promise<void>,
    subject: string,
  ): Promise<void> {
    const batchSize = 10;

    while (this.running) {
      try {
        // Fetch batch of messages using consume iterator
        const messages = await consumer.fetch({
          max_messages: batchSize,
          expires: 5000,
        });

        for await (const msg of messages) {
          await this.processMessage(msg, handler, subject);
        }
      } catch (error) {
        // Ignore timeout errors (normal when no messages)
        if (!isTimeoutError(error)) {
          console.error(`[NATS Consumer] Error consuming ${subject}:`, error);
        }
      }
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    msg: JsMsg,
    handler: (message: MessagePayload) => Promise<void>,
    subject: string,
  ): Promise<void> {
    try {
      const data = JSON.parse(sc.decode(msg.data));

      // Build message payload
      const payload: MessagePayload = {
        data,
        subject: msg.subject,
        seq: msg.seq,
        timestamp: new Date(),
        headers: this.extractHeaders(msg),
        ack: () => msg.ack(),
        nak: (delay?: number) => msg.nak(delay),
        working: () => msg.working(),
        term: () => msg.term(),
      };

      // Call handler
      await handler(payload);

      // Auto-ack on success
      msg.ack();

      console.log(
        `[NATS Consumer] Processed message from ${subject}, seq: ${msg.seq}`,
      );
    } catch (error) {
      console.error(
        `[NATS Consumer] Error processing message from ${subject}:`,
        error,
      );
      // Negative ack to retry
      msg.nak();
    }
  }

  /**
   * Extract headers from message
   */
  private extractHeaders(msg: JsMsg): Record<string, string> {
    const result: Record<string, string> = {};
    if (msg.headers) {
      for (const [key, values] of msg.headers) {
        result[key] = values.join(",");
      }
    }
    return result;
  }

  /**
   * Stop consuming and disconnect
   */
  async disconnect(): Promise<void> {
    console.log(`[NATS Consumer] ${this.serviceName} stopping...`);
    this.running = false;

    // Clear consumers - they will stop consuming when running is false
    this.consumers = [];
    this.client = null;
    console.log(`[NATS Consumer] ${this.serviceName} disconnected`);
  }

  /**
   * Check if connected and running
   */
  isRunning(): boolean {
    return this.running && this.client !== null && this.client.isConnected();
  }
}

/**
 * Create a consumer instance
 */
export function createConsumer(
  serviceName: string,
  groupName: string,
  config?: Partial<NatsConfig>,
): JetStreamConsumer {
  return new JetStreamConsumer(serviceName, groupName, config);
}
