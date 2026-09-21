"use client";

import { SignUp } from "@clerk/nextjs";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { AuthPageSkeleton } from "./AuthPageSkeleton";

export default function ClerkSignUpWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <AuthPageSkeleton variant="sign-up" />;
  }

  return (
    <SignUp
      routing="path"
      path="/sign-up"
      fallbackRedirectUrl={ROUTES.authCallback}
      appearance={
        {
          layout: {
            socialButtonsPlacement: "bottom",
            showOptionalFields: false,
          },
          elements: {
            rootBox: "w-full",
            card: "shadow-none p-6 sm:p-8 w-full border-0",
            headerTitle: "text-2xl font-bold text-zinc-900 tracking-tight",
            headerSubtitle: "text-zinc-500 font-normal",
            socialButtonsBlockButton:
              "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 font-medium rounded-lg h-11 transition-colors",
            socialButtonsBlockButtonText: "font-medium",
            dividerLine: "bg-zinc-100",
            dividerText:
              "text-zinc-400 bg-white px-3 text-xs uppercase tracking-widest font-medium",
            formButtonPrimary:
              "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/10 rounded-lg h-11 font-semibold transition-all hover:shadow-emerald-900/20",
            formFieldLabel: "text-zinc-700 font-medium text-sm mb-1.5",
            formFieldInput:
              "h-11 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-zinc-50/50 transition-all",
            footerActionLink:
              "text-emerald-600 hover:text-emerald-700 font-medium hover:underline decoration-2 underline-offset-4",
            identityPreviewText: "text-zinc-600 font-medium",
          },
        } as any
      }
    />
  );
}
