"use client";

import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";
import { AuthPageSkeleton } from "./AuthPageSkeleton";

interface ClerkSignInWidgetProps {
  redirectUrl?: string;
}

export default function ClerkSignInWidget({
  redirectUrl: initialRedirectUrl,
}: ClerkSignInWidgetProps = {}) {
  const [mounted, setMounted] = useState(false);
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const searchParams = useSearchParams();

  const rawRedirectUrl = initialRedirectUrl ?? searchParams.get("redirect_url");
  const safeTargetUrl = getSafeRedirectUrl(rawRedirectUrl);
  const ticket =
    searchParams.get("__clerk_ticket") || searchParams.get("ticket");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isProcessingTicket, setIsProcessingTicket] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const target = safeTargetUrl || ROUTES.authCallback;
      window.location.href = target;
    }
  }, [isLoaded, isSignedIn, safeTargetUrl]);

  // Handle single-use ticket consumption (e.g. from E2E test-control or invitation links)
  useEffect(() => {
    if (
      !clerk.loaded ||
      !ticket ||
      isSignedIn ||
      isProcessingTicket ||
      ticketError
    ) {
      return;
    }

    let isCancelled = false;
    setIsProcessingTicket(true);

    async function processTicket() {
      try {
        const attempt = await clerk.client.signIn.create({
          strategy: "ticket",
          ticket: ticket!,
        });

        if (isCancelled) return;

        if (attempt.status === "complete") {
          await clerk.setActive({ session: attempt.createdSessionId });
          const target = safeTargetUrl || ROUTES.authCallback;
          window.location.href = target;
        } else {
          console.warn(
            "[ClerkSignInWidget] Ticket sign-in not complete:",
            attempt.status,
          );
          setIsProcessingTicket(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error(
            "[ClerkSignInWidget] Failed to authenticate ticket:",
            err,
          );
          setTicketError(
            err?.message || "Failed to authenticate single-use ticket",
          );
          setIsProcessingTicket(false);
        }
      }
    }

    processTicket();

    return () => {
      isCancelled = true;
    };
  }, [
    clerk,
    ticket,
    isSignedIn,
    safeTargetUrl,
    isProcessingTicket,
    ticketError,
  ]);

  if (
    !mounted ||
    (isLoaded && isSignedIn) ||
    (Boolean(ticket) && !ticketError)
  ) {
    return <AuthPageSkeleton variant="sign-in" />;
  }

  const authCallbackWithRedirect = safeTargetUrl
    ? `${ROUTES.authCallback}?redirect_url=${encodeURIComponent(safeTargetUrl)}`
    : ROUTES.authCallback;

  return (
    <SignIn
      routing="path"
      path="/sign-in"
      forceRedirectUrl={safeTargetUrl ?? undefined}
      fallbackRedirectUrl={authCallbackWithRedirect}
      signUpUrl={ROUTES.signUp}
      appearance={
        {
          layout: { socialButtonsPlacement: "bottom" },
          elements: {
            rootBox: "w-full",
            card: "shadow-none p-6 sm:p-8 w-full border-0",
            headerTitle: "text-2xl font-bold text-zinc-900 tracking-tight",
            headerSubtitle: "text-zinc-500 font-normal",
            socialButtonsBlockButton:
              "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 font-medium rounded-lg h-11 transition-colors",
            formButtonPrimary:
              "bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg rounded-lg h-11 font-semibold transition-all",
            formFieldInput:
              "h-11 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-zinc-50/50 transition-all",
            footerActionLink:
              "text-emerald-600 hover:text-emerald-700 font-medium hover:underline",
          },
        } as any
      }
    />
  );
}
