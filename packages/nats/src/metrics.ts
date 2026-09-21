import { metrics, ValueType } from "@opentelemetry/api";
import type {
  Counter,
  Histogram,
  Meter,
  ObservableGauge,
} from "@opentelemetry/api";
import type { Consumer } from "nats";
import { createStreamManager } from "./streams.js";
import type { NatsConfig } from "./types.js";

/**
 * Application-level NATS metrics.
 *
 * These are deliberately namespaced `nats_client_*` to avoid colliding with
 * the infra-level `prometheus-nats-exporter` sidecar (which publishes
 * `nats_varz_*`, `nats_server_jetstream_*`, etc. from the NATS server
 * itself). That exporter tells you server health; these tell you whether
 * *your* producers/consumers are actually keeping up.
 *
 * This module only depends on @opentelemetry/api, which is already a
 * dependency of this package. It does not register a MeterProvider or
 * exporter itself — until the host application does that (e.g. via
 * @opentelemetry/sdk-metrics + @opentelemetry/exporter-prometheus,
 * alongside whatever already wires up tracing), every call here is a
 * documented no-op. See MONITORING.md for the bootstrap snippet.
 */

const METER_NAME = "@build/nats";
const METER_VERSION = "1.0.0";

interface Instruments {
  messagesPublished: Counter;
  publishDuration: Histogram;
  publishRetries: Counter;
  messagesConsumed: Counter;
  consumeDuration: Histogram;
  redeliveries: Counter;
  terminations: Counter;
  naks: Counter;
  reconnects: Counter;
  disconnects: Counter;
  connectionStatus: ObservableGauge;
  streamMessages: ObservableGauge;
  streamBytes: ObservableGauge;
  consumerPending: ObservableGauge;
  consumerAckPending: ObservableGauge;
}

let _instruments: Instruments | undefined;

function getMeter(): Meter {
  return metrics.getMeter(METER_NAME, METER_VERSION);
}

function buildInstruments(): Instruments {
  const meter = getMeter();

  return {
    messagesPublished: meter.createCounter(
      "nats_client_messages_published_total",
      {
        description: "Messages published, labeled by subject and outcome",
        valueType: ValueType.INT,
      },
    ),
    publishDuration: meter.createHistogram("nats_client_publish_duration_ms", {
      description:
        "Duration of publish() calls including JetStream ack round-trip",
      unit: "ms",
    }),
    publishRetries: meter.createCounter("nats_client_publish_retry_total", {
      description:
        "Retry attempts made by publishWithRetry, labeled by subject",
      valueType: ValueType.INT,
    }),
    messagesConsumed: meter.createCounter(
      "nats_client_messages_consumed_total",
      {
        description:
          "Messages processed by consumer handlers, labeled by subject and outcome",
        valueType: ValueType.INT,
      },
    ),
    consumeDuration: meter.createHistogram("nats_client_consume_duration_ms", {
      description: "Duration of consumer handler execution, labeled by subject",
      unit: "ms",
    }),
    redeliveries: meter.createCounter(
      "nats_client_messages_redelivered_total",
      {
        description:
          "Messages observed with a delivery count > 1, labeled by subject",
        valueType: ValueType.INT,
      },
    ),
    terminations: meter.createCounter("nats_client_messages_terminated_total", {
      description:
        "Messages terminated after exceeding maxDeliver (effective dead-letter), labeled by subject",
      valueType: ValueType.INT,
    }),
    naks: meter.createCounter("nats_client_consumer_nak_total", {
      description:
        "Explicit NAKs issued by consumer handlers, labeled by subject",
      valueType: ValueType.INT,
    }),
    reconnects: meter.createCounter("nats_client_reconnect_total", {
      description: "Shared NATS connection reconnect events",
      valueType: ValueType.INT,
    }),
    disconnects: meter.createCounter("nats_client_disconnect_total", {
      description: "Shared NATS connection disconnect events",
      valueType: ValueType.INT,
    }),
    connectionStatus: meter.createObservableGauge(
      "nats_client_connection_status",
      {
        description:
          "1 if the shared NATS connection is currently open, else 0",
      },
    ),
    streamMessages: meter.createObservableGauge("nats_client_stream_messages", {
      description:
        "Current message count per JetStream stream, labeled by stream",
    }),
    streamBytes: meter.createObservableGauge("nats_client_stream_bytes", {
      description: "Current byte size per JetStream stream, labeled by stream",
    }),
    consumerPending: meter.createObservableGauge(
      "nats_client_consumer_pending_messages",
      {
        description:
          "Messages waiting to be delivered, labeled by subject and durable consumer name",
      },
    ),
    consumerAckPending: meter.createObservableGauge(
      "nats_client_consumer_ack_pending_messages",
      {
        description:
          "Messages delivered but not yet acked, labeled by subject and durable consumer name",
      },
    ),
  };
}

function instruments(): Instruments {
  if (!_instruments) {
    _instruments = buildInstruments();
  }
  return _instruments;
}

// ---------------------------------------------------------------------------
// Producer-side recording
// ---------------------------------------------------------------------------

export function recordPublish(
  subject: string,
  status: "success" | "error",
  durationMs: number,
  method: "jetstream" | "fast" = "jetstream",
): void {
  const i = instruments();
  i.messagesPublished.add(1, { subject, status, method });
  if (method === "jetstream") {
    i.publishDuration.record(durationMs, { subject, status });
  }
}

export function recordPublishRetry(subject: string): void {
  instruments().publishRetries.add(1, { subject });
}

// ---------------------------------------------------------------------------
// Consumer-side recording
// ---------------------------------------------------------------------------

export function recordConsume(
  subject: string,
  status: "success" | "error",
  durationMs: number,
): void {
  const i = instruments();
  i.messagesConsumed.add(1, { subject, status });
  i.consumeDuration.record(durationMs, { subject, status });
}

export function recordRedelivery(subject: string): void {
  instruments().redeliveries.add(1, { subject });
}

export function recordTermination(subject: string): void {
  instruments().terminations.add(1, { subject });
}

export function recordNak(subject: string): void {
  instruments().naks.add(1, { subject });
}

// ---------------------------------------------------------------------------
// Connection-level recording
// ---------------------------------------------------------------------------

let connected = false;
let connectionGaugeRegistered = false;

export function setConnectionStatus(isConnected: boolean): void {
  connected = isConnected;
  const i = instruments();
  if (!connectionGaugeRegistered) {
    connectionGaugeRegistered = true;
    i.connectionStatus.addCallback((result) => {
      result.observe(connected ? 1 : 0);
    });
  }
}

export function recordReconnect(): void {
  instruments().reconnects.add(1);
}

export function recordDisconnect(): void {
  instruments().disconnects.add(1);
}

// ---------------------------------------------------------------------------
// Consumer lag (pending / ack-pending) — polled on scrape via ObservableGauge
// ---------------------------------------------------------------------------

interface LaggableConsumer {
  getConsumerRefs(): ReadonlyArray<{
    consumer: Consumer;
    subject: string;
    durableName: string;
  }>;
}

const lagSources = new Set<LaggableConsumer>();
let lagGaugesRegistered = false;

export function registerConsumerForLag(source: LaggableConsumer): void {
  lagSources.add(source);
  ensureLagGaugesRegistered();
}

export function unregisterConsumerForLag(source: LaggableConsumer): void {
  lagSources.delete(source);
}

function ensureLagGaugesRegistered(): void {
  if (lagGaugesRegistered) return;
  lagGaugesRegistered = true;

  const meter = getMeter();
  const i = instruments();

  // A real batch callback: one pass over all active consumers per scrape,
  // shared across both gauges, rather than each gauge re-fetching info().
  meter.addBatchObservableCallback(
    async (result) => {
      const refs = Array.from(lagSources).flatMap((s) => s.getConsumerRefs());
      const infos = await Promise.allSettled(
        refs.map(async (ref) => ({ ref, info: await ref.consumer.info() })),
      );

      for (const settled of infos) {
        if (settled.status !== "fulfilled") continue;
        const { ref, info } = settled.value;
        const attrs = { subject: ref.subject, durable_name: ref.durableName };
        result.observe(i.consumerPending, info.num_pending, attrs);
        result.observe(i.consumerAckPending, info.num_ack_pending, attrs);
      }
    },
    [i.consumerPending, i.consumerAckPending],
  );
}

// ---------------------------------------------------------------------------
// Stream size/message count — polled on scrape via ObservableGauge
// ---------------------------------------------------------------------------

let streamMetricsRegistered = false;

/**
 * Register observable gauges reporting per-stream message count and byte
 * size, sourced from JetStream's own stream state (no extra polling loop —
 * the OTel SDK only invokes these callbacks when a metrics reader scrapes).
 *
 * Call this once at app startup, after createNatsClient() has been called
 * at least once elsewhere in the process:
 *
 *   import { registerStreamMetrics } from "@build/nats";
 *   registerStreamMetrics();
 */
export function registerStreamMetrics(config?: Partial<NatsConfig>): void {
  if (streamMetricsRegistered) return;
  streamMetricsRegistered = true;

  const meter = getMeter();
  const i = instruments();
  const manager = createStreamManager(config);

  meter.addBatchObservableCallback(
    async (result) => {
      let streams;
      try {
        streams = await manager.listStreams();
      } catch (error) {
        console.error(
          "[NATS Metrics] Failed to list streams for metrics:",
          error,
        );
        return;
      }
      for (const stream of streams) {
        const attrs = { stream: stream.config.name };
        result.observe(i.streamMessages, stream.state.messages, attrs);
        result.observe(i.streamBytes, stream.state.bytes, attrs);
      }
    },
    [i.streamMessages, i.streamBytes],
  );
}

/**
 * Test-only escape hatch: forces the next call to instruments()/register*
 * to rebuild everything against whatever MeterProvider is globally
 * registered at that point. Not exported from index.ts on purpose.
 */
export function _resetMetricsForTests(): void {
  _instruments = undefined;
  connectionGaugeRegistered = false;
  lagGaugesRegistered = false;
  streamMetricsRegistered = false;
  lagSources.clear();
  connected = false;
}
