import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("apps-admin");

export const actionOutcomeCounter = meter.createCounter(
  "admin.action.outcome",
  {
    description: "Tracks server action outcomes",
  },
);

export const actionDurationHistogram = meter.createHistogram(
  "admin.action.duration",
  {
    description: "Tracks server action latency/durations",
    unit: "ms",
  },
);

export const routeOutcomeCounter = meter.createCounter("admin.route.outcome", {
  description: "Tracks total route request outcomes",
});

export const auditWriteCounter = meter.createCounter("admin.audit.write", {
  description: "Tracks audit log write outcomes",
});

export const jobAttemptCounter = meter.createCounter("admin.job.attempt", {
  description: "Tracks background job execution attempts",
});

export const jobDurationHistogram = meter.createHistogram(
  "admin.job.duration",
  {
    description: "Tracks background job durations",
    unit: "ms",
  },
);

export const queueLagCounter = meter.createUpDownCounter("admin.queue.lag", {
  description: "Tracks background queue lag",
});
