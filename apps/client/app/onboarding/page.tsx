"use client";

import { useOnboarding } from "./_hooks/useOnboarding";
import { OnboardingView } from "./_components/OnboardingView";
import {
  OnboardingAnalyticsProvider,
  NullAnalytics,
} from "@/lib/analytics/OnboardingAnalyticsContext";
import { PostHogOnboardingAnalytics } from "@/lib/analytics/posthog-onboarding-analytics";
import { envConfig } from "@/lib/env";

const onboardingAnalytics =
  envConfig.isProd && envConfig.analytics.posthogKey.length > 0
    ? PostHogOnboardingAnalytics
    : NullAnalytics;

export default function Onboarding() {
  const {
    step,
    setStep,
    role,
    submitting,
    showCancelDialog,
    setShowCancelDialog,
    handleRoleSelect,
    handleCancelOnboarding,
    handleSkip,
    handleSubmit,
  } = useOnboarding();

  return (
    <OnboardingAnalyticsProvider value={onboardingAnalytics}>
      <div className="dark min-h-screen">
        <OnboardingView
          step={step}
          setStep={setStep}
          role={role}
          submitting={submitting}
          showCancelDialog={showCancelDialog}
          setShowCancelDialog={setShowCancelDialog}
          handleRoleSelect={handleRoleSelect}
          handleCancelOnboarding={handleCancelOnboarding}
          handleSkip={handleSkip}
          handleSubmit={handleSubmit}
        />
      </div>
    </OnboardingAnalyticsProvider>
  );
}
