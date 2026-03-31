import { Skeleton } from "@/components/ui/skeleton";

export default function CompleteProfileLoading() {
  return (
    <div className="min-h-screen bg-zinc-50/50">
      <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </main>
    </div>
  );
}
