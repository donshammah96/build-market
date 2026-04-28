/**
 * Onboarding analytics event interface.
 * Provider-agnostic abstraction for conversion instrumentation.
 * Event payloads must never contain PII (field values).
 */

export interface OnboardingAnalytics {
  trackStepCompleted(stepName: string, userSegment: string): void;
  trackFieldAbandonment(fieldName: string): void;
  trackValidationError(fieldName: string): void;
  trackAsyncValidationFailure(fieldName: string): void;
  trackDraftRestoreFailed(): void;
}
