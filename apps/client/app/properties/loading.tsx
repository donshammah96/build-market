import { Skeleton } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero skeleton */}
      <div className="relative h-[600px] bg-zinc-200 animate-pulse">
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-64 mb-8" />
          <Skeleton className="h-48 w-full max-w-3xl rounded-2xl" />
        </div>
      </div>

      {/* Category icons skeleton */}
      <div className="py-12 bg-white border-b border-zinc-100">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured listings skeleton */}
      <div className="py-20 container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex justify-between items-end mb-10">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-40 hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
