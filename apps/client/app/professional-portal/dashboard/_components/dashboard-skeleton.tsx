// Route-local skeleton extracted from page.tsx — shared by loading.tsx and the
// client-side isLoading gate in the page component.

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-4">
      {/* Header Skeleton */}
      <div className="flex justify-between items-end pb-6 border-b border-zinc-100">
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-32 bg-zinc-200 rounded" />
          <div className="h-4 w-64 bg-zinc-200 rounded" />
        </div>
        <div className="flex gap-3 animate-pulse">
          <div className="h-10 w-28 bg-zinc-200 rounded" />
          <div className="h-10 w-36 bg-zinc-200 rounded" />
        </div>
      </div>

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="h-80 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
            <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-40 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="h-56 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
