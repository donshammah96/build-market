// NATS JetStream package for Build Market
// Provides messaging infrastructure for event-driven architecture

// Client
export {
  createNatsClient,
  getNatsClient,
  isNatsConnected,
  closeNatsConnection,
  createServiceClient,
} from "./client.js";

// Producer
export {
  JetStreamProducer,
  createProducer,
  publishMessage,
} from "./producer.js";

// Consumer
export { JetStreamConsumer, createConsumer } from "./consumer.js";

// Streams
export {
  StreamManager,
  createStreamManager,
  initializeStreams,
} from "./streams.js";

// Metrics
// Producer/consumer/connection metrics are recorded automatically.
// Stream size/message-count gauges are opt-in — prefer
// initializeStreams(config, { withMetrics: true }) in one designated
// service; this direct export remains for manual/advanced wiring.
export { registerStreamMetrics } from "./metrics.js";

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
  LicenseVerificationEvent,
  UserEvent,
  OrderEvent,
  ProjectEvent,
  NotificationEvent,
} from "./types.js";

export { StreamPresets } from "./types.js";
