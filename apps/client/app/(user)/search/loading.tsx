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
        <section className="bg-zinc-900 text-white py-16 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center max-w-2xl">
            <Skeleton className="h-10 w-72 mx-auto mb-4 bg-white/20" />
            <Skeleton className="h-5 w-96 mx-auto mb-8 bg-white/20" />
            <Skeleton className="h-12 w-full max-w-xl mx-auto bg-white/20" />
          </div>
        </section>

        {/* Results skeleton */}
        <section className="container mx-auto px-4 md:px-6 py-12 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
