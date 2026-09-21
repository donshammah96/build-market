"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { storesClient } from "@/lib/facades/stores-client";
import { StoreCard } from "./_components/store-card";

export default function ProfessionalStoresPage() {
  const { data: response, isLoading } = useQuery({
    queryKey: ["professional", "stores"],
    queryFn: () => storesClient.getMyStores(),
  });

  const stores = response?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            My Stores
          </h1>
          <p className="text-zinc-500 mt-1 flex items-center gap-2">
            Manage your marketplace stores, products, and incoming orders.
          </p>
        </div>
        <Button asChild>
          <Link href="/professional-portal/stores/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Store
          </Link>
        </Button>
      </div>

      {!isLoading && stores.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center animate-in fade-in duration-500">
          <div className="rounded-full bg-primary/10 p-3 mb-4">
            <StoreIcon className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">No stores found</h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            You haven&apos;t created any stores yet. Open a store to start
            selling materials, tools, or equipment directly to clients.
          </p>
          <Button asChild>
            <Link href="/professional-portal/stores/new">
              <Plus className="mr-2 h-4 w-4" />
              Create your first Store
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}
