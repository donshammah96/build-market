# Monitoring: `@build/nats` application metrics

This package now emits OTel metrics for publish/consume outcomes,
redeliveries, terminations, NAKs, connection state, JetStream stream size,
and per-consumer lag (pending / ack-pending message counts).

## How this relates to the infra-level exporter

This package's metrics work standalone — they don't depend on anything
else being deployed. But it's worth being clear about what they do and
don't cover, because there's a separate piece you don't have set up yet:
`prometheus-nats-exporter` (or the NATS Helm chart's built-in
`promExporter`), which would scrape the NATS _server's_ `/varz`,
`/connz`, `/jsz`, etc. and answer "is the NATS server itself healthy."
(Steps for that are in the `nats-monitoring-setup.md` doc from earlier —
happy to walk through applying it whenever you want that layer too.)

The metrics in this package answer a different question: "are _our_
producers and consumers keeping up." They're namespaced `nats_client_*`
specifically so that if you do add the server exporter later, the two
never collide in the same Prometheus instance.

| Question                                                | Source                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Is the NATS cluster up, quorate, has enough disk?       | `prometheus-nats-exporter` (`nats_varz_*`) — not yet deployed                                    |
| Are our consumers falling behind on a specific subject? | This package (`nats_client_consumer_pending_messages`)                                           |
| Are publishes failing or slow for a specific service?   | This package (`nats_client_publish_duration_ms`, `nats_client_messages_published_total`)         |
| Are messages being redelivered / dead-lettered?         | This package (`nats_client_messages_redelivered_total`, `nats_client_messages_terminated_total`) |

## Why nothing shows up by default

This package only imports `@opentelemetry/api`, which is a stable, tiny
interface package. Calling `meter.createCounter(...)` against it without a
registered `MeterProvider` returns a safe no-op instrument — nothing
throws, nothing leaks, but nothing is recorded either. You need to
register a real `MeterProvider` once, at process startup, in whichever
service imports this package (same pattern you're presumably already
using for tracing).

## Bootstrap snippet (per service)

```ts
// otel-metrics.ts — import this before anything from @build/nats
import { metrics } from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";

// PrometheusExporter starts its own HTTP server (default :9464/metrics) —
// point your PodMonitor/ServiceMonitor at this port, separately from the
// NATS server exporter's port.
const prometheusExporter = new PrometheusExporter({ port: 9464 });

const meterProvider = new MeterProvider({
  readers: [prometheusExporter],
});

metrics.setGlobalMeterProvider(meterProvider);
```

Add to your service's dependencies:

```bash
pnpm add @opentelemetry/sdk-metrics @opentelemetry/exporter-prometheus --filter <your-service>
```

These go in the _consuming service_, not in `@build/nats` itself — the
package stays SDK-agnostic (a service could just as easily export via
OTLP to a collector instead of the Prometheus pull model).

## Enabling stream-size metrics

Everything except stream-level gauges wires up automatically as a side
effect of using `JetStreamProducer` / `JetStreamConsumer` / `createNatsClient`.

Stream size/message-count metrics poll `jsm.streams.list()` on every
metrics scrape, so they're opt-in via a flag on `initializeStreams()`
rather than automatic — enable it from one designated process (e.g. an
ops/health service), not every replica that calls `initializeStreams()`
on boot:

```ts
import { initializeStreams } from "@build/nats";

// In your one ops/monitoring-owning service:
await initializeStreams(config, { withMetrics: true });

// Everywhere else, unchanged:
await initializeStreams(config);
```

## Suggested PromQL / alerts once wired up

```promql
# Consumer falling behind — pending messages growing on a subject
nats_client_consumer_pending_messages > 1000

# Redelivery storm — a handler is repeatedly failing
rate(nats_client_messages_redelivered_total[5m]) > 5

# Effective dead-letter rate — messages exhausting maxDeliver
rate(nats_client_messages_terminated_total[15m]) > 0

# Publish latency creeping up (JetStream ack round-trip)
histogram_quantile(0.95, rate(nats_client_publish_duration_ms_bucket[5m]))

# Connection flapping
increase(nats_client_reconnect_total[10m]) > 3
```

If you do stand up the server-level exporter later, pair the first alert
above with its `nats_server_jetstream_stats_file_store_bytes` panel —
rising pending count _and_ rising storage together usually means a
consumer is stuck, not just slow. Until then, `nats_client_consumer_pending_messages`
alone is still a solid canary for stuck consumers.
