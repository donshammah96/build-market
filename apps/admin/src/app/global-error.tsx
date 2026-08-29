"use client";

import { AlertOctagon, RefreshCw, LogOut } from "lucide-react";
import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans bg-zinc-950 text-white min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Layers */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-linear-to-br from-zinc-950 via-zinc-900 to-black" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 w-125 h-125 bg-red-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-8 text-center flex flex-col items-center">
          <div className="h-16 w-16 bg-red-950/50 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-lg shadow-red-950/20">
            <AlertOctagon className="h-8 w-8 text-red-500 animate-pulse" />
          </div>

          <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-2">
            Critical System Fault
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-3">
            Something went wrong
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            A fatal error occurred at the application root level. The session
            was interrupted to safeguard data integrity and system state.
          </p>

          {error.digest && (
            <div className="w-full bg-black/40 rounded-lg p-4 text-left mb-6 border border-zinc-800 font-mono">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">
                Error Digest Reference
              </span>
              <p className="text-xs text-zinc-400 break-all select-all">
                {error.digest}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={reset}
              className="flex-1 inline-flex h-11 items-center justify-center rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold transition-all hover:shadow-lg active:scale-98 cursor-pointer"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>

            <Link
              href="/sign-in"
              className="flex-1 inline-flex h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Reset Portal
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
