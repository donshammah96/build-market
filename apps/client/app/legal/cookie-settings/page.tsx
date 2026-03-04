"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cookie, Shield, Lock } from "lucide-react";
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
        relative inline-flex h-7 w-12 items-center rounded-full transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-emerald-500" : "bg-zinc-600"}
      `}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// =============================================================================
// CATEGORY DEFINITIONS
// =============================================================================

interface CookieDetail {
  name: string;
  purpose: string;
  expiry: string;
}

interface CategoryConfig {
  key: "necessary" | keyof Omit<CookieConsent, "necessary">;
  label: string;
  description: string;
  locked: boolean;
  emoji: string;
  borderColor: string;
  cookies: CookieDetail[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: "necessary",
    label: "Strictly Necessary",
    description:
      "These cookies are essential for the website to function. They enable core features like authentication, security, and accessibility. You cannot disable them — and honestly, you wouldn't want to.",
    locked: true,
    emoji: "🔒",
    borderColor: "border-zinc-500/30",
    cookies: [
      {
        name: "__clerk_session",
        purpose: "Authentication session management",
        expiry: "Session",
      },
      {
        name: "__clerk_db_jwt",
        purpose: "Secure authentication token",
        expiry: "7 days",
      },
      {
        name: "bm_cookie_consent",
        purpose: "Stores your cookie preferences",
        expiry: "1 year",
      },
    ],
  },
  {
    key: "analytics",
    label: "Analytics & Performance",
    description:
      "These cookies help us understand how visitors interact with Build Market. They collect anonymous data so we can improve the user experience. No personal data is shared with third parties.",
    locked: false,
    emoji: "📊",
    borderColor: "border-emerald-500/20",
    cookies: [
      {
        name: "_ga / _ga_*",
        purpose: "Google Analytics — page views and user journeys",
        expiry: "2 years",
      },
      {
        name: "_gid",
        purpose: "Google Analytics — session tracking",
        expiry: "24 hours",
      },
      {
        name: "bm_ab_group",
        purpose: "A/B testing group assignment",
        expiry: "30 days",
      },
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Advertising",
    description:
      "These cookies are used to deliver relevant ads and measure campaign performance. We don't sell your data — we just want to stop showing you ads for things you've already bought.",
    locked: false,
    emoji: "📣",
    borderColor: "border-amber-500/20",
    cookies: [
      {
        name: "_fbp",
        purpose: "Facebook Pixel — ad targeting",
        expiry: "3 months",
      },
      {
        name: "_gcl_au",
        purpose: "Google Ads — conversion tracking",
        expiry: "3 months",
      },
    ],
  },
  {
    key: "functional",
    label: "Functional & Preferences",
    description:
      "These cookies remember your preferences so the site works better for you. Think of them as the site's short-term memory — without them, it's like meeting someone who forgot your name. Every. Single. Time.",
    locked: false,
    emoji: "⚙️",
    borderColor: "border-cyan-500/20",
    cookies: [
      {
        name: "bm_theme",
        purpose: "Remembers dark/light mode preference",
        expiry: "1 year",
      },
      {
        name: "bm_locale",
        purpose: "Language and region preference",
        expiry: "1 year",
      },
    ],
  },
];

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function CookieSettingsPage() {
  const { consent, acceptAll, rejectAll, savePreferences, isSyncing } =
    useCookieConsent();

  const [localPrefs, setLocalPrefs] = useState({
    analytics: consent.analytics,
    marketing: consent.marketing,
    functional: consent.functional,
  });

  const [saved, setSaved] = useState(false);

  // Sync local state when context changes
  useEffect(() => {
    setLocalPrefs({
      analytics: consent.analytics,
      marketing: consent.marketing,
      functional: consent.functional,
    });
  }, [consent.analytics, consent.marketing, consent.functional]);

  const handleSave = () => {
    savePreferences(localPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAcceptAll = () => {
    acceptAll();
    setLocalPrefs({ analytics: true, marketing: true, functional: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    rejectAll();
    setLocalPrefs({ analytics: false, marketing: false, functional: false });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge */}
      <div className="flex justify-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Cookie className="w-3.5 h-3.5" />
          Cookie Settings
        </span>
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-5xl font-bold text-center leading-tight mb-6">
        Your Cookies,
        <br />
        <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
          Your Rules.
        </span>
      </h1>

      <p className="text-center text-zinc-400 text-lg max-w-xl mx-auto mb-12">
        We believe in transparency. Here&apos;s exactly what each cookie does,
        who baked it, and how long it sticks around. Toggle them on or off — no
        guilt trip, we promise.
      </p>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
        <button
          type="button"
          onClick={handleAcceptAll}
          disabled={isSyncing}
          className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          Accept All
        </button>
        <button
          type="button"
          onClick={handleRejectAll}
          disabled={isSyncing}
          className="px-6 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Reject All Optional
        </button>
      </div>

      {/* Success toast */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center text-sm text-emerald-400 font-medium"
        >
          ✓ Preferences saved successfully
        </motion.div>
      )}

      {/* Category Cards */}
      <div className="space-y-4">
        {CATEGORIES.map((cat, i) => (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`bg-white/[0.03] backdrop-blur-sm border ${cat.borderColor} rounded-2xl overflow-hidden`}
          >
            {/* Category Header */}
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-xl">{cat.emoji}</span>
                    <h2 className="text-lg font-bold text-white">
                      {cat.label}
                    </h2>
                    {cat.locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase tracking-wider font-semibold">
                        <Lock className="w-2.5 h-2.5" /> Always On
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
                <div className="flex-shrink-0 pt-1">
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
              </div>

              {/* Cookie Details Table */}
              {cat.cookies.length > 0 && (
                <div className="mt-4 bg-white/[0.02] rounded-lg border border-white/5 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left py-2 px-3 text-zinc-500 font-medium">
                          Cookie
                        </th>
                        <th className="text-left py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">
                          Purpose
                        </th>
                        <th className="text-right py-2 px-3 text-zinc-500 font-medium">
                          Expiry
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.cookies.map((cookie) => (
                        <tr
                          key={cookie.name}
                          className="border-b border-white/[0.03] last:border-0"
                        >
                          <td className="py-2 px-3 text-emerald-400 font-mono">
                            {cookie.name}
                          </td>
                          <td className="py-2 px-3 text-zinc-500 hidden sm:table-cell">
                            {cookie.purpose}
                          </td>
                          <td className="py-2 px-3 text-zinc-500 text-right">
                            {cookie.expiry}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Save button */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield className="w-3.5 h-3.5" />
          <span>Compliant with GDPR &amp; Kenya Data Protection Act 2019</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSyncing}
          className="px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {isSyncing ? "Saving..." : "Save Preferences"}
        </button>
      </div>

      {/* Bottom link */}
      <div className="text-center mt-12 space-y-3">
        <p className="text-sm text-zinc-500">
          Want to know how we handle your data beyond cookies?
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/legal/privacy"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
          >
            🔒 Privacy Policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-zinc-400 text-sm hover:text-white transition-colors"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
