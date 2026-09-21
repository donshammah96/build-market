import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-end justify-between border-b border-zinc-200 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-zinc-200" />
          <Skeleton className="h-4 w-96 bg-zinc-200" />
        </div>
        <Skeleton className="hidden sm:block h-6 w-36 bg-zinc-200 rounded-full" />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-zinc-200 bg-white rounded-xl p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 bg-zinc-200" />
              <Skeleton className="h-8 w-8 bg-zinc-200 rounded-lg" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-8 w-16 bg-zinc-200" />
              <Skeleton className="h-3 w-32 bg-zinc-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 border border-zinc-200 bg-white rounded-xl p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-40 bg-zinc-200" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 bg-zinc-200 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32 bg-zinc-200" />
                    <Skeleton className="h-3 w-20 bg-zinc-200" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 bg-zinc-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 border border-zinc-200 bg-white rounded-xl p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-40 bg-zinc-200" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-16 w-full bg-zinc-200 rounded-lg" />
            <Skeleton className="h-16 w-full bg-zinc-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
