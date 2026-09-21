import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createStreamManager } from "../../streams.js";
import { createProducer } from "../../producer.js";
import { createConsumer } from "../../consumer.js";
import { _resetNatsClientForTests } from "../../client.js";

const config = { servers: process.env.NATS_TEST_URL! };

describe("redelivery and dead-lettering", () => {
  const streamName = "TEST_NOTIFICATIONS";
  const subject = "test.notification.send";

  beforeEach(async () => {
    _resetNatsClientForTests();
    const manager = createStreamManager(config);
    await manager.ensureStream({
      name: streamName,
      subjects: ["test.notification.>"],
      storage: "memory",
      replicas: 1,
    });
  });

  afterEach(async () => {
    const manager = createStreamManager(config);
    await manager.deleteStream(streamName).catch(() => {});
    _resetNatsClientForTests();
  });

  it("redelivers a message when the handler throws, until it eventually succeeds", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();
    await producer.publish(subject, { attempt: "will-fail-twice" });
    await producer.disconnect();

    let attempts = 0;
    const consumer = createConsumer("test-service", "flaky-group", config);
    await consumer.connect();
    await consumer.subscribe([
      {
        subject,
        consumerOptions: { ackWait: 10_000_000_000, maxDeliver: 5 }, // 10s — comfortably longer than our own nak() delays below, so the server's automatic ack-wait redelivery never fires concurrently with our explicit nak()
        handler: async () => {
          attempts += 1;
          if (attempts < 3) {
            throw new Error("simulated transient failure");
          }
          // succeeds on the 3rd attempt
        },
      },
    ]);

    await waitFor(() => attempts >= 3, 15_000);
    expect(attempts).toBe(3);

    await consumer.disconnect();
  });

  it("terminates a message after maxDeliver attempts instead of redelivering forever", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();
    await producer.publish(subject, { attempt: "always-fails" });
    await producer.disconnect();

    let attempts = 0;
    const maxDeliver = 3;

    const consumer = createConsumer(
      "test-service",
      "always-fail-group",
      config,
    );
    await consumer.connect();
    await consumer.subscribe([
      {
        subject,
        consumerOptions: { ackWait: 10_000_000_000, maxDeliver }, // 10s — same reasoning as the test above
        handler: async () => {
          attempts += 1;
          throw new Error("simulated permanent failure");
        },
      },
    ]);

    // Give it enough time to exhaust all redeliveries, then some margin to
    // confirm it does NOT keep retrying past maxDeliver.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    expect(attempts).toBeGreaterThanOrEqual(maxDeliver);
    const attemptsAtCheckpoint = attempts;

    // Wait again — if termination worked, attempts should not keep climbing.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(attempts).toBe(attemptsAtCheckpoint);

    await consumer.disconnect();
  });
});

async function waitFor(
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
