import { NextRequest, NextResponse } from "next/server";
import {
  PROFESSIONAL_FUNNEL_EVENTS,
  trackProfessionalFunnelEvent,
  type ProfessionalFunnelEventName,
} from "@/app/lib/analytics/professional-funnel-events";
import { getProductionFunnelSink } from "@/app/lib/analytics/professional-funnel-sink";
import { getClientLogger } from "@/app/lib/api/resilient-api";

const VALID_EVENTS = new Set<string>(Object.values(PROFESSIONAL_FUNNEL_EVENTS));

/**
 * Client-side funnel instrumentation boundary (TODO 6). The onboarding
 * wizard, upload UI, and pending-verification screen POST here at each of
 * the funnel events: landingCtaClicked, signUpStarted, signUpCompleted,
 * onboardingStarted, wizardStepCompleted, uploadSucceeded/Failed,
 * submitSucceeded/Failed, pendingVerificationViewed. verificationTransitioned
 * is emitted server-side directly from the verification worker instead (see
 * regulator-verification/outcomes.ts) since that transition
 * happens with no client present.
 *
 * Sanitization happens twice by design: sanitizeProfessionalFunnelPayload
 * strips PII keys defensively even though the client should never be
 * sending them, and event-name validation rejects anything not in the
 * PROFESSIONAL_FUNNEL_EVENTS contract outright.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const logger = getClientLogger();
  let body: { event?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.event || !VALID_EVENTS.has(body.event)) {
    return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  }

  try {
    trackProfessionalFunnelEvent(
      getProductionFunnelSink(),
      body.event as ProfessionalFunnelEventName,
      body.payload ?? {},
    );
  } catch (err) {
    logger.error("Failed to capture professional funnel event", err as Error, {
      event: body.event,
    });
    // Analytics failures must never surface as user-facing errors.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
