import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1">
        {/* Hero skeleton */}
        <section className="bg-zinc-900 text-white py-20 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center max-w-3xl">
            <Skeleton className="h-8 w-48 mx-auto mb-6 bg-white/20" />
            <Skeleton className="h-12 w-96 mx-auto mb-6 bg-white/20" />
            <Skeleton className="h-6 w-80 mx-auto bg-white/20" />
          </div>
        </section>

        {/* Controls skeleton */}
        <section className="container mx-auto px-4 md:px-6 -mt-8 relative z-20 mb-12">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <Skeleton className="h-10 w-96" />
                <Skeleton className="h-10 w-[400px]" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Grid skeleton */}
        <section className="container mx-auto px-4 md:px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 bg-white rounded-xl border border-zinc-200 p-6 space-y-4"
              >
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-20 w-full mt-auto" />
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
