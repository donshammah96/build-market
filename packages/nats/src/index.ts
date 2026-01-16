// NATS JetStream package for Build Market
// Provides messaging infrastructure for event-driven architecture

// Client
export {
  createNatsClient,
  getNatsClient,
  isNatsConnected,
  closeNatsConnection,
  createServiceClient,
} from "./client";

// Producer
export {
  JetStreamProducer,
  createProducer,
  publishMessage,
} from "./producer";

// Consumer
export {
  JetStreamConsumer,
  createConsumer,
} from "./consumer";

// Streams
export {
  StreamManager,
  createStreamManager,
  initializeStreams,
} from "./streams";

// Types
export type {
  NatsConfig,
  NatsClient,
  StreamOptions,
  ConsumerOptions,
  TopicConfig,
  MessagePayload,
  PublishOptions,
  VerificationEvent,
  UserEvent,
  OrderEvent,
  ProjectEvent,
  NotificationEvent,
} from "./types";

export { StreamPresets } from "./types";
