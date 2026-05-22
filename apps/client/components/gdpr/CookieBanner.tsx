"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, ChevronDown, ChevronUp, Shield } from "lucide-react";
import Link from "next/link";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import type { CookieConsent } from "@/components/providers/CookieConsentProvider";

// =============================================================================
// TOGGLE SWITCH
// =============================================================================

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-emerald-500" : "bg-zinc-600"}
      `}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

interface CategoryInfo {
  key: keyof Omit<CookieConsent, "necessary">;
  label: string;
  description: string;
  locked?: boolean;
}

const CATEGORIES: (
  | CategoryInfo
  | { key: "necessary"; label: string; description: string; locked: true }
)[] = [
  {
    key: "necessary",
    label: "Necessary",
    description:
      "Required for the site to function. Includes authentication, security tokens, and this consent cookie.",
    locked: true,
  },
  {
    key: "analytics",
    label: "Analytics",
    description:
      "Help us understand how you use Build Market so we can improve the experience.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description:
      "Allow us to show you relevant ads and measure campaign effectiveness.",
  },
  {
    key: "functional",
    label: "Functional",
    description:
      "Remember your preferences like theme, language, and A/B test groups.",
  },
];

// =============================================================================
// COOKIE BANNER
// =============================================================================

export function CookieBanner() {
  const { consent, hasConsented, acceptAll, rejectAll, savePreferences } =
    useCookieConsent();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [localPrefs, setLocalPrefs] = useState({
    analytics: consent.analytics,
    marketing: consent.marketing,
    functional: consent.functional,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render during SSR to prevent hydration mismatch,
  // and don't render if user has already consented
  if (!isMounted || hasConsented) return null;

  const handleCustomizeSave = () => {
    savePreferences(localPrefs);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="cookie-banner"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 inset-x-0 z-[9999] p-4 md:p-6"
      >
        <div className="max-w-3xl mx-auto bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Main Row */}
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 flex-shrink-0 mt-0.5">
                <Cookie className="w-5 h-5 text-emerald-400" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-emerald-400 sm:hidden" />
                  We value your privacy
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We use cookies to keep the site running and, with your
                  permission, to understand how you use it.{" "}
                  <Link
                    href="/legal/cookie-settings"
                    className="text-emerald-400 hover:underline"
                  >
                    Learn more
                  </Link>
                </p>
              </div>

              {/* Close (rejects all) */}
              <button
                type="button"
                onClick={rejectAll}
                className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                aria-label="Reject all cookies"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 sm:ml-14">
              <button
                type="button"
                onClick={acceptAll}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
              >
                Accept All
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                aria-expanded={isExpanded}
              >
                Customize
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                Reject All
              </button>
            </div>
          </div>

          {/* Expandable Category Panel */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="customize-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  transition: {
                    height: { duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }, // Decelerate on open
                    opacity: { duration: 0.3, delay: 0.05 },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }, // Smooth ease-in-out on close
                    opacity: { duration: 0.2 }, // Fade text out quickly to avoid overlap
                  },
                }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/5 px-5 md:px-6 py-4 flex flex-col gap-3">
                  {CATEGORIES.map((cat) => (
                    <div
                      key={cat.key}
                      className="flex items-center justify-between gap-4 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {cat.label}
                          </span>
                          {cat.locked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase tracking-wider font-semibold">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                          {cat.description}
                        </p>
                      </div>
                      <Toggle
                        checked={
                          cat.key === "necessary"
                            ? true
                            : localPrefs[cat.key as keyof typeof localPrefs]
                        }
                        onChange={(v) => {
                          if (cat.key !== "necessary") {
                            setLocalPrefs((prev) => ({
                              ...prev,
                              [cat.key]: v,
                            }));
                          }
                        }}
                        disabled={cat.locked}
                      />
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Shield className="w-3 h-3" />
                      Kenya DPA Compliant
                    </div>
                    <button
                      type="button"
                      onClick={handleCustomizeSave}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
