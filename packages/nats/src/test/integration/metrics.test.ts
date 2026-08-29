import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { metrics } from "@opentelemetry/api";
import {
  MeterProvider,
  MetricReader,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import { createStreamManager } from "../../streams.js";
import { createProducer } from "../../producer.js";
import { _resetNatsClientForTests } from "../../client.js";
import { _resetMetricsForTests } from "../../metrics.js";

const config = {
  servers:
    process.env.NATS_TEST_URL ||
    process.env.NATS_TEST_SERVER ||
    process.env.NATS_URL ||
    "nats://localhost:4222",
};

/**
 * A MetricReader that does nothing on its own — we call collect() on it
 * directly whenever a test wants a snapshot. This is the same pull model
 * PrometheusExporter uses internally, without needing an HTTP server.
 */
class ManualTestReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

let reader: ManualTestReader;

function findMetric(snapshot: ResourceMetrics, name: string) {
  for (const scopeMetrics of snapshot.scopeMetrics) {
    const metric = scopeMetrics.metrics.find((m) => m.descriptor.name === name);
    if (metric) return metric;
  }
  return undefined;
}

beforeAll(() => {
  reader = new ManualTestReader();
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);
});

describe("application metrics", () => {
  const streamName = "TEST_METRICS";
  const subject = "test.metrics.publish";

  beforeEach(async () => {
    _resetNatsClientForTests();
    _resetMetricsForTests();
    const manager = createStreamManager(config);
    await manager.ensureStream({
      name: streamName,
      subjects: ["test.metrics.>"],
      storage: "memory",
    });
  });

  afterEach(async () => {
    const manager = createStreamManager(config);
    await manager.deleteStream(streamName).catch(() => {});
    _resetNatsClientForTests();
  });

  it("records a success on nats_client_messages_published_total after a successful publish", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();
    await producer.publish(subject, { hello: "world" });
    await producer.disconnect();

    const { resourceMetrics } = await reader.collect();
    const metric = findMetric(
      resourceMetrics,
      "nats_client_messages_published_total",
    );
    expect(metric).toBeDefined();

    const point = metric!.dataPoints.find(
      (p) =>
        p.attributes.subject === subject && p.attributes.status === "success",
    );
    expect(point).toBeDefined();
    expect(point!.value).toBeGreaterThanOrEqual(1);
  });

  it("records an error on nats_client_messages_published_total after a failed publish", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();

    // Publishing to a subject with no matching stream fails at the server.
    await expect(
      producer.publish("unmapped.subject.which.has.no.stream", { x: 1 }),
    ).rejects.toThrow();

    await producer.disconnect();

    const { resourceMetrics } = await reader.collect();
    const metric = findMetric(
      resourceMetrics,
      "nats_client_messages_published_total",
    );
    const point = metric?.dataPoints.find(
      (p) => p.attributes.status === "error",
    );
    expect(point).toBeDefined();
  });

  it("reports connection status as 1 while connected", async () => {
    const producer = createProducer("test-producer", config);
    await producer.connect();

    const { resourceMetrics } = await reader.collect();
    const metric = findMetric(resourceMetrics, "nats_client_connection_status");
    expect(metric).toBeDefined();
    expect(metric!.dataPoints[0]?.value).toBe(1);

    await producer.disconnect();
  });
});
