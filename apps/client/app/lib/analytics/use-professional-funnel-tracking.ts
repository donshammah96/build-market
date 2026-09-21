"use client";

import { useCallback } from "react";
import type {
  ProfessionalFunnelEventName,
  ProfessionalFunnelEventPayload,
} from "./professional-funnel-events";

/**
 * Client-side tracking hook for the professional onboarding funnel (TODO 6).
 * Fire-and-forget POST to /api/analytics/professional-funnel; never throws,
 * never blocks the UI, and uses `keepalive` so an event fired right before
 * navigation (e.g. uploadSucceeded just before routing to the next wizard
 * step) still has a chance to land.
 *
 * Usage at each funnel boundary:
 *   const track = useProfessionalFunnelTracking();
 *   track(PROFESSIONAL_FUNNEL_EVENTS.wizardStepCompleted, { step: "credentials" });
 */
export function useProfessionalFunnelTracking() {
  return useCallback(
    (
      event: ProfessionalFunnelEventName,
      payload: Record<string, unknown> = {},
    ) => {
      try {
        void fetch("/api/analytics/professional-funnel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload }),
          keepalive: true,
        });
      } catch {
        // Analytics must never break the funnel it's measuring.
      }
    },
    [],
  );
}

export type { ProfessionalFunnelEventPayload };
