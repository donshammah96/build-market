// Segment-level loading skeleton for /professional-portal/finance.

export default function FinanceLoading() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-4">
      {/* Header Skeleton */}
      <div className="flex justify-between items-end pb-6 border-b border-zinc-100">
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-48 bg-zinc-200 rounded" />
          <div className="h-4 w-64 bg-zinc-200 rounded" />
        </div>
        <div className="flex gap-3 animate-pulse">
          <div className="h-10 w-32 bg-zinc-200 rounded" />
          <div className="h-10 w-36 bg-zinc-200 rounded" />
        </div>
      </div>

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Transactions Table Skeleton */}
      <div className="border border-zinc-200 rounded-xl overflow-hidden animate-pulse">
        <div className="h-12 bg-zinc-50 border-b border-zinc-100" />
        <div className="divide-y divide-zinc-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-3 flex-1 bg-zinc-200 rounded" />
              <div className="h-3 w-24 bg-zinc-200 rounded" />
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-6 w-20 bg-zinc-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
