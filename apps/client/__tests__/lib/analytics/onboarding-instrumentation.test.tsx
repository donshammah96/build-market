// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingAnalyticsProvider, useOnboardingAnalytics } from "@/lib/analytics/OnboardingAnalyticsContext";

const mockTrackStepCompleted = vi.fn();
const mockTrackDraftRestoreFailed = vi.fn();

const MockAnalytics = {
  trackStepCompleted: mockTrackStepCompleted,
  trackFieldAbandonment: vi.fn(),
  trackValidationError: vi.fn(),
  trackAsyncValidationFailure: vi.fn(),
  trackDraftRestoreFailed: mockTrackDraftRestoreFailed,
};

function TestConsumer() {
  const analytics = useOnboardingAnalytics();
  return (
    <div>
      <button
        onClick={() => analytics.trackStepCompleted("role_selection", "professional")}
      >
        Track Role
      </button>
      <button onClick={() => analytics.trackDraftRestoreFailed()}>
        Track Draft Failed
      </button>
    </div>
  );
}

describe("OnboardingAnalytics instrumentation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires trackStepCompleted when provider receives event", () => {
    render(
      <OnboardingAnalyticsProvider value={MockAnalytics}>
        <TestConsumer />
      </OnboardingAnalyticsProvider>,
    );

    fireEvent.click(screen.getByText("Track Role"));

    expect(mockTrackStepCompleted).toHaveBeenCalledTimes(1);
    expect(mockTrackStepCompleted).toHaveBeenCalledWith(
      "role_selection",
      "professional",
    );
  });

  it("fires trackDraftRestoreFailed when provider receives event", () => {
    render(
      <OnboardingAnalyticsProvider value={MockAnalytics}>
        <TestConsumer />
      </OnboardingAnalyticsProvider>,
    );

    fireEvent.click(screen.getByText("Track Draft Failed"));

    expect(mockTrackDraftRestoreFailed).toHaveBeenCalledTimes(1);
  });
});
