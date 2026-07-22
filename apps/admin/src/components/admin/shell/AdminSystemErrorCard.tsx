import Link from "next/link";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

export interface AdminSystemErrorCardProps {
  title: string;
  description: string;
  correlationId?: string | null | undefined;
}

export function AdminSystemErrorCard({
  title,
  description,
  correlationId,
}: AdminSystemErrorCardProps) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-800 to-black" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 text-center flex flex-col items-center">
        <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-md">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>

        <h2 className="text-xl font-bold text-zinc-950 tracking-tight mb-2">
          {title}
        </h2>

        <p className="text-sm text-zinc-600 leading-relaxed mb-6">
          {description}
        </p>

        {correlationId && (
          <div className="w-full bg-zinc-100 rounded-lg p-3 text-left mb-6 border border-zinc-200">
            <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">
              System Incident Reference
            </span>
            <p className="text-xs font-mono text-zinc-700 break-all">
              Correlation ID: {correlationId}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md"
          >
            <RefreshCw className="mr-2 h-4 w-4 animate-spin-hover" />
            Retry Connection
          </Link>

          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
