import type { NatsConnection, JetStreamClient, JetStreamManager } from "nats";

/**
 * NATS connection configuration
 */
export interface NatsConfig {
  /** NATS server URLs (e.g., ["localhost:4222"]) */
  servers: string | string[];
  /** Client name for identification */
  name?: string;
  /** Authentication token */
  token?: string;
  /** Username for authentication */
  user?: string;
  /** Password for authentication */
  pass?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Reconnect automatically on disconnect */
  reconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Wait time between reconnection attempts (ms) */
  reconnectTimeWait?: number;
  /** Enable TLS */
  tls?: boolean;
}

/**
 * JetStream stream configuration options
 */
export interface StreamOptions {
  /** Stream name */
  name: string;
  /** Subjects the stream listens to (supports wildcards like "orders.>") */
  subjects: string[];
  /** Retention policy */
  retention?: "limits" | "interest" | "workqueue";
  /** Storage type */
  storage?: "file" | "memory";
  /** Maximum messages in the stream */
  maxMsgs?: number;
  /** Maximum bytes in the stream */
  maxBytes?: number;
  /** Maximum age of messages (nanoseconds) */
  maxAge?: number;
  /** Number of replicas for HA */
  replicas?: number;
  /** Discard policy when limits reached */
  discard?: "old" | "new";
  /** Allow duplicate window (nanoseconds) */
  duplicateWindow?: number;
}

/**
 * Consumer configuration for JetStream
 */
export interface ConsumerOptions {
  /** Durable consumer name (empty for ephemeral) */
  durableName?: string;
  /** Filter by subject */
  filterSubject?: string;
  /** Delivery policy for new consumers */
  deliverPolicy?:
    | "all"
    | "last"
    | "new"
    | "by_start_sequence"
    | "by_start_time";
  /** Acknowledgment policy */
  ackPolicy?: "explicit" | "none" | "all";
  /** Max number of delivery attempts */
  maxDeliver?: number;
  /** Ack wait timeout (nanoseconds) */
  ackWait?: number;
  /** Max messages without ack */
  maxAckPending?: number;
  /** Replay policy */
  replayPolicy?: "instant" | "original";
}

/**
 * Topic handler configuration (similar to Kafka pattern)
 */
export interface TopicConfig {
  /** Subject pattern to subscribe to */
  subject: string;
  /** Handler function for messages */
  handler: (message: MessagePayload) => Promise<void>;
  /** Optional consumer options override */
  consumerOptions?: ConsumerOptions;
}

/**
 * Message payload structure
 */
export interface MessagePayload<T = unknown> {
  /** Parsed message data */
  data: T;
  /** Original subject the message was published to */
  subject: string;
  /** Message sequence number */
  seq?: number;
  /** Timestamp when message was received */
  timestamp: Date;
  /** Message headers */
  headers?: Record<string, string>;
  /** Acknowledge the message */
  ack: () => void;
  /** Negative acknowledge (request redelivery) */
  nak: (delay?: number) => void;
  /** Signal message processing in progress */
  working: () => void;
  /** Terminate message (won't be redelivered) */
  term: () => void;
}

/**
 * Publisher options
 */
export interface PublishOptions {
  /** Message ID for deduplication */
  msgId?: string;
  /** Expected last message ID */
  expect?: {
    lastMsgId?: string;
    lastSequence?: number;
    streamName?: string;
  };
  /** Message headers */
  headers?: Record<string, string>;
  /** Timeout for publish acknowledgment (ms) */
  timeout?: number;
}

/**
 * Connection health metrics
 */
export interface ConnectionMetrics {
  reconnectAttempts: number;
  lastReconnectAt?: Date;
  lastDisconnectAt?: Date;
  totalDisconnects: number;
  connectedAt?: Date;
  errors: Array<{ timestamp: Date; error: string }>;
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  connected: boolean;
  server?: string;
  metrics: ConnectionMetrics;
  config: {
    servers: string | string[];
    name: string;
    environment: string;
  };
}

/**
 * NATS client wrapper interface
 */
export interface NatsClient {
  /** Raw NATS connection */
  connection: NatsConnection;
  /** JetStream client for pub/sub */
  jetstream: JetStreamClient;
  /** JetStream manager for admin operations */
  jetstreamManager: JetStreamManager;
  /** Close the connection */
  close: () => Promise<void>;
  /** Check if connected */
  isConnected: () => boolean;
  /** Get detailed connection status */
  getStatus: () => ConnectionStatus;
  /** Get connection health metrics */
  getMetrics: () => ConnectionMetrics;
}

/**
 * Predefined stream configurations for common use cases
 */
export const StreamPresets = {
  /** Verification events stream */
  VERIFICATION: {
    name: "VERIFICATION",
    subjects: ["verification.>"],
    retention: "limits" as const,
    storage: "file" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
    replicas: 1,
  },
  /** User events stream */
  USERS: {
    name: "USERS",
    subjects: ["user.>"],
    retention: "limits" as const,
    storage: "file" as const,
    maxAge: 30 * 24 * 60 * 60 * 1000000000, // 30 days
    replicas: 1,
  },
  /** Order events stream */
  ORDERS: {
    name: "ORDERS",
    subjects: ["order.>"],
    retention: "limits" as const,
    storage: "file" as const,
    maxAge: 90 * 24 * 60 * 60 * 1000000000, // 90 days
    replicas: 1,
  },
  /** Project events stream */
  PROJECTS: {
    name: "PROJECTS",
    subjects: ["project.>"],
    retention: "limits" as const,
    storage: "file" as const,
    maxAge: 90 * 24 * 60 * 60 * 1000000000, // 90 days
    replicas: 1,
  },
  /** Notification events stream (work queue - delete after processing) */
  NOTIFICATIONS: {
    name: "NOTIFICATIONS",
    subjects: ["notification.>"],
    retention: "workqueue" as const,
    storage: "file" as const,
    maxAge: 24 * 60 * 60 * 1000000000, // 24 hours
    replicas: 1,
  },
} as const;

/**
 * Event type definitions for type-safe publishing/consuming
 */
export interface VerificationEvent {
  entityType: "professional" | "store" | "property" | "certificate";
  entityId: string;
  previousStatus: string;
  newStatus: string;
  success: boolean;
  message: string;
  verifiedAt?: string;
  reason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UserEvent {
  userId: string;
  action: "created" | "updated" | "deleted" | "verified" | "suspended";
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface OrderEvent {
  orderId: string;
  action:
    | "created"
    | "updated"
    | "paid"
    | "shipped"
    | "delivered"
    | "cancelled";
  userId: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface ProjectEvent {
  projectId: string;
  action: "created" | "updated" | "completed" | "cancelled";
  userId: string;
  professionalId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationEvent {
  userId: string;
  type: "email" | "push" | "in_app";
  category:
    | "order"
    | "message"
    | "project"
    | "review"
    | "system"
    | "verification";
  title: string;
  content: string;
  data?: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
}
