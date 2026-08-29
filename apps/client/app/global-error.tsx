"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">
        <div className="flex min-h-screen items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <h2 className="text-xl font-semibold text-zinc-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-zinc-500 text-sm mb-6">
              An unexpected system error occurred. Please try again.
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
