"use client";

import React, { createContext, useContext } from "react";
import type { OnboardingAnalytics } from "./onboarding-events";

const noop = () => {};

const NullAnalytics: OnboardingAnalytics = {
  trackStepCompleted: noop,
  trackFieldAbandonment: noop,
  trackValidationError: noop,
  trackAsyncValidationFailure: noop,
  trackDraftRestoreFailed: noop,
};

const OnboardingAnalyticsContext =
  createContext<OnboardingAnalytics>(NullAnalytics);

export function OnboardingAnalyticsProvider({
  value,
  children,
}: {
  value: OnboardingAnalytics;
  children: React.ReactNode;
}) {
  return (
    <OnboardingAnalyticsContext.Provider value={value}>
      {children}
    </OnboardingAnalyticsContext.Provider>
  );
}

export function useOnboardingAnalytics(): OnboardingAnalytics {
  return useContext(OnboardingAnalyticsContext);
}

export { NullAnalytics };
