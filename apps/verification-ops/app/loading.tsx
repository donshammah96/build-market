/**
 * Verification Ops Dashboard Skeleton Loader
 */

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col bg-zinc-900 text-zinc-100 min-h-screen animate-pulse">
      {/* Header Skeleton */}
      <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-700 rounded-lg"></div>
          <div className="space-y-2">
            <div className="w-48 h-5 bg-zinc-700 rounded"></div>
            <div className="w-64 h-3 bg-zinc-700/60 rounded"></div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-4 bg-zinc-700 rounded"></div>
          <div className="w-8 h-8 rounded-full bg-zinc-700"></div>
        </div>
      </header>

      {/* Queue Tabs Bar Skeleton (7 items) */}
      <div className="bg-zinc-800/80 border-b border-zinc-800 px-6 pt-4 flex gap-1 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="w-28 h-8 bg-zinc-700/50 rounded-t border-b-2 border-transparent shrink-0"
          ></div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <main className="flex-1 p-6 space-y-6">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl space-y-2"
            >
              <div className="w-24 h-3 bg-zinc-700 rounded"></div>
              <div className="w-16 h-7 bg-zinc-700 rounded"></div>
            </div>
          ))}
        </div>

        {/* Queue Table Skeleton */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
            <div className="w-40 h-4 bg-zinc-700 rounded"></div>
            <div className="w-32 h-6 bg-zinc-700 rounded-lg"></div>
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-full h-12 bg-zinc-700/40 rounded flex items-center justify-between px-4"
              >
                <div className="w-20 h-4 bg-zinc-700 rounded"></div>
                <div className="w-32 h-4 bg-zinc-700 rounded"></div>
                <div className="w-28 h-4 bg-zinc-700 rounded"></div>
                <div className="w-16 h-4 bg-zinc-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
