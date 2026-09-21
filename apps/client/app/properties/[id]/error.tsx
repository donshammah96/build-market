"use client";

import { useEffect } from "react";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function PropertyDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[property-detail] segment error:", error);
  }, [error]);

  return (
    <div className="container mx-auto py-20 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-zinc-900">
          Property Not Found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The property you&apos;re looking for doesn&apos;t exist or has been
          removed. Try searching for similar listings.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild>
            <Link href={ROUTES.properties}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Browse Properties
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
