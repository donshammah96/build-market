import { afterEach, describe, expect, it } from "vitest";
import { createStreamManager } from "../../streams.js";
import { _resetNatsClientForTests } from "../../client.js";

const config = {
  servers:
    process.env.NATS_TEST_URL ||
    process.env.NATS_TEST_SERVER ||
    process.env.NATS_URL ||
    "nats://localhost:4222",
};

describe("StreamManager.ensureStream", () => {
  const streamName = "TEST_IDEMPOTENCY";

  afterEach(async () => {
    const manager = createStreamManager(config);
    await manager.deleteStream(streamName).catch(() => {});
    _resetNatsClientForTests();
  });

  it("creates a stream on first call and updates (not duplicates) on second call", async () => {
    const manager = createStreamManager(config);

    const created = await manager.ensureStream({
      name: streamName,
      subjects: ["test.idempotency.>"],
      storage: "memory",
      maxAge: 60_000_000_000, // 60s in ns
    });
    expect(created.config.name).toBe(streamName);
    expect(created.config.max_age).toBe(60_000_000_000);

    const updated = await manager.ensureStream({
      name: streamName,
      subjects: ["test.idempotency.>"],
      storage: "memory",
      maxAge: 120_000_000_000, // 120s in ns — changed
    });
    expect(updated.config.name).toBe(streamName);
    expect(updated.config.max_age).toBe(120_000_000_000);

    const allStreams = await manager.listStreams();
    const matching = allStreams.filter((s) => s.config.name === streamName);
    expect(matching).toHaveLength(1); // exactly one, not a duplicate
  });

  it("getStreamStats reflects published message count", async () => {
    const manager = createStreamManager(config);
    await manager.ensureStream({
      name: streamName,
      subjects: ["test.idempotency.>"],
      storage: "memory",
    });

    const before = await manager.getStreamStats(streamName);
    expect(before?.messages).toBe(0);

    const { createProducer } = await import("../../producer.js");
    const producer = createProducer("test-producer", config);
    await producer.connect();
    await producer.publish("test.idempotency.event", { ok: true });
    await producer.disconnect();

    const after = await manager.getStreamStats(streamName);
    expect(after?.messages).toBe(1);
  });
});
