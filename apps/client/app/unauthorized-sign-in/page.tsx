"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ShieldX, LogIn, LifeBuoy, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Reason config
// ---------------------------------------------------------------------------

type BlockReason =
  | "SUSPENDED"
  | "BANNED"
  | "DEACTIVATED"
  | "ARCHIVED"
  | "default";

interface ReasonConfig {
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
}

const REASON_CONFIG: Record<BlockReason, ReasonConfig> = {
  SUSPENDED: {
    title: "Account Suspended",
    description:
      "Your account has been temporarily suspended. This is typically due to a violation of our terms of service. Please contact our support team to learn more or to appeal this decision.",
    badge: "Suspended",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  BANNED: {
    title: "Account Banned",
    description:
      "Your account has been permanently banned from Build Market due to serious or repeated violations of our policies. If you believe this is an error, please contact our support team.",
    badge: "Permanently Banned",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  DEACTIVATED: {
    title: "Account Deactivated",
    description:
      "Your account has been deactivated. This may be a temporary status during an account transition or review. Please contact our support team for assistance.",
    badge: "Deactivated",
    badgeClass: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  ARCHIVED: {
    title: "Account Archived",
    description:
      "Your account has been archived and is no longer active. Archived accounts cannot be used to sign in. Please contact support if you need to reactivate your account.",
    badge: "Archived",
    badgeClass: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  default: {
    title: "Access Restricted",
    description:
      "You are unable to sign in to this account at this time. Please contact our support team for further information.",
    badge: "Restricted",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

const SUPPORT_EMAIL = "support@buildmarket.app";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function UnauthorizedSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useClerk();
  const [signedOut, setSignedOut] = useState(false);

  const rawReason = searchParams.get("reason")?.toUpperCase() ?? "";
  const reason: BlockReason = (
    ["SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"].includes(rawReason)
      ? rawReason
      : "default"
  ) as BlockReason;

  const config = REASON_CONFIG[reason];

  // Sign the user out on mount so that re-visiting a protected route does not
  // immediately redirect them back here and create a loop.
  useEffect(() => {
    let cancelled = false;

    signOut()
      .then(() => {
        if (!cancelled) setSignedOut(true);
      })
      .catch(() => {
        // Best-effort — the redirect page is still shown even if signOut fails.
        if (!cancelled) setSignedOut(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-zinc-950 via-zinc-900 to-black p-4 overflow-hidden relative">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-300 tracking-wide">
              Build Market
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-linear-to-r from-red-500 via-red-400 to-amber-500" />

          <div className="px-8 pt-8 pb-10">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-red-500/10 blur-xl" />
                <div className="relative h-20 w-20 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <ShieldX className="h-10 w-10 text-red-400" />
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div className="flex justify-center mb-5">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${config.badgeClass}`}
              >
                {config.badge}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-2xl font-bold text-white text-center tracking-tight mb-3">
              {config.title}
            </h1>

            {/* Description */}
            <p className="text-sm text-zinc-400 text-center leading-relaxed mb-8">
              {config.description}
            </p>

            {/* Sign-out confirmation */}
            {signedOut && (
              <div className="mb-6 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-center">
                <p className="text-xs text-zinc-400">
                  You have been signed out of this account.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                id="unauthorized-sign-in-btn"
                onClick={() => router.push("/sign-in")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-sm transition-all duration-150 shadow-lg shadow-emerald-900/30"
              >
                <LogIn className="h-4 w-4" />
                Sign In with a Different Account
              </button>

              <a
                id="unauthorized-contact-support-btn"
                href={`mailto:${SUPPORT_EMAIL}?subject=Account%20Access%20Issue%20(${reason})`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-sm transition-all duration-150"
              >
                <LifeBuoy className="h-4 w-4" />
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-zinc-600 uppercase tracking-widest font-medium">
            Security Notice
          </p>
          <p className="text-[10px] text-zinc-700 font-mono">
            Error Code: 403_{reason}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="text-center text-zinc-400">
            Loading security checks...
          </div>
        </div>
      }
    >
      <UnauthorizedSignInContent />
    </Suspense>
  );
}
