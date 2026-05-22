"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function LegalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-zinc-400 mb-6">
          We couldn&apos;t load this page. This might be a temporary connection
          issue.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => reset()}
            className="bg-emerald-500 hover:bg-emerald-400 text-white"
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link
              href="/legal/privacy"
              className="border-white/20 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Back to Legal
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
