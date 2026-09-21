import { Metadata } from "next";
import { StoreCategory } from "@prisma/client";
import { storesClient } from "@/lib/facades/stores-client";
import { PublicStoreCard } from "./_components/public-store-card";
import { StoreFilters } from "./_components/store-filters";
import { Store as StoreIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Building Material Stores & Suppliers | Build Market",
  description:
    "Find trusted building material stores, hardware shops, and equipment suppliers in your area.",
};

// Next.js config for search params
export const dynamic = "force-dynamic";

export default async function StoresDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const params = await searchParams;
  // Convert searchParams roughly to what getStores expects
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const category =
    typeof params.category === "string" ? params.category : undefined;
  const city = typeof params.city === "string" ? params.city : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;

  const response = await storesClient.getStores({
    page: String(page),
    limit: "24",
    category: category as StoreCategory | undefined,
    city,
    search,
  });

  const stores = response.success && response.data ? response.data.stores : [];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Stores & Suppliers
        </h1>
        <p className="text-muted-foreground">
          Discover certified hardware stores, manufacturers, and distributors
          for all your construction needs.
        </p>
      </div>

      <div className="block lg:flex lg:gap-8">
        <aside className="hidden lg:block w-64 shrink-0">
          <StoreFilters />
        </aside>

        <div className="flex-1">
          {stores.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <StoreIcon className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">No stores found</h2>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                We couldn&apos;t find any stores matching your current criteria.
                Try adjusting your filters or search term.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <PublicStoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
