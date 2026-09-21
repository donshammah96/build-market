"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

type ConfirmState =
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

export default function NewsletterConfirmPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<ConfirmState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({
        status: "error",
        message: "This confirmation link is missing its token.",
      });
      return;
    }

    let cancelled = false;

    async function confirm() {
      try {
        const res = await fetch("/api/newsletter/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const body = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          setState({
            status: "error",
            message: body?.message ?? "This confirmation link is invalid.",
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

    confirm();
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
              Confirming your subscription…
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
              You&apos;re subscribed
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Thanks for confirming — you&apos;ll start receiving Build Market
              updates in your inbox.
            </p>
            <Button asChild>
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
              We couldn&apos;t confirm that
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
