"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
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
    <div className="mx-auto max-w-4xl py-10 space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/professional-portal/projects">Back to Projects</Link>
      </Button>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">
          We couldn&apos;t load this project
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Try this route again or return to the project list.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/professional-portal/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
