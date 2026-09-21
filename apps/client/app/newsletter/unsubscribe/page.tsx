"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

type UnsubscribeState =
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Deliberately no "are you sure?" confirmation step before unsubscribing.
 * Gmail and Yahoo's 2024 bulk-sender rules require one-click
 * unsubscribe with no further interaction once the user has indicated
 * intent to unsubscribe, and adding an extra confirmation click here —
 * even though this page's own link is separate from the mail-provider
 * one-click flow that hits the API directly — is the kind of dark
 * pattern that generates spam complaints against the sending domain.
 * Process immediately; offer an easy way back instead of a gate on the
 * way in.
 */
export default function NewsletterUnsubscribePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<UnsubscribeState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({
        status: "error",
        message: "This unsubscribe link is missing its token.",
      });
      return;
    }

    let cancelled = false;

    async function unsubscribe() {
      try {
        const res = await fetch("/api/newsletter/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const body = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          setState({
            status: "error",
            message: body?.message ?? "This unsubscribe link is invalid.",
          });
          return;
        }

        setState({ status: "success" });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Something went wrong — please try again in a moment.",
          });
        }
      }
    }

    unsubscribe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {state.status === "loading" && (
          <>
            <Loader2
              size={40}
              className="mx-auto mb-6 text-primary animate-spin"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Unsubscribing…
            </h1>
            <p className="text-sm text-muted-foreground">
              This will only take a moment.
            </p>
          </>
        )}

        {state.status === "success" && (
          <>
            <CheckCircle2
              size={40}
              className="mx-auto mb-6 text-primary"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              You&apos;re unsubscribed
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              You won&apos;t receive any more Build Market newsletter emails.
              Changed your mind? You can subscribe again any time from the site
              footer.
            </p>
            <Button asChild variant="outline">
              <Link href={ROUTES.home}>Back to Build Market</Link>
            </Button>
          </>
        )}

        {state.status === "error" && (
          <>
            <XCircle
              size={40}
              className="mx-auto mb-6 text-destructive"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              We couldn&apos;t process that
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              {state.message}
            </p>
            <Button asChild variant="outline">
              <Link href={ROUTES.home}>Back to Build Market</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
