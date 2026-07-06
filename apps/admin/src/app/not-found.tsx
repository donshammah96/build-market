import { FileQuestion, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-800 to-black" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in text-center">
        {/* Brand Header */}
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-zinc-800/80 rounded-2xl border border-zinc-700 backdrop-blur-sm">
          <FileQuestion className="h-8 w-8 text-zinc-400" />
        </div>

        <p className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-2">
          Error 404
        </p>

        <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
          Page Not Found
        </h1>

        <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
          The administrative route you requested does not exist or has been
          relocated to another security slice.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-950/20"
          >
            <Shield className="mr-2 h-4 w-4" />
            Go to Admin Dashboard
          </Link>

          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
