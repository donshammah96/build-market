import { Skeleton } from "@/components/ui/skeleton";

export default function PropertyDetailLoading() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back button skeleton */}
        <Skeleton className="h-8 w-48 mb-6" />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column — Gallery + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main image */}
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />

            {/* Thumbnails */}
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-20 rounded-lg" />
              ))}
            </div>

            {/* Property info card */}
            <div className="rounded-xl border bg-card p-6 space-y-6">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-7 w-72" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <Skeleton className="h-8 w-36" />
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-zinc-100">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-32 mb-3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>

          {/* Right column — Agent + Actions */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="flex items-center gap-4 mb-6">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
