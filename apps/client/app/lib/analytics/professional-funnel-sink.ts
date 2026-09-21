import { metrics, trace } from "@opentelemetry/api";
import type {
  ProfessionalFunnelAnalyticsSink,
  ProfessionalFunnelEventName,
  ProfessionalFunnelEventPayload,
} from "./professional-funnel-events";

const meter = metrics.getMeter("build-market.professional-funnel");
const tracer = trace.getTracer("build-market.professional-funnel");

// Mirrors the `nats_client_*` naming convention already used for the
// JetStream cluster's OTel instrumentation (see MONITORING.md).
const eventsCounter = meter.createCounter("professional_funnel_events_total", {
  description:
    "Count of professional onboarding funnel events, by event name and outcome",
});

/**
 * Production sink for `professional_funnel.*` events (TODO 6). Emits both:
 *  - an OTel counter (`professional_funnel_events_total`), dashboard/alert
 *    friendly and cheap to query by event + status + errorCode; and
 *  - a span event on the active trace, so a single request/correlationId
 *    can be traced end-to-end alongside the existing NATS/JetStream spans.
 *
 * This intentionally does NOT forward to a third-party product-analytics
 * vendor (Segment/Amplitude/etc.) - none is configured in this codebase yet.
 * If one is added, wrap it in a second sink and fan out from
 * `getProductionFunnelSink()` below rather than changing call sites.
 */
export class OtelProfessionalFunnelSink implements ProfessionalFunnelAnalyticsSink {
  capture(
    event: ProfessionalFunnelEventName,
    payload: ProfessionalFunnelEventPayload,
  ): void {
    eventsCounter.add(1, {
      event,
      status: payload.status ?? "unknown",
      errorCode: payload.errorCode ?? "none",
      source: payload.source ?? "unknown",
    });

    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(event, {
        ...payload,
      } as Record<string, string | number | boolean>);
    } else {
      // No active span (e.g. a background worker context) - start a short
      // span purely to carry the event so it still shows up in trace search
      // by correlationId.
      tracer.startActiveSpan(event, (span) => {
        span.addEvent(event, {
          ...payload,
        } as Record<string, string | number | boolean>);
        span.end();
      });
    }
  }
}

let sharedSink: ProfessionalFunnelAnalyticsSink | null = null;

export function getProductionFunnelSink(): ProfessionalFunnelAnalyticsSink {
  if (!sharedSink) {
    sharedSink = new OtelProfessionalFunnelSink();
  }
  return sharedSink;
}
