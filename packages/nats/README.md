# @build/nats

NATS JetStream messaging package for Build Market. Provides typed
publish/consume primitives, durable stream management, distributed
tracing, and application-level metrics for event-driven communication
between services (orders, users, projects, notifications, license
verification, and more).

## Contents

- [Why JetStream](#why-jetstream)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Streams](#streams)
- [Producing messages](#producing-messages)
- [Consuming messages](#consuming-messages)
- [Tracing](#tracing)
- [Metrics](#metrics)
- [Testing](#testing)
- [Monitoring & deployment](#monitoring--deployment)
- [API reference](#api-reference)

## Why JetStream

Build Market is a set of independent services (order management, user
accounts, licensing/verification, notifications, project workflows) that
need to communicate without direct service-to-service coupling. JetStream
gives us:

- **Durable storage** — a published event is stored on disk (or memory,
  for ephemeral streams) until every interested consumer has processed it.
- **At-least-once delivery** — a consumer that crashes mid-processing
  gets the message redelivered, instead of silently losing it.
- **Explicit acknowledgment** — consumers control exactly when a message
  is considered "done," with configurable retry/backoff and dead-lettering
  after a max delivery count.
- **Message deduplication** — publishing with the same `msgId` within a
  stream's duplicate window is a no-op on the second call, giving natural
  idempotency for at-least-once producers.

## Installation

This package is part of the Build Market monorepo and is consumed via the
workspace protocol:

```json
{
  "dependencies": {
    "@build/nats": "workspace:*"
  }
}
```

## Quick start

```ts
import { createProducer, createConsumer, initializeStreams } from "@build/nats";

// Once, at startup for whichever service owns stream provisioning:
await initializeStreams({ servers: process.env.NATS_URL });

// Producer
const producer = createProducer("order-service");
await producer.connect();
await producer.publish("order.created", { orderId: "abc123", amount: 4200 });

// Consumer
const consumer = createConsumer("notification-service", "notification-group");
await consumer.connect();
await consumer.subscribe([
  {
    subject: "order.created",
    handler: async (message) => {
      console.log("Received order:", message.data);
      // No need to call message.ack() yourself — the consumer auto-acks
      // on successful handler completion, and auto-naks/terminates on
      // failure per your maxDeliver setting.
    },
  },
]);
```

## Configuration

`NatsConfig` fields are read from environment variables by default
(`getDefaultConfig()` in `client.ts`), and can be overridden per call:

| Env var                       | Default                    | Purpose                      |
| ----------------------------- | -------------------------- | ---------------------------- |
| `NATS_URL`                    | `nats://localhost:4222`    | Server(s) to connect to      |
| `NATS_CLIENT_NAME`            | `build-market-${NODE_ENV}` | Client identification        |
| `NATS_TOKEN`                  | —                          | Token auth                   |
| `NATS_USER` / `NATS_PASS`     | —                          | User/password auth           |
| `NATS_TIMEOUT`                | 5000 (10000 in prod)       | Connection timeout (ms)      |
| `NATS_MAX_RECONNECT_ATTEMPTS` | -1 (infinite)              | Reconnect attempts           |
| `NATS_RECONNECT_TIME_WAIT`    | 1000 (2000 in prod)        | Wait between reconnects (ms) |

Any of these can be overridden per-call:

```ts
await createNatsClient({
  servers: "nats://staging-nats:4222",
  name: "my-service",
});
```

The underlying connection is a **singleton** — the first call to
`createNatsClient()` (directly, or via `createProducer`/`createConsumer`)
establishes it, and subsequent calls reuse the existing connection unless
it's been closed.

## Streams

Predefined streams (`StreamPresets` in `types.ts`, provisioned by
`initializeStreams()`):

| Stream          | Subjects         | Retention | Max age                     |
| --------------- | ---------------- | --------- | --------------------------- |
| `VERIFICATION`  | `verification.>` | limits    | 7 days                      |
| `USERS`         | `user.>`         | limits    | 30 days                     |
| `ORDERS`        | `order.>`        | limits    | 90 days                     |
| `PROJECTS`      | `project.>`      | limits    | 90 days                     |
| `NOTIFICATIONS` | `notification.>` | workqueue | 24 hours                    |
| `LICENSES`      | `license.>`      | limits    | 30 days, 2-min dedup window |

`StreamManager.ensureStream()` is **idempotent** — call it repeatedly
with the same name and it creates on first call, updates on subsequent
calls, never duplicates. It auto-caps `duplicateWindow` to `maxAge`
whenever `maxAge` is set below the default 2-minute window, since
JetStream rejects a duplicate window longer than a stream's max message
age.

```ts
import { createStreamManager } from "@build/nats";

const manager = createStreamManager();
await manager.ensureStream({
  name: "CUSTOM_STREAM",
  subjects: ["custom.>"],
  storage: "file",
  maxAge: 60 * 60 * 1_000_000_000, // 1 hour, in nanoseconds
});

const stats = await manager.getStreamStats("CUSTOM_STREAM");
// { messages, bytes, firstSeq, lastSeq, consumerCount }
```

**Note on units:** JetStream's own config fields (`maxAge`, `ackWait`,
`duplicateWindow`) are all **nanoseconds**, not milliseconds. This has
bitten us once already (see `CHANGELOG.md`) — when in doubt, multiply
explicitly: `5 * 1000 * 1_000_000` for "5 seconds."

## Producing messages

```ts
import { createProducer } from "@build/nats";

const producer = createProducer("order-service");
await producer.connect();

// Standard publish, waits for JetStream ack
const ack = await producer.publish("order.created", { orderId: "abc123" });

// Idempotent publish — same msgId within the duplicate window is deduped
await producer.publish(
  "order.created",
  { orderId: "abc123" },
  { msgId: "order-abc123-created" },
);

// Fire-and-forget (core NATS, no JetStream ack, no durability guarantee)
await producer.publishFast("metrics.heartbeat", { ts: Date.now() });

// Automatic retry with exponential backoff + jitter
await producer.publishWithRetry(
  "order.created",
  { orderId: "abc123" },
  { maxRetries: 3, retryDelayMs: 1000 },
);
```

## Consuming messages

```ts
import { createConsumer } from "@build/nats";

const consumer = createConsumer("notification-service", "notification-group");
await consumer.connect();
await consumer.subscribe([
  {
    subject: "order.created",
    consumerOptions: {
      maxDeliver: 5, // give up after 5 delivery attempts
      ackWait: 30_000_000_000, // 30s, in nanoseconds
    },
    handler: async (message) => {
      // Throwing here triggers an automatic NAK with exponential backoff.
      // Once deliveryCount reaches maxDeliver, the message is terminated
      // (removed from the pending queue) instead of redelivered forever.
      await processOrder(message.data);
    },
  },
]);

// Graceful shutdown — stops the pull loop and awaits in-flight processing
await consumer.disconnect();
```

Each subscribed subject gets its own durable consumer
(`${groupName}-${sanitizedSubject}`), so multiple services can each run
their own `groupName` against the same subject and each get their own
independent delivery cursor.

## Tracing

Every publish injects the active OpenTelemetry context into message
headers; every consume extracts it and starts a child span
(`nats.consume <subject>`), so a trace started in an HTTP handler that
publishes an event continues seamlessly into whichever service consumes
it — no manual correlation-ID plumbing required. This uses
`@opentelemetry/api` only; wire up an actual tracer/exporter in your
service's OTel bootstrap the same way you would for HTTP tracing.

## Metrics

The package also emits OTel **metrics**, namespaced `nats_client_*`
specifically so they don't collide with an infra-level NATS server
exporter (`nats_varz_*`) if you run one alongside:

| Metric                                                               | What it tells you                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| `nats_client_messages_published_total`                               | Publish volume & success/error rate, by subject           |
| `nats_client_publish_duration_ms`                                    | JetStream ack round-trip latency                          |
| `nats_client_messages_consumed_total`                                | Handler outcome (success/error), by subject               |
| `nats_client_consume_duration_ms`                                    | Handler execution time                                    |
| `nats_client_messages_redelivered_total`                             | Redelivery rate — rising fast usually means a handler bug |
| `nats_client_messages_terminated_total`                              | Effective dead-letter rate                                |
| `nats_client_consumer_nak_total`                                     | Explicit NAKs issued                                      |
| `nats_client_connection_status`                                      | 1 if connected, 0 if not                                  |
| `nats_client_reconnect_total` / `nats_client_disconnect_total`       | Connection stability                                      |
| `nats_client_consumer_pending_messages` / `..._ack_pending_messages` | Per-consumer lag — the best "is a consumer stuck" signal  |
| `nats_client_stream_messages` / `nats_client_stream_bytes`           | Per-stream size (opt-in)                                  |

Like tracing, this only uses `@opentelemetry/api` — every instrument is
a documented no-op until your service registers a real `MeterProvider`.
See **`docs/MONITORING.md`** for the bootstrap snippet and suggested
PromQL/alerts. Stream-size gauges are opt-in via:

```ts
await initializeStreams(config, { withMetrics: true }); // enable from ONE designated service
```

## Testing

Integration tests run against a real spawned `nats-server -js` process,
not a mocked client — redelivery timing, `maxDeliver` termination, and
`msgId` dedup are server behavior, and mocking the client wouldn't
exercise any of it.

```bash
pnpm test:integration
```

Requires the `nats-server` binary on `PATH` (`brew install nats-server`,
or download from the [NATS releases page](https://github.com/nats-io/nats-server/releases)).
Full details, prerequisites, and coverage breakdown: **`docs/TESTING.md`**.

## Monitoring & deployment

Infra-level NATS server health (cluster quorum, disk, connections) is
covered separately from this package's application metrics — see
**`docs/NATS_MONITORING_SETUP.MD`** for the exporter/Prometheus/Grafana
setup currently deployed on AKS, and **`docs/deploy-monitoring-runbook.md`**
for the exact deployment steps.

## API reference

### `client.ts`

| Export                                                | Purpose                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `createNatsClient(config?, options?)`                 | Get or create the singleton connection           |
| `createServiceClient(serviceName, config?, options?)` | Same, with a service-scoped client name          |
| `getNatsClient()`                                     | Get the existing client, throws if not connected |
| `isNatsConnected()`                                   | Boolean connection check                         |
| `getConnectionStatus()`                               | Full status + health metrics snapshot            |
| `closeNatsConnection()`                               | Graceful drain + close                           |

### `producer.ts`

| Export                                                           | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `createProducer(serviceName, config?)`                           | Create a `JetStreamProducer`                         |
| `JetStreamProducer.publish(subject, message, options?)`          | Publish with JetStream ack                           |
| `JetStreamProducer.publishFast(subject, message)`                | Fire-and-forget, no durability                       |
| `JetStreamProducer.publishWithRetry(subject, message, options?)` | Auto-retry with backoff                              |
| `publishMessage(subject, message, options?)`                     | One-off publish using the existing shared connection |

### `consumer.ts`

| Export                                            | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `createConsumer(serviceName, groupName, config?)` | Create a `JetStreamConsumer`                    |
| `JetStreamConsumer.subscribe(topics)`             | Subscribe to one or more subjects with handlers |
| `JetStreamConsumer.disconnect()`                  | Stop pulling, await in-flight processing, close |
| `JetStreamConsumer.isRunning()`                   | Health check                                    |

### `streams.ts`

| Export                                                                                        | Purpose                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `createStreamManager(config?)`                                                                | Create a `StreamManager`                                               |
| `StreamManager.ensureStream(options)`                                                         | Idempotent create-or-update                                            |
| `StreamManager.deleteStream` / `purgeStream` / `getStream` / `listStreams` / `getStreamStats` | Admin operations                                                       |
| `initializeStreams(config?, { withMetrics? })`                                                | Provision all `StreamPresets`, optionally enabling stream-size metrics |

### `metrics.ts`

| Export                           | Purpose                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `registerStreamMetrics(config?)` | Manual/advanced entry point for stream-size gauges (prefer the `initializeStreams` flag) |

### `types.ts`

`NatsConfig`, `StreamOptions`, `ConsumerOptions`, `TopicConfig`,
`MessagePayload`, `PublishOptions`, `ConnectionMetrics`, `ConnectionStatus`,
`NatsClient`, `StreamPresets`, and typed event shapes
(`VerificationEvent`, `LicenseVerificationEvent`, `UserEvent`,
`OrderEvent`, `ProjectEvent`, `NotificationEvent`).
