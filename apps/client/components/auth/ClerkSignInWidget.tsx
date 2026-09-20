"use client";

import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState, useRef } from "react";
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
  const lastAttemptedTicketRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn && !ticket) {
      const target = safeTargetUrl || ROUTES.authCallback;
      window.location.href = target;
    }
  }, [isLoaded, isSignedIn, safeTargetUrl, ticket]);

  // Handle single-use ticket consumption (e.g. from E2E test-control or invitation links)
  useEffect(() => {
    if (
      !clerk.loaded ||
      !clerk.client ||
      !ticket ||
      ticket === lastAttemptedTicketRef.current
    ) {
      return;
    }

    lastAttemptedTicketRef.current = ticket;

    async function processTicket() {
      try {
        // If mounting with an active ticket while signed in to an ambient session,
        // sign out first to ensure ticket exchange establishes the correct identity (C-1)
        if (isSignedIn) {
          await clerk.signOut({ redirectUrl: undefined });
        }

        const attempt = await clerk.client.signIn.create({
          strategy: "ticket",
          ticket: ticket!,
        });

        if (attempt.status === "complete") {
          await clerk.setActive({ session: attempt.createdSessionId });
          const target = safeTargetUrl || ROUTES.authCallback;
          window.location.href = target;
        } else {
          console.warn(
            "[ClerkSignInWidget] Ticket sign-in not complete:",
            attempt.status,
          );
          setTicketError(
            `Ticket sign-in failed with status: ${attempt.status}`,
          );
        }
      } catch (err: any) {
        console.error(
          "[ClerkSignInWidget] Failed to authenticate ticket:",
          err,
        );
        setTicketError(
          err?.message || "Failed to authenticate single-use ticket",
        );
      }
    }

    processTicket();
  }, [
    clerk.loaded,
    clerk.client,
    clerk.setActive,
    clerk.signOut,
    ticket,
    safeTargetUrl,
    clerk,
    isSignedIn,
  ]);

  if (
    !mounted ||
    (isLoaded && isSignedIn && !ticket) ||
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
