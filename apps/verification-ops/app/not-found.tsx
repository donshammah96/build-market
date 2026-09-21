import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-zinc-100 p-6 text-center">
      <div className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-xl space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-400">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Page Not Found
        </h1>
        <p className="text-xs text-zinc-400">
          The verification resource or route you requested does not exist or has
          been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="w-full px-4 py-2.5 bg-zinc-700 hover:bg-zinc-650 text-zinc-100 rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Queue Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
