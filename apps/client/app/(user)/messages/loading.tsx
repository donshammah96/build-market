import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 pt-24 max-w-7xl h-full flex flex-col">
        {/* Header skeleton */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>

        {/* Grid: list + chat */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
          {/* Left: Conversations list skeleton */}
          <div className="md:col-span-4 lg:col-span-3 h-full">
            <Card className="h-full border-zinc-200 shadow-sm bg-white overflow-hidden flex flex-col">
              <div className="p-4 border-b border-zinc-100 bg-white">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="flex-1 overflow-hidden divide-y divide-zinc-100">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: Chat window skeleton */}
          <div className="md:col-span-8 lg:col-span-9 h-full flex flex-col">
            <Card className="h-full border-zinc-200 shadow-sm bg-white overflow-hidden flex flex-col">
              <div className="h-16 border-b border-zinc-100 flex items-center px-4 md:px-6">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="ml-3 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col space-y-8">
                <div className="flex justify-start">
                  <Skeleton className="h-12 w-72 rounded-2xl rounded-tl-none" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-16 w-80 rounded-2xl rounded-tr-none" />
                </div>
                <div className="flex justify-start">
                  <Skeleton className="h-24 w-64 rounded-2xl rounded-tl-none" />
                </div>
                <div className="mt-auto pt-4 border-t border-zinc-100">
                  <Skeleton className="h-12 w-full rounded-full" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
