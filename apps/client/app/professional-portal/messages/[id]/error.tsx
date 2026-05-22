"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function ConversationDetailError({
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
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <Button variant="ghost" asChild>
        <Link href="/professional-portal/messages">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
        </Link>
      </Button>
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-zinc-500 mb-6">
          We couldn&apos;t load this conversation. This might be a temporary
          connection issue.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => reset()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/professional-portal/messages">Back to Messages</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
