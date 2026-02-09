# @build/nats

A NATS JetStream messaging package for Build Market's event-driven architecture. Provides reliable, scalable message streaming between microservices.

## Features

- **JetStream Support** - Durable message persistence with at-least-once delivery
- **Singleton Client** - Shared connection across your service
- **Producer with Retry** - Automatic retry on publish failures
- **Durable Consumers** - Resume from last acknowledged message after restart
- **Stream Management** - Create and configure streams programmatically
- **Type-Safe Events** - Pre-defined event types for verification, orders, projects, etc.

## Installation

The package is included in the monorepo. Add it to your service's `package.json`:

```json
{
  "dependencies": {
    "@build/nats": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

## Prerequisites

### Local Development

Install and start NATS server with JetStream enabled:

```powershell
# Windows (winget)
winget install NATS.Server

# Start with JetStream
nats-server -js
```

Or download from [nats.io/download](https://nats.io/download/).

### Production

Use a managed NATS service or deploy NATS cluster. Set environment variables:

```env
NATS_URL=nats://your-server:4222
NATS_CLIENT_NAME=your-service-name
NATS_TOKEN=your-auth-token        # Optional
NATS_USER=your-username           # Optional
NATS_PASS=your-password           # Optional
```

## Quick Start

### 1. Initialize Streams (First Run)

Before publishing/consuming, ensure streams exist:

```typescript
import { createNatsClient, initializeStreams } from "@build/nats";

// Connect to NATS
await createNatsClient();

// Create all predefined streams (VERIFICATION, USERS, ORDERS, PROJECTS, NOTIFICATIONS)
await initializeStreams();
```

### 2. Publish Events

```typescript
import { createProducer, type VerificationEvent } from "@build/nats";

// Create producer for your service
const producer = createProducer("my-service");
await producer.connect();

// Publish with JetStream acknowledgment
const event: VerificationEvent = {
  entityType: "professional",
  entityId: "user-123",
  previousStatus: "PENDING",
  newStatus: "VERIFIED",
  success: true,
  message: "Professional verification approved",
  verifiedAt: new Date().toISOString(),
  metadata: {
    email: "user@example.com",
    userName: "John Doe",
  },
};

await producer.publish("verification.professional.verified", event);

// Or with retry on failure
await producer.publishWithRetry("verification.professional.verified", event, {
  maxRetries: 3,
  retryDelay: 1000,
});

// Cleanup on shutdown
await producer.disconnect();
```

### 3. Consume Events

```typescript
import {
  createConsumer,
  initializeStreams,
  type TopicConfig,
  type MessagePayload,
  type VerificationEvent,
} from "@build/nats";

// Ensure streams exist
await initializeStreams();

// Create consumer with consumer group name
const consumer = createConsumer("notification-service", "notification-group");
await consumer.connect();

// Define topic handlers
const topics: TopicConfig[] = [
  {
    subject: "verification.>", // Wildcard: matches verification.professional.*, verification.store.*, etc.
    handler: async (message: MessagePayload<VerificationEvent>) => {
      console.log("Received verification event:", message.data);
      console.log("Subject:", message.subject);
      console.log("Sequence:", message.seq);

      // Process the event...

      // Message is auto-acked on success
      // To manually control: message.ack(), message.nak(), message.term()
    },
    consumerOptions: {
      durableName: "my-verification-consumer",
      deliverPolicy: "new", // Only new messages
      maxDeliver: 5, // Max retry attempts
    },
  },
  {
    subject: "user.created",
    handler: async (message) => {
      const { userId, email } = message.data as {
        userId: string;
        email: string;
      };
      // Send welcome email...
    },
  },
];

await consumer.subscribe(topics);

// Graceful shutdown
process.on("SIGTERM", async () => {
  await consumer.disconnect();
});
```

## API Reference

### Client

```typescript
import {
  createNatsClient,
  getNatsClient,
  isNatsConnected,
  closeNatsConnection,
  createServiceClient,
} from "@build/nats";

// Create/get singleton client
const client = await createNatsClient({
  servers: "localhost:4222",
  name: "my-service",
  reconnect: true,
  maxReconnectAttempts: -1, // Infinite
  timeout: 10000,
});

// Get existing client (throws if not connected)
const existingClient = getNatsClient();

// Check connection status
if (isNatsConnected()) {
  // ...
}

// Close connection
await closeNatsConnection();
```

### Producer

```typescript
import { createProducer, publishMessage, JetStreamProducer } from "@build/nats";

const producer = createProducer("service-name");
await producer.connect();

// Standard publish with ack
const ack = await producer.publish("subject.name", { data: "value" });
console.log(`Published to stream ${ack.stream}, seq: ${ack.seq}`);

// Publish with retry
await producer.publishWithRetry(
  "subject.name",
  { data: "value" },
  {
    maxRetries: 3,
    retryDelay: 1000,
    msgId: "unique-id-for-dedup",
  },
);

// Fire-and-forget (no JetStream ack)
await producer.publishFast("subject.name", { data: "value" });

// One-off publish using existing connection
await publishMessage("subject.name", { data: "value" });
```

### Consumer

```typescript
import {
  createConsumer,
  JetStreamConsumer,
  type TopicConfig,
} from "@build/nats";

const consumer = createConsumer(
  "service-name", // Service identifier
  "consumer-group", // Consumer group for load balancing
);

await consumer.connect();

const topics: TopicConfig[] = [
  {
    subject: "orders.>", // Subject pattern (supports *, >)
    handler: async (msg) => {}, // Message handler
    consumerOptions: {
      durableName: "order-processor",
      deliverPolicy: "all", // "all" | "last" | "new"
      ackPolicy: "explicit", // "explicit" | "none" | "all"
      maxDeliver: 5, // Max redelivery attempts
      ackWait: 30000000000, // 30s in nanoseconds
      maxAckPending: 1000,
    },
  },
];

await consumer.subscribe(topics);

// Check status
consumer.isRunning(); // true/false

// Shutdown
await consumer.disconnect();
```

### Stream Management

```typescript
import {
  createStreamManager,
  initializeStreams,
  type StreamOptions,
} from "@build/nats";

const manager = createStreamManager();

// Create/update a stream
await manager.ensureStream({
  name: "MY_STREAM",
  subjects: ["myservice.>"],
  retention: "limits", // "limits" | "interest" | "workqueue"
  storage: "file", // "file" | "memory"
  maxAge: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
  maxMsgs: 1000000,
  replicas: 1,
});

// Get stream info
const info = await manager.getStream("MY_STREAM");

// Get statistics
const stats = await manager.getStreamStats("MY_STREAM");
// { messages, bytes, firstSeq, lastSeq, consumerCount }

// List all streams
const streams = await manager.listStreams();

// Purge messages
await manager.purgeStream("MY_STREAM");

// Delete stream
await manager.deleteStream("MY_STREAM");

// Initialize all predefined Build Market streams
await initializeStreams();
```

## Predefined Streams

The package includes predefined stream configurations in `StreamPresets`:

| Stream          | Subjects         | Retention | Max Age  |
| --------------- | ---------------- | --------- | -------- |
| `VERIFICATION`  | `verification.>` | limits    | 7 days   |
| `USERS`         | `user.>`         | limits    | 30 days  |
| `ORDERS`        | `order.>`        | limits    | 90 days  |
| `PROJECTS`      | `project.>`      | limits    | 90 days  |
| `NOTIFICATIONS` | `notification.>` | workqueue | 24 hours |

Use `initializeStreams()` to create all of them.

## Event Types

Pre-defined TypeScript interfaces for type-safe messaging:

```typescript
import type {
  VerificationEvent,
  UserEvent,
  OrderEvent,
  ProjectEvent,
  NotificationEvent,
} from "@build/nats";

// VerificationEvent
const event: VerificationEvent = {
  entityType: "professional", // | "store" | "property" | "certificate"
  entityId: "user-123",
  previousStatus: "PENDING",
  newStatus: "VERIFIED",
  success: true,
  message: "Approved",
  verifiedAt: "2026-01-15T10:00:00Z",
  reason: "Optional rejection reason",
  notes: "Admin notes",
  metadata: { email: "user@example.com" },
};

// UserEvent
const userEvent: UserEvent = {
  userId: "user-123",
  action: "created", // | "updated" | "deleted" | "verified" | "suspended"
  email: "user@example.com",
  metadata: {},
};

// OrderEvent
const orderEvent: OrderEvent = {
  orderId: "order-123",
  action: "created", // | "updated" | "paid" | "shipped" | "delivered" | "cancelled"
  userId: "user-123",
  amount: 99.99,
  metadata: {},
};

// ProjectEvent
const projectEvent: ProjectEvent = {
  projectId: "proj-123",
  action: "created", // | "updated" | "completed" | "cancelled"
  userId: "user-123",
  professionalId: "pro-456",
  metadata: {},
};

// NotificationEvent
const notifEvent: NotificationEvent = {
  userId: "user-123",
  type: "email", // | "push" | "in_app"
  category: "verification", // | "order" | "message" | "project" | "review" | "system"
  title: "Notification Title",
  content: "Notification body",
  data: {},
  priority: "normal", // | "low" | "high" | "urgent"
};
```

## Subject Naming Convention

Follow this pattern for subjects:

```
<domain>.<entity>.<action>
```

Examples:

- `verification.professional.verified`
- `verification.store.rejected`
- `user.created`
- `user.updated`
- `order.created`
- `order.paid`
- `project.completed`
- `notification.email.send`

Wildcards:

- `*` - Matches single token: `verification.*.verified` matches `verification.professional.verified`
- `>` - Matches multiple tokens: `verification.>` matches all verification events

## Error Handling

### Producer Errors

```typescript
try {
  await producer.publish("subject", data);
} catch (error) {
  // Handle publish failure (network, stream not found, etc.)
  console.error("Publish failed:", error);
}

// Or use built-in retry
await producer.publishWithRetry("subject", data, {
  maxRetries: 3,
  retryDelay: 1000,
});
```

### Consumer Errors

Messages are automatically retried on handler errors (up to `maxDeliver` times):

```typescript
handler: async (msg) => {
  try {
    await processMessage(msg.data);
    // Auto-acked on success
  } catch (error) {
    // Auto-NAK'd, will be redelivered
    throw error;
  }
};
```

For manual control:

```typescript
handler: async (msg) => {
  try {
    await processMessage(msg.data);
    msg.ack(); // Explicit ack
  } catch (error) {
    if (isPermanentFailure(error)) {
      msg.term(); // Don't retry
    } else {
      msg.nak(5000); // Retry after 5 seconds
    }
  }
};
```

## Integration Example

### Notification Service

```typescript
// apps/notification-service/src/services/natsConsumer.ts
import {
  createConsumer,
  createNatsClient,
  initializeStreams,
  type MessagePayload,
  type VerificationEvent,
} from "@build/nats";
import { sendEmail } from "./emailService";

export async function initializeNatsConsumer() {
  await createNatsClient();
  await initializeStreams();

  const consumer = createConsumer("notification-service", "notification-group");
  await consumer.connect();

  await consumer.subscribe([
    {
      subject: "verification.>",
      handler: async (msg: MessagePayload<VerificationEvent>) => {
        const event = msg.data;

        if (event.metadata?.email) {
          await sendEmail(
            event.metadata.email as string,
            `${event.entityType} Verification Update`,
            `Status: ${event.newStatus}. ${event.message}`,
          );
        }
      },
    },
  ]);
}
```

### Verification Service Publisher

```typescript
// apps/client/lib/services/verification/notification.service.ts
import { createProducer, type VerificationEvent } from "@build/nats";

let producer: ReturnType<typeof createProducer> | null = null;

async function getProducer() {
  if (!producer) {
    producer = createProducer("verification-service");
    await producer.connect();
  }
  return producer;
}

export async function publishVerificationEvent(
  result: VerificationResult,
  userEmail: string,
) {
  const p = await getProducer();

  const event: VerificationEvent = {
    entityType: result.entityType,
    entityId: result.entityId,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    success: result.success,
    message: result.message,
    metadata: { email: userEmail },
  };

  await p.publishWithRetry(
    `verification.${result.entityType}.${result.newStatus.toLowerCase()}`,
    event,
  );
}
```

## Troubleshooting

### Connection Issues

```
[NATS] Connection failed: Error: connect ECONNREFUSED 127.0.0.1:4222
```

**Solution:** Ensure NATS server is running with JetStream enabled:

```bash
nats-server -js
```

### Stream Not Found

```
[NATS Consumer] No stream found for subject: verification.>
```

**Solution:** Initialize streams before subscribing:

```typescript
await initializeStreams();
```

### Message Not Delivered

Check if:

1. Stream exists and covers the subject
2. Consumer is subscribed to the correct subject pattern
3. Producer is publishing to a subject that matches a stream

### Debug Logging

The package logs to console. Look for `[NATS]`, `[NATS Producer]`, `[NATS Consumer]`, `[NATS Streams]` prefixes.

## License

MIT
