"use client";

import { useEffect } from "react";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PropertiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[properties] segment error:", error);
  }, [error]);

  return (
    <div className="container mx-auto py-20 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-zinc-900">
          Unable to Load Properties
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Something went wrong while loading the property listings. Please try
          again or return to the homepage.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
