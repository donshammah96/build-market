"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ShieldAlert, LogOut, ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Reason config
// ---------------------------------------------------------------------------

type BlockReason =
  "not_admin" | "SUSPENDED" | "BANNED" | "DEACTIVATED" | "ARCHIVED" | "default";

interface ReasonConfig {
  title: string;
  description: string;
  badge: string;
}

const REASON_CONFIG: Record<BlockReason, ReasonConfig> = {
  not_admin: {
    title: "Access Denied",
    description:
      "You do not have the required administrative permissions to access the Build Market Admin Portal. This area is restricted to authorized personnel only.",
    badge: "Unauthorized",
  },
  SUSPENDED: {
    title: "Account Suspended",
    description:
      "Your administrator account has been temporarily suspended. Please contact a Super Administrator for assistance.",
    badge: "Suspended",
  },
  BANNED: {
    title: "Account Banned",
    description:
      "Your administrator account has been permanently banned. Please contact the system owner for further information.",
    badge: "Permanently Banned",
  },
  DEACTIVATED: {
    title: "Account Deactivated",
    description:
      "Your administrator account has been deactivated. Please contact a Super Administrator to restore access.",
    badge: "Deactivated",
  },
  ARCHIVED: {
    title: "Account Archived",
    description:
      "Your administrator account has been archived and is no longer active. Please contact the system owner.",
    badge: "Archived",
  },
  default: {
    title: "Access Restricted",
    description:
      "You are not permitted to access this portal at this time. Please contact the system administrator for assistance.",
    badge: "Restricted",
  },
};

const SIGN_IN_URL = "/sign-in";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UnauthorizedSignInContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useClerk();
  const [signedOut, setSignedOut] = useState(false);

  const rawReason = searchParams.get("reason") ?? "";
  const reason: BlockReason = (
    ["not_admin", "SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"].includes(
      rawReason,
    )
      ? rawReason
      : "default"
  ) as BlockReason;

  const config = REASON_CONFIG[reason];

  // Sign the user out on mount to prevent redirect loops when they attempt
  // to navigate back to a protected admin route.
  useEffect(() => {
    let cancelled = false;

    signOut()
      .then(() => {
        if (!cancelled) setSignedOut(true);
      })
      .catch(() => {
        if (!cancelled) setSignedOut(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signOut]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-800 to-black" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-xl border border-red-500/30 backdrop-blur-sm mb-3">
            <Building2 className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
            Build Market Admin
          </p>
        </div>

        {/* Unauthorized Card */}
        <Card className="border-white/20 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden">
          {/* Status Indicator Line */}
          <div className="h-1.5 w-full bg-linear-to-r from-red-500 via-red-400 to-red-500" />

          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-red-50 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-100 dark:border-red-500/30 shadow-lg">
              <ShieldAlert className="h-10 w-10 text-red-500 dark:text-red-400" />
            </div>

            {/* Badge */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 mb-4">
              {config.badge}
            </span>

            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight mb-3">
              {config.title}
            </h1>

            <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed mb-2 max-w-75 mx-auto">
              {config.description}
            </p>

            {signedOut && (
              <p className="text-xs text-zinc-400 mb-6 italic">
                You have been signed out of this session.
              </p>
            )}

            <div className="flex flex-col gap-3 w-full mt-6">
              <Button
                id="unauthorized-sign-in-different-btn"
                onClick={() => router.push(SIGN_IN_URL)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white h-11 shadow-sm transition-all hover:shadow-md rounded-lg"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign In with a Different Account
              </Button>

              <Button
                id="unauthorized-sign-in-back-btn"
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 h-11 rounded-lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Security Notice
          </p>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
            Error Code: 403_{reason.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function UnauthorizedSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
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
