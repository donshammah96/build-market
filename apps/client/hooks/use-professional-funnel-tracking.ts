"use client";

import { useCallback } from "react";
import {
  PROFESSIONAL_FUNNEL_EVENTS,
  type ProfessionalFunnelEventName,
} from "@/app/lib/analytics/professional-funnel-events";

/**
 * Client-side React hook for tracking professional onboarding funnel events (§1 Phase 9).
 * Posts sanitized event payloads to `/api/analytics/professional-funnel`.
 */
export function useProfessionalFunnelTracking() {
  const trackEvent = useCallback(
    async (
      event: ProfessionalFunnelEventName,
      payload: Record<string, unknown> = {},
    ) => {
      try {
        await fetch("/api/analytics/professional-funnel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload }),
        });
      } catch (error) {
        // Silently swallow analytics dispatch errors to avoid disrupting UX
        console.warn("[FunnelAnalytics] Failed to emit event", event, error);
      }
    },
    [],
  );

  return {
    trackLandingCtaClicked: useCallback(
      (source?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.landingCtaClicked, { source }),
      [trackEvent],
    ),
    trackSignUpStarted: useCallback(
      (source?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.signUpStarted, { source }),
      [trackEvent],
    ),
    trackSignUpCompleted: useCallback(
      (source?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.signUpCompleted, { source }),
      [trackEvent],
    ),
    trackOnboardingStarted: useCallback(
      (source?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.onboardingStarted, { source }),
      [trackEvent],
    ),
    trackWizardStepCompleted: useCallback(
      (step: string, payload: Record<string, unknown> = {}) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.wizardStepCompleted, {
          step,
          ...payload,
        }),
      [trackEvent],
    ),
    trackUploadSucceeded: useCallback(
      (fileType: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.uploadSucceeded, {
          step: fileType,
        }),
      [trackEvent],
    ),
    trackUploadFailed: useCallback(
      (fileType: string, errorCode: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.uploadFailed, {
          step: fileType,
          errorCode,
        }),
      [trackEvent],
    ),
    trackSubmitSucceeded: useCallback(
      (correlationId?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.submitSucceeded, {
          correlationId,
        }),
      [trackEvent],
    ),
    trackSubmitFailed: useCallback(
      (errorCode: string, correlationId?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.submitFailed, {
          errorCode,
          correlationId,
        }),
      [trackEvent],
    ),
    trackPendingVerificationViewed: useCallback(
      (status?: string) =>
        trackEvent(PROFESSIONAL_FUNNEL_EVENTS.pendingVerificationViewed, {
          status,
        }),
      [trackEvent],
    ),
  };
}
