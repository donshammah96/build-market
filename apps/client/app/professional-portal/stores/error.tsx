"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfessionalStoresError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Stores page error:", error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 p-8 text-center animate-in fade-in duration-500">
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        Failed to load your stores
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {error.message ||
          "We encountered an unexpected error while trying to retrieve your marketplace stores. Please try again."}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
