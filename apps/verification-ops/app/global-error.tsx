"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[VerificationOps] Critical root error boundary triggered:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen flex items-center justify-center p-6 text-center antialiased">
        <div className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-xl space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            System Failure
          </h1>
          <p className="text-xs text-zinc-400">
            The verification application shell encountered an unrecoverable
            failure.
          </p>
          {error.digest && (
            <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-700 font-mono text-[11px] text-zinc-400">
              Error Digest:{" "}
              <span className="text-zinc-200">{error.digest}</span>
            </div>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reset Application State
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
