"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Error boundary for onboarding route.
 * Retry navigates back to /onboarding with cleared URL state (not a refetch).
 */
export default function OnboardingError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Onboarding error:", error);
  }, [error]);

  const handleRetry = () => {
    router.replace("/onboarding");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 md:px-6 md:py-10">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(130deg,var(--color-onboarding-surface)_0%,color-mix(in_oklab,var(--color-onboarding-primary)_20%,transparent)_38%,transparent_100%)]" />
        <div className="absolute -top-32 -right-28 h-112 w-md rounded-full bg-onboarding-glow/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-104 w-104 rounded-full bg-onboarding-accent/22 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4b5f7f1f_1px,transparent_1px),linear-gradient(to_bottom,#4b5f7f1f_1px,transparent_1px)] bg-size-[22px_22px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
        <div className="w-full space-y-6 rounded-[18px] border border-onboarding-primary/30 bg-onboarding-surface/85 p-6 text-center shadow-[0_24px_55px_-35px_rgba(13,20,32,0.95)] backdrop-blur-xl sm:p-8">
          <div className="flex justify-center">
            <div className="rounded-full bg--error/10 p-4">
              <AlertCircle className="h-12 w-12 text-(--color-error)" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-onboarding-ink">
            Something went wrong
          </h1>
          <p className="text-onboarding-ink/72">
            We couldn&apos;t load the onboarding form. Please try again.
          </p>
          <Button
            onClick={handleRetry}
            className="min-h-11 w-full bg-(--color-onboarding-primary) text-[oklch(0.08_0.016_222)] hover:opacity-90"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
