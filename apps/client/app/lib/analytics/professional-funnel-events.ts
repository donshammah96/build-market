export const PROFESSIONAL_FUNNEL_EVENTS = {
  landingCtaClicked: "professional_funnel.landing_cta_clicked",
  signUpStarted: "professional_funnel.sign_up_started",
  signUpCompleted: "professional_funnel.sign_up_completed",
  onboardingStarted: "professional_funnel.onboarding_started",
  wizardStepCompleted: "professional_funnel.wizard_step_completed",
  uploadSucceeded: "professional_funnel.upload_succeeded",
  uploadFailed: "professional_funnel.upload_failed",
  submitSucceeded: "professional_funnel.submit_succeeded",
  submitFailed: "professional_funnel.submit_failed",
  pendingVerificationViewed: "professional_funnel.pending_verification_viewed",
  verificationTransitioned: "professional_funnel.verification_transitioned",
} as const;

export type ProfessionalFunnelEventName =
  (typeof PROFESSIONAL_FUNNEL_EVENTS)[keyof typeof PROFESSIONAL_FUNNEL_EVENTS];

export type ProfessionalFunnelEventPayload = {
  correlationId?: string;
  source?: string;
  step?: string;
  role?: "professional";
  status?: string;
  errorCode?: string;
  retryable?: boolean;
};

const PII_KEYS = new Set([
  "email",
  "phone",
  "firstName",
  "lastName",
  "licenseNumber",
  "kraPin",
  "nationalId",
  "documentUrl",
  "previewUrl",
]);

export function sanitizeProfessionalFunnelPayload(
  payload: Record<string, unknown>,
): ProfessionalFunnelEventPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (PII_KEYS.has(key)) return false;
      if (value === undefined || value === null) return false;
      return ["string", "number", "boolean"].includes(typeof value);
    }),
  ) as ProfessionalFunnelEventPayload;
}

export interface ProfessionalFunnelAnalyticsSink {
  capture(
    event: ProfessionalFunnelEventName,
    payload: ProfessionalFunnelEventPayload,
  ): void;
}

export function trackProfessionalFunnelEvent(
  sink: ProfessionalFunnelAnalyticsSink,
  event: ProfessionalFunnelEventName,
  payload: Record<string, unknown>,
): void {
  sink.capture(event, sanitizeProfessionalFunnelPayload(payload));
}
