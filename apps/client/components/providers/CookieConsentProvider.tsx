"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { consentClient } from "@/lib/facades/consent-client";

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "cookie-consent-preferences",
] as const;

// =============================================================================
// TYPES
// =============================================================================

export interface CookieConsent {
  necessary: true; // Always true, cannot be toggled
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export interface CookieConsentState {
  /** Current consent preferences */
  consent: CookieConsent;
  /** Whether the user has made an active choice (banner should be hidden) */
  hasConsented: boolean;
  /** Whether consent is being synced to the backend */
  isSyncing: boolean;
  /** Update a single consent category */
  updateConsent: (
    category: keyof Omit<CookieConsent, "necessary">,
    value: boolean,
  ) => void;
  /** Accept all optional cookies */
  acceptAll: () => void;
  /** Reject all optional cookies */
  rejectAll: () => void;
  /** Save current preferences (triggers backend sync + dismisses banner) */
  savePreferences: (preferences: Omit<CookieConsent, "necessary">) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = "bm_cookie_consent";

const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
};

interface StoredConsent extends CookieConsent {
  timestamp: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

export const CookieConsentContext = createContext<CookieConsentState | null>(
  null,
);

// =============================================================================
// HELPERS
// =============================================================================

function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive cookie-consent preferences.
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    // Validate shape
    if (typeof parsed.analytics !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return;
  const stored: StoredConsent = {
    ...consent,
    necessary: true, // enforce
    timestamp: new Date().toISOString(),
  };
  // SECURITY_PERSISTENCE_ALLOWLIST: Persists non-sensitive cookie-consent preferences.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Map frontend categories to backend ConsentType values.
 * Only maps categories that have a corresponding DB type.
 */
function toApiPayload(consent: CookieConsent) {
  return [
    { type: "ANALYTICS_COOKIES" as const, granted: consent.analytics },
    { type: "MARKETING_EMAIL" as const, granted: consent.marketing },
    { type: "MARKETING_SMS" as const, granted: consent.marketing },
  ];
}

// =============================================================================
// PROVIDER
// =============================================================================

export function CookieConsentProvider({
  children,
  isSignedIn = false,
}: {
  children: React.ReactNode;
  isSignedIn?: boolean;
}) {
  const [consent, setConsent] = useState<CookieConsent>(DEFAULT_CONSENT);
  const [hasConsented, setHasConsented] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setConsent(stored);
      setHasConsented(true);
    }
  }, []);

  // Sync to backend for authenticated users
  const syncToBackend = useCallback(
    async (newConsent: CookieConsent) => {
      if (!isSignedIn) return;
      setIsSyncing(true);
      try {
        const result = await consentClient.updateConsents({
          consents: toApiPayload(newConsent),
        });
        if (!result.success) {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error("[CookieConsent] Failed to sync to backend:", err);
      } finally {
        setIsSyncing(false);
      }
    },
    [isSignedIn],
  );

  const persistAndSync = useCallback(
    (newConsent: CookieConsent) => {
      setConsent(newConsent);
      setHasConsented(true);
      writeStoredConsent(newConsent);
      syncToBackend(newConsent);
    },
    [syncToBackend],
  );

  const updateConsent = useCallback(
    (category: keyof Omit<CookieConsent, "necessary">, value: boolean) => {
      const updated = {
        ...consent,
        [category]: value,
        necessary: true as const,
      };
      persistAndSync(updated);
    },
    [consent, persistAndSync],
  );

  const acceptAll = useCallback(() => {
    persistAndSync({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    });
  }, [persistAndSync]);

  const rejectAll = useCallback(() => {
    persistAndSync({ ...DEFAULT_CONSENT });
  }, [persistAndSync]);

  const savePreferences = useCallback(
    (preferences: Omit<CookieConsent, "necessary">) => {
      persistAndSync({ ...preferences, necessary: true });
    },
    [persistAndSync],
  );

  const value = useMemo<CookieConsentState>(
    () => ({
      consent,
      hasConsented,
      isSyncing,
      updateConsent,
      acceptAll,
      rejectAll,
      savePreferences,
    }),
    [
      consent,
      hasConsented,
      isSyncing,
      updateConsent,
      acceptAll,
      rejectAll,
      savePreferences,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}
