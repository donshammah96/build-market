import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createStreamManager } from "../../streams.js";
import { createProducer } from "../../producer.js";
import { createConsumer } from "../../consumer.js";
import { _resetNatsClientForTests } from "../../client.js";
import type { MessagePayload } from "../../types.js";

const config = {
  servers:
    process.env.NATS_TEST_URL ||
    process.env.NATS_TEST_SERVER ||
    process.env.NATS_URL ||
    "nats://localhost:4222",
};

describe("producer -> consumer round trip", () => {
  const streamName = "TEST_ORDERS";
  const subject = "test.orders.created";

  beforeEach(async () => {
    _resetNatsClientForTests();
    const manager = createStreamManager(config);
    await manager.ensureStream({
      name: streamName,
      subjects: ["test.orders.>"],
      storage: "memory", // no disk I/O needed for test speed
      replicas: 1,
    });
  });

  afterEach(async () => {
    const manager = createStreamManager(config);
    await manager.deleteStream(streamName).catch(() => {});
    _resetNatsClientForTests();
  });

  it("delivers a published message to a subscribed consumer and acks it", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();

    const received: MessagePayload[] = [];
    const consumer = createConsumer("test-service", "test-group", config);
    await consumer.connect();
    await consumer.subscribe([
      {
        subject,
        handler: async (message) => {
          received.push(message);
        },
      },
    ]);

    const ack = await producer.publish(subject, {
      orderId: "order-1",
      amount: 4200,
    });
    expect(ack.stream).toBe(streamName);

    // Consumer runs a pull loop internally; poll until it's caught the message.
    await vi_waitFor(() => received.length === 1, 5000);

    expect(received[0]?.data).toEqual({ orderId: "order-1", amount: 4200 });
    expect(received[0]?.subject).toBe(subject);

    await consumer.disconnect();
    await producer.disconnect();
  });

  it("publishWithRetry succeeds on first attempt when the server is healthy", async () => {
    const producer = createProducer("test-producer-retry", config);
    await producer.connect();

    const ack = await producer.publishWithRetry(subject, {
      orderId: "order-2",
    });
    expect(ack.seq).toBeGreaterThan(0);

    await producer.disconnect();
  });

  it("deduplicates messages published with the same msgId inside the duplicate window", async () => {
    const producer = createProducer("test-producer-dedup", config);
    await producer.connect();

    const first = await producer.publish(
      subject,
      { orderId: "order-dedup" },
      { msgId: "dedup-key-1" },
    );
    const second = await producer.publish(
      subject,
      { orderId: "order-dedup" },
      { msgId: "dedup-key-1" },
    );

    // Same msgId within the stream's duplicate_window -> same sequence number,
    // not a new message.
    expect(second.seq).toBe(first.seq);
    expect(second.duplicate).toBe(true);

    await producer.disconnect();
  });
});

/**
 * Minimal poll-until-true helper. Avoids pulling in vitest's `vi.waitFor`
 * just for this, and makes the polling interval explicit.
 */
async function vi_waitFor(
  condition: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}
