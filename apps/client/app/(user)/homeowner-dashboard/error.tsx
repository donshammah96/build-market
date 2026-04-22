"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/links";

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
    <div className="min-h-screen bg-zinc-50/50">
      <ClientNavbar />
      <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">
            Unable to load dashboard
          </h2>
          <p className="text-zinc-500 max-w-md mb-6">
            Something went wrong. Retry this route or return home and try again.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href={ROUTES.home}>Back to Home</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
