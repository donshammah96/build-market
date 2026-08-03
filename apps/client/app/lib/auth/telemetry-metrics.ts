import "server-only";
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("auth-slo-metrics", "1.0.0");

const clerkSyncLagHistogram = meter.createHistogram("auth.clerk.sync_lag", {
  description: "Lag duration for Clerk sync in milliseconds",
  unit: "ms",
});

const webhookReplayRejectCounter = meter.createCounter(
  "auth.webhook.replay_rejects",
  {
    description: "Count of webhook replay rejection events",
  },
);

const middlewareFallbackCounter = meter.createCounter(
  "auth.middleware.fallbacks",
  {
    description: "Count of middleware fallback events",
  },
);

export type AuthSloMetricsSummary = {
  clerkSyncLag: {
    totalEvents: number;
    totalLagMs: number;
    averageLagMs: number;
    maxLagMs: number;
  };
  webhookReplayRejects: {
    totalRejects: number;
    byReason: Record<string, number>;
  };
  middlewareFallbacks: {
    totalFallbacks: number;
    byType: Record<string, number>;
  };
};

class AuthTelemetryMetricsStore {
  private clerkSyncTotalEvents = 0;
  private clerkSyncTotalLagMs = 0;
  private clerkSyncMaxLagMs = 0;

  private webhookReplayTotalRejects = 0;
  private webhookReplayReasons: Map<string, number> = new Map();

  private middlewareTotalFallbacks = 0;
  private middlewareTypes: Map<string, number> = new Map();

  public recordClerkSyncLag(durationMs: number): void {
    if (durationMs < 0) return;
    this.clerkSyncTotalEvents++;
    this.clerkSyncTotalLagMs += durationMs;
    if (durationMs > this.clerkSyncMaxLagMs) {
      this.clerkSyncMaxLagMs = durationMs;
    }
    clerkSyncLagHistogram.record(durationMs);
  }

  public recordWebhookReplayReject(reason = "duplicate_event"): void {
    this.webhookReplayTotalRejects++;
    const current = this.webhookReplayReasons.get(reason) ?? 0;
    this.webhookReplayReasons.set(reason, current + 1);
    webhookReplayRejectCounter.add(1, { reason });
  }

  public recordMiddlewareFallback(
    reqPath: string,
    fallbackType = "unonboarded_redirect",
  ): void {
    this.middlewareTotalFallbacks++;
    const key = `${fallbackType}:${reqPath.slice(0, 32)}`;
    const current = this.middlewareTypes.get(key) ?? 0;
    this.middlewareTypes.set(key, current + 1);
    middlewareFallbackCounter.add(1, {
      req_path: reqPath.slice(0, 32),
      fallback_type: fallbackType,
    });
  }

  public getSummary(): AuthSloMetricsSummary {
    const averageLagMs =
      this.clerkSyncTotalEvents > 0
        ? Math.round(this.clerkSyncTotalLagMs / this.clerkSyncTotalEvents)
        : 0;

    const webhookReplayReasonsObj: Record<string, number> = {};
    this.webhookReplayReasons.forEach((val, key) => {
      webhookReplayReasonsObj[key] = val;
    });

    const middlewareTypesObj: Record<string, number> = {};
    this.middlewareTypes.forEach((val, key) => {
      middlewareTypesObj[key] = val;
    });

    return {
      clerkSyncLag: {
        totalEvents: this.clerkSyncTotalEvents,
        totalLagMs: this.clerkSyncTotalLagMs,
        averageLagMs,
        maxLagMs: this.clerkSyncMaxLagMs,
      },
      webhookReplayRejects: {
        totalRejects: this.webhookReplayTotalRejects,
        byReason: webhookReplayReasonsObj,
      },
      middlewareFallbacks: {
        totalFallbacks: this.middlewareTotalFallbacks,
        byType: middlewareTypesObj,
      },
    };
  }

  public reset(): void {
    this.clerkSyncTotalEvents = 0;
    this.clerkSyncTotalLagMs = 0;
    this.clerkSyncMaxLagMs = 0;

    this.webhookReplayTotalRejects = 0;
    this.webhookReplayReasons.clear();

    this.middlewareTotalFallbacks = 0;
    this.middlewareTypes.clear();
  }
}

const metricsStore = new AuthTelemetryMetricsStore();

export function recordClerkSyncLag(durationMs: number): void {
  metricsStore.recordClerkSyncLag(durationMs);
}

export function recordWebhookReplayReject(reason?: string): void {
  metricsStore.recordWebhookReplayReject(reason);
}

export function recordMiddlewareFallback(
  reqPath: string,
  fallbackType?: string,
): void {
  metricsStore.recordMiddlewareFallback(reqPath, fallbackType);
}

export function getAuthSloMetricsSummary(): AuthSloMetricsSummary {
  return metricsStore.getSummary();
}

export function resetAuthSloMetrics(): void {
  metricsStore.reset();
}
