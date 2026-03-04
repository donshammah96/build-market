"use client";

import { useContext } from "react";
import {
  CookieConsentContext,
  type CookieConsentState,
} from "@/components/providers/CookieConsentProvider";

/**
 * Hook to access cookie consent state and actions.
 *
 * @example
 * ```tsx
 * const { consent, acceptAll, rejectAll, hasConsented } = useCookieConsent();
 *
 * // Conditionally load analytics
 * if (consent.analytics) {
 *   loadGoogleAnalytics();
 * }
 * ```
 */
export function useCookieConsent(): CookieConsentState {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error(
      "useCookieConsent must be used within a <CookieConsentProvider>",
    );
  }
  return context;
}
