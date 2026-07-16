"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cookie, Shield } from "lucide-react";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { CookieCategoryCard, CATEGORIES } from "./_components";

export default function CookieSettingsPage() {
  const { consent, acceptAll, rejectAll, savePreferences, isSyncing } =
    useCookieConsent();

  const [localPrefs, setLocalPrefs] = useState({
    analytics: consent.analytics,
    marketing: consent.marketing,
    functional: consent.functional,
  });

  const [saved, setSaved] = useState(false);

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
        <span className="bg-linear-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
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
          <CookieCategoryCard
            key={cat.key}
            category={cat}
            index={i}
            checked={
              cat.key === "necessary"
                ? true
                : localPrefs[cat.key as keyof typeof localPrefs]
            }
            onToggle={(v) => {
              if (cat.key !== "necessary") {
                setLocalPrefs((prev) => ({
                  ...prev,
                  [cat.key]: v,
                }));
              }
            }}
          />
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
