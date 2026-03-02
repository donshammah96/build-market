# NATS Client Usage Examples

## Overview

The enhanced NATS client now includes:

- ✅ Environment-aware configuration via `env.ts`
- ✅ Connection health monitoring and metrics
- ✅ Graceful shutdown handlers
- ✅ Verbose logging in development mode
- ✅ Type-safe configuration

## Basic Usage

### 1. Simple Connection

```typescript
import { createNatsClient } from "@build/nats";

// Connects using environment variables (NATS_URL, NATS_CLIENT_NAME, etc.)
const client = await createNatsClient();

// Check connection status
if (client.isConnected()) {
  console.log("Connected to NATS!");
}
```

### 2. Service-Specific Client

```typescript
import { createServiceClient } from "@build/nats";

// Creates a client with service-specific name
const client = await createServiceClient("notification-service");
// Client name will be: notification-service-development (or production)
```

### 3. Custom Configuration

```typescript
import { createNatsClient } from "@build/nats";

const client = await createNatsClient({
  servers: ["nats://server1:4222", "nats://server2:4222"],
  name: "custom-client",
  timeout: 15000,
  reconnectTimeWait: 3000,
});
```

### 4. Enable Verbose Logging

```typescript
import { createNatsClient } from "@build/nats";

// Enable verbose logging (automatic in development)
const client = await createNatsClient(undefined, { verbose: true });
```

## Health Monitoring

### Get Connection Status

```typescript
import { getConnectionStatus } from "@build/nats";

const status = getConnectionStatus();

console.log("Connection Status:", {
  connected: status.connected,
  server: status.server,
  environment: status.config.environment,
  totalDisconnects: status.metrics.totalDisconnects,
  reconnectAttempts: status.metrics.reconnectAttempts,
});
```

### Access Metrics from Client

```typescript
const client = await createNatsClient();
const metrics = client.getMetrics();

console.log("Connection Metrics:", {
  connectedAt: metrics.connectedAt,
  lastReconnectAt: metrics.lastReconnectAt,
  totalDisconnects: metrics.totalDisconnects,
  recentErrors: metrics.errors.slice(-5), // Last 5 errors
});
```

### Health Check Endpoint Example

```typescript
// In your API route (e.g., /api/health)
import { getConnectionStatus } from "@build/nats";

export async function GET() {
  const natsStatus = getConnectionStatus();

  return Response.json({
    nats: {
      connected: natsStatus.connected,
      server: natsStatus.server,
      uptime: natsStatus.metrics.connectedAt
        ? Date.now() - natsStatus.metrics.connectedAt.getTime()
        : 0,
      metrics: {
        disconnects: natsStatus.metrics.totalDisconnects,
        reconnects: natsStatus.metrics.reconnectAttempts,
      },
    },
  });
}
```

## Environment Configuration

### Required Environment Variables

Add to your `.env` file:

```bash
# NATS Configuration
NATS_URL=nats://localhost:4222
NATS_CLIENT_NAME=my-service

# Optional Authentication
NATS_TOKEN=your-token-here
# OR
NATS_USER=admin
NATS_PASS=password

# Optional Timeouts (milliseconds)
NATS_TIMEOUT=10000
NATS_RECONNECT_TIME_WAIT=2000
NATS_MAX_RECONNECT_ATTEMPTS=-1
```

### Environment-Aware Defaults

The client automatically adjusts settings based on `NODE_ENV`:

| Setting         | Development | Production  |
| --------------- | ----------- | ----------- |
| Timeout         | 5000ms      | 10000ms     |
| Reconnect Wait  | 1000ms      | 2000ms      |
| Verbose Logging | ✅ Enabled  | ❌ Disabled |

### Using env.ts Configuration

If you have centralized env config in your app:

```typescript
import { envConfig } from "@/lib/env";
import { createNatsClient } from "@build/nats";

// Config automatically uses envConfig.nats settings
const client = await createNatsClient({
  servers: envConfig.nats.url,
  name: envConfig.nats.clientName,
  token: envConfig.nats.token,
  timeout: envConfig.nats.timeout,
});
```

## Graceful Shutdown

The client automatically registers shutdown handlers for:

- `SIGTERM` - Graceful termination
- `SIGINT` - Interrupt (Ctrl+C)
- `uncaughtException` - Unexpected errors
- `unhandledRejection` - Unhandled promise rejections

### Manual Shutdown

```typescript
import { closeNatsConnection } from "@build/nats";

// Manually close connection
await closeNatsConnection();
```

### Custom Cleanup

```typescript
const client = await createNatsClient();

// Add your cleanup logic
process.on("SIGTERM", async () => {
  console.log("Shutting down...");

  // Your cleanup
  await stopProcessingJobs();

  // Close NATS
  await client.close();

  process.exit(0);
});
```

## Publishing Messages

```typescript
import { getNatsClient } from "@build/nats";

const client = getNatsClient();
const js = client.jetstream();

// Simple publish
await js.publish(
  "orders.created",
  JSON.stringify({
    orderId: "123",
    amount: 99.99,
  }),
);

// With headers and deduplication
await js.publish("orders.updated", JSON.stringify(data), {
  msgID: "unique-msg-id",
  headers: {
    "Content-Type": "application/json",
    Source: "payment-service",
  },
});
```

## Subscribing to Messages

```typescript
import { getNatsClient } from "@build/nats";

const client = getNatsClient();
const js = client.jetstream();

// Create or get stream
const jsm = client.jetstreamManager;
await jsm.streams.add({
  name: "ORDERS",
  subjects: ["orders.>"],
});

// Subscribe to messages
const consumer = await js.consumers.get("ORDERS", "order-processor");
const messages = await consumer.consume();

for await (const msg of messages) {
  try {
    const data = JSON.parse(msg.data.toString());
    console.log("Received:", data);

    // Process message
    await processOrder(data);

    // Acknowledge
    msg.ack();
  } catch (error) {
    console.error("Error processing message:", error);
    // Negative acknowledge (will be redelivered)
    msg.nak(5000); // Retry after 5 seconds
  }
}
```

## Error Handling

### Connection Errors

```typescript
import { createNatsClient } from "@build/nats";

try {
  const client = await createNatsClient();
} catch (error) {
  console.error("Failed to connect to NATS:", error);
  // Fallback logic
}
```

### Track Connection Issues

```typescript
const client = await createNatsClient();

// Check for connection problems
const metrics = client.getMetrics();

if (metrics.totalDisconnects > 10) {
  console.warn("Frequent disconnections detected!");
  // Alert monitoring system
}

if (metrics.errors.length > 0) {
  console.error("Recent errors:", metrics.errors);
  // Log to error tracking service
}
```

## Testing

### Reset Metrics in Tests

```typescript
import { resetMetrics } from "@build/nats";

beforeEach(() => {
  resetMetrics();
});
```

### Mock Client

```typescript
import { jest } from "@jest/globals";

jest.mock("@build/nats", () => ({
  createNatsClient: jest.fn().mockResolvedValue({
    isConnected: () => true,
    getStatus: () => ({ connected: true }),
    close: jest.fn(),
  }),
}));
```

## Best Practices

### ✅ DO

- Use singleton pattern (client auto-reuses connection)
- Check `isConnected()` before publishing
- Monitor connection metrics in production
- Use service-specific client names
- Handle reconnection events
- Implement proper error handling

### ❌ DON'T

- Create multiple clients unnecessarily
- Ignore connection errors
- Skip graceful shutdown
- Hardcode configuration values
- Block on synchronous operations

## Migration Guide

### From Old Client

```typescript
// OLD
import { createNatsClient } from "@build/nats";
const client = await createNatsClient({
  servers: process.env.NATS_URL || "localhost:4222",
  name: process.env.NATS_CLIENT_NAME || "app",
});

// NEW - Configuration comes from env automatically
import { createNatsClient } from "@build/nats";
const client = await createNatsClient();
```

### New Methods Available

```typescript
const client = await createNatsClient();

// New: Get detailed status
const status = client.getStatus();

// New: Get health metrics
const metrics = client.getMetrics();

// Both work as before
const connected = client.isConnected();
await client.close();
```

## Support

For issues or questions:

- Check logs with verbose mode: `{ verbose: true }`
- Review connection metrics: `client.getMetrics()`
- Verify environment variables are set correctly
- Consult NATS documentation: https://docs.nats.io/
