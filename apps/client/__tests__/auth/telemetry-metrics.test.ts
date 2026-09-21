import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuthSloMetricsSummary,
  recordClerkSyncLag,
  recordMiddlewareFallback,
  recordWebhookReplayReject,
  resetAuthSloMetrics,
} from "@/app/lib/auth/telemetry-metrics";

vi.mock("server-only", () => ({}));

describe("Auth SLO Telemetry Metrics Module", () => {
  beforeEach(() => {
    resetAuthSloMetrics();
  });

  it("records Clerk sync lag durations and calculates averages", () => {
    recordClerkSyncLag(100);
    recordClerkSyncLag(300);
    recordClerkSyncLag(200);

    const summary = getAuthSloMetricsSummary();

    expect(summary.clerkSyncLag.totalEvents).toBe(3);
    expect(summary.clerkSyncLag.totalLagMs).toBe(600);
    expect(summary.clerkSyncLag.averageLagMs).toBe(200);
    expect(summary.clerkSyncLag.maxLagMs).toBe(300);
  });

  it("records webhook replay rejects with reason buckets", () => {
    recordWebhookReplayReject("duplicate_event_id");
    recordWebhookReplayReject("duplicate_event_id");
    recordWebhookReplayReject("invalid_signature");

    const summary = getAuthSloMetricsSummary();

    expect(summary.webhookReplayRejects.totalRejects).toBe(3);
    expect(summary.webhookReplayRejects.byReason["duplicate_event_id"]).toBe(2);
    expect(summary.webhookReplayRejects.byReason["invalid_signature"]).toBe(1);
  });

  it("records middleware fallbacks and truncates long path strings", () => {
    recordMiddlewareFallback("/dashboard/overview", "unonboarded_redirect");
    recordMiddlewareFallback("/dashboard/overview", "unonboarded_redirect");
    recordMiddlewareFallback("/settings", "maintenance_redirect");

    const summary = getAuthSloMetricsSummary();

    expect(summary.middlewareFallbacks.totalFallbacks).toBe(3);
    expect(
      summary.middlewareFallbacks.byType[
        "unonboarded_redirect:/dashboard/overview"
      ],
    ).toBe(2);
    expect(
      summary.middlewareFallbacks.byType["maintenance_redirect:/settings"],
    ).toBe(1);
  });

  it("ignores negative Clerk sync lag durations", () => {
    recordClerkSyncLag(-50);
    recordClerkSyncLag(150);

    const summary = getAuthSloMetricsSummary();
    expect(summary.clerkSyncLag.totalEvents).toBe(1);
    expect(summary.clerkSyncLag.totalLagMs).toBe(150);
    expect(summary.clerkSyncLag.averageLagMs).toBe(150);
    expect(summary.clerkSyncLag.maxLagMs).toBe(150);
  });

  it("uses default reason when recordWebhookReplayReject is called without parameters", () => {
    recordWebhookReplayReject();

    const summary = getAuthSloMetricsSummary();
    expect(summary.webhookReplayRejects.totalRejects).toBe(1);
    expect(summary.webhookReplayRejects.byReason["duplicate_event"]).toBe(1);
  });

  it("truncates paths longer than 32 characters in middleware fallback metrics", () => {
    const longPath = "/dashboard/overview/projects/1234567890/details";
    recordMiddlewareFallback(longPath, "unonboarded_redirect");

    const summary = getAuthSloMetricsSummary();
    const truncatedKey = `unonboarded_redirect:${longPath.slice(0, 32)}`;
    expect(summary.middlewareFallbacks.totalFallbacks).toBe(1);
    expect(summary.middlewareFallbacks.byType[truncatedKey]).toBe(1);
  });

  it("resets metrics cleanly", () => {
    recordClerkSyncLag(500);
    recordWebhookReplayReject("test");
    recordMiddlewareFallback("/test", "test");

    resetAuthSloMetrics();

    const summary = getAuthSloMetricsSummary();
    expect(summary.clerkSyncLag.totalEvents).toBe(0);
    expect(summary.webhookReplayRejects.totalRejects).toBe(0);
    expect(summary.middlewareFallbacks.totalFallbacks).toBe(0);
  });
});
