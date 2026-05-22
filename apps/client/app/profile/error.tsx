"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Profile route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <main className="container mx-auto px-4 md:px-8 py-16 max-w-3xl">
        <div className="rounded-lg border border-red-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Unable to load profile</h2>
          </div>
          <p className="text-sm text-zinc-600">
            Something went wrong while loading this page. Try again.
          </p>
          <Button onClick={reset}>Retry</Button>
        </div>
      </main>
    </div>
  );
}
