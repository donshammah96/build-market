import { Skeleton } from "@/components/ui/skeleton";

export default function LegalLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge skeleton */}
      <div className="flex justify-center mb-8">
        <Skeleton className="h-8 w-40 rounded-full bg-white/5" />
      </div>

      {/* Title skeleton */}
      <div className="text-center mb-6 space-y-3">
        <Skeleton className="h-12 w-72 mx-auto bg-white/5" />
        <Skeleton className="h-12 w-56 mx-auto bg-white/5" />
      </div>

      {/* Intro paragraph skeleton */}
      <div className="flex justify-center mb-12">
        <div className="space-y-2 max-w-xl w-full">
          <Skeleton className="h-4 w-full bg-white/5" />
          <Skeleton className="h-4 w-[85%] bg-white/5" />
          <Skeleton className="h-4 w-[60%] bg-white/5" />
        </div>
      </div>

      {/* Content block skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-24 w-full rounded-2xl bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}
