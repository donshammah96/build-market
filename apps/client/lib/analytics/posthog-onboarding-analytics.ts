/**
 * PostHog implementation of OnboardingAnalytics.
 * Forwards onboarding events to PostHog for conversion instrumentation.
 * Used in production when NEXT_PUBLIC_POSTHOG_KEY is set.
 */

import posthog from "posthog-js";
import type { OnboardingAnalytics } from "./onboarding-events";

const capture = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    try {
      posthog.capture(event, properties);
    } catch {
      // No-op if PostHog is not initialized (e.g. missing key)
    }
  }
};

export const PostHogOnboardingAnalytics: OnboardingAnalytics = {
  trackStepCompleted(stepName: string, userSegment: string) {
    capture("onboarding_step_completed", { stepName, userSegment });
  },
  trackFieldAbandonment(fieldName: string) {
    capture("onboarding_field_abandonment", { fieldName });
  },
  trackValidationError(fieldName: string) {
    capture("onboarding_validation_error", { fieldName });
  },
  trackAsyncValidationFailure(fieldName: string) {
    capture("onboarding_async_validation_failure", { fieldName });
  },
  trackDraftRestoreFailed() {
    capture("onboarding_draft_restore_failed");
  },
};
