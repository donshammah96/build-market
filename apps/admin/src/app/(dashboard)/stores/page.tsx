import { Suspense } from "react";
import { getStores, getStoreStats } from "@/actions/admin";
import { columns, StoreData } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, CheckCircle, Clock, Star, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

async function StoreStatsCards() {
  const response = await getStoreStats();
  
  if (!response.success || !response.data) {
    return null;
  }

  const stats = response.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
          <Store className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Registered stores</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Verified</CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.verified}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total > 0 ? ((stats.verified / stats.total) * 100).toFixed(1) : 0}% verification rate
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting verification</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Featured</CardTitle>
          <Star className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.featured}</div>
          <p className="text-xs text-muted-foreground">Highlighted stores</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface StoresPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    verified?: string;
    featured?: string;
    county?: string;
    category?: string;
  }>;
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || "";
  const verified = params.verified === "true" ? true : params.verified === "false" ? false : undefined;
  const featured = params.featured === "true" ? true : undefined;

  const response = await getStores({
    page,
    limit: 10,
    search,
    verified,
    featured,
    county: params.county,
    category: params.category,
  });

  if (!response.success || !response.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-muted-foreground">Manage store listings and verifications.</p>
        </div>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{response.error || "Failed to load stores"}</p>
        </div>
      </div>
    );
  }

  const { stores, meta } = response.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-muted-foreground">
            Manage store listings and verifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            <Package className="mr-1 h-3 w-3" />
            {meta.total} total
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <StoreStatsCards />
      </Suspense>

      {/* Filters Info */}
      {(search || verified !== undefined || featured) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filters:</span>
          {search && <Badge variant="secondary">Search: {search}</Badge>}
          {verified !== undefined && (
            <Badge variant="secondary">
              {verified ? "Verified" : "Unverified"}
            </Badge>
          )}
          {featured && <Badge variant="secondary">Featured</Badge>}
        </div>
      )}

      {/* Data Table */}
      <DataTable 
        columns={columns} 
        data={stores as unknown as StoreData[]} 
        pageCount={meta.totalPages}
        searchPlaceholder="Search stores..."
      />
    </div>
  );
}
