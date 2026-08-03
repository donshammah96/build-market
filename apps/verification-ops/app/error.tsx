"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log exception and digest for operational observability
    console.error(
      "[VerificationOps] Unhandled operational runtime exception:",
      {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
    );
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-zinc-100 p-6 text-center">
      <div className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-xl space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Operational Error Encountered
        </h1>
        <p className="text-xs text-zinc-400">
          An unexpected error occurred in the Verification Operations Center.
        </p>
        {error.digest && (
          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-700 font-mono text-[11px] text-zinc-400">
            Event Digest: <span className="text-zinc-200">{error.digest}</span>
          </div>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reload Operation Queue
          </button>
        </div>
      </div>
    </div>
  );
}
