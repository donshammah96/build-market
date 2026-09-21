import { describe, expect, it, vi } from "vitest";

const add = vi.fn();
const addEvent = vi.fn();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => ({ createCounter: () => ({ add }) }),
  },
  trace: {
    getTracer: () => ({
      startActiveSpan: (_name: string, fn: (span: any) => void) =>
        fn({ addEvent, end: vi.fn() }),
    }),
    getActiveSpan: () => undefined,
  },
}));

const { OtelProfessionalFunnelSink } =
  await import("@/app/lib/analytics/professional-funnel-sink");

describe("OtelProfessionalFunnelSink", () => {
  it("increments the events counter with event/status/errorCode attributes", () => {
    const sink = new OtelProfessionalFunnelSink();
    sink.capture("professional_funnel.submit_failed" as any, {
      status: "failed",
      errorCode: "clerk_sync_failed",
    });

    expect(add).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        event: "professional_funnel.submit_failed",
        status: "failed",
        errorCode: "clerk_sync_failed",
      }),
    );
  });

  it("adds a span event carrying the payload when there is no active span", () => {
    const sink = new OtelProfessionalFunnelSink();
    sink.capture("professional_funnel.pending_verification_viewed" as any, {
      correlationId: "corr_1",
    });

    expect(addEvent).toHaveBeenCalledWith(
      "professional_funnel.pending_verification_viewed",
      expect.objectContaining({ correlationId: "corr_1" }),
    );
  });
});
