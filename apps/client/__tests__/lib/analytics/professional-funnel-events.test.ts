import { describe, expect, it, vi } from "vitest";
import {
  PROFESSIONAL_FUNNEL_EVENTS,
  sanitizeProfessionalFunnelPayload,
  trackProfessionalFunnelEvent,
} from "@/app/lib/analytics/professional-funnel-events";

describe("professional funnel analytics", () => {
  it("defines the phase 9 funnel event contract", () => {
    expect(Object.values(PROFESSIONAL_FUNNEL_EVENTS)).toEqual([
      "professional_funnel.landing_cta_clicked",
      "professional_funnel.sign_up_started",
      "professional_funnel.sign_up_completed",
      "professional_funnel.onboarding_started",
      "professional_funnel.wizard_step_completed",
      "professional_funnel.upload_succeeded",
      "professional_funnel.upload_failed",
      "professional_funnel.submit_succeeded",
      "professional_funnel.submit_failed",
      "professional_funnel.pending_verification_viewed",
      "professional_funnel.verification_transitioned",
    ]);
  });

  it("sanitizes PII before analytics capture", () => {
    expect(
      sanitizeProfessionalFunnelPayload({
        correlationId: "corr_1",
        email: "pro@example.com",
        licenseNumber: "NCA-123",
        previewUrl: "https://signed.example/doc",
        step: "credentials",
        nested: { unsafe: true },
      }),
    ).toEqual({ correlationId: "corr_1", step: "credentials" });
  });

  it("captures sanitized events", () => {
    const capture = vi.fn();
    trackProfessionalFunnelEvent(
      { capture },
      PROFESSIONAL_FUNNEL_EVENTS.submitFailed,
      {
        errorCode: "clerk_sync_failed",
        email: "hidden@example.com",
        retryable: true,
      },
    );

    expect(capture).toHaveBeenCalledWith("professional_funnel.submit_failed", {
      errorCode: "clerk_sync_failed",
      retryable: true,
    });
  });
});
