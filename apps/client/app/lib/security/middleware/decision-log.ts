import type { NextRequest } from "next/server";

export type MiddlewareDecisionEvent =
  | "mw_dev_bypass"
  | "mw_allow_public"
  | "mw_allow_default"
  | "mw_redirect_signin"
  | "mw_redirect_onboarding"
  | "mw_redirect_dashboard"
  | "mw_redirect_maintenance"
  | "mw_redirect_registration_closed"
  | "mw_redirect_professional_signup_closed"
  | "mw_allow_onboarding"
  | "mw_allow_protected"
  | "mw_redirect_professional_pending_verification"
  | "mw_allow_professional_pending_verification"
  | "mw_redirect_professional_dashboard";

export function logMiddlewareDecision(
  req: NextRequest,
  event: MiddlewareDecisionEvent,
  metadata?: Record<string, unknown>,
) {
  console.info("[MiddlewareDecision]", {
    event,
    pathname: req.nextUrl.pathname,
    method: req.method,
    ...(metadata ?? {}),
  });
}
