import { Suspense } from "react";
import { getProperties, getPropertyStats } from "@/actions/admin";
import { columns, PropertyData } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, CheckCircle, Clock, Star, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertiesFilter } from "./properties-filter";

// Property filter types matching the schema enums
type PropertyType = "SALE" | "RENT" | "LEASE";
type PropertyCategory = "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "INDUSTRIAL";
type PropertyStatus = "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";

export const dynamic = "force-dynamic";

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

async function PropertyStatsCards() {
  const response = await getPropertyStats();

  if (!response.success || !response.data) {
    return null;
  }

  const stats = response.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Properties
          </CardTitle>
          <Home className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Listed properties</p>
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
            {stats.total > 0
              ? ((stats.verified / stats.total) * 100).toFixed(1)
              : 0}
            % verified
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting review</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Featured</CardTitle>
          <Star className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.featured}</div>
          <p className="text-xs text-muted-foreground">Highlighted listings</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            KES {(stats.priceStats.avg / 1000000).toFixed(1)}M
          </div>
          <p className="text-xs text-muted-foreground">Average listing price</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface PropertiesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    type?: string;
    category?: string;
    status?: string;
    verified?: string;
    featured?: string;
    county?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function PropertiesPage({
  searchParams,
}: PropertiesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || "";
  const verified =
    params.verified === "true"
      ? true
      : params.verified === "false"
        ? false
        : undefined;
  const featured = params.featured === "true" ? true : undefined;

  const response = await getProperties({
    page,
    limit: 10,
    search,
    type: params.type as PropertyType | undefined,
    category: params.category as PropertyCategory | undefined,
    status: params.status as PropertyStatus | undefined,
    verified,
    featured,
    county: params.county,
    sortBy:
      (params.sortBy as "createdAt" | "price" | "title" | "updatedAt") ||
      "createdAt",
    sortOrder: (params.sortOrder as "asc" | "desc") || "desc",
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load properties");
  }

  const { properties, meta } = response.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground">
              Manage property listings and verifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Home className="mr-1 h-3 w-3" />
              {meta.total} total
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <PropertiesFilter />
        </div>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <PropertyStatsCards />
      </Suspense>

      {/* Active Filters */}
      {(search ||
        params.type ||
        params.category ||
        params.status ||
        verified !== undefined ||
        featured) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Filters:</span>
          {search && <Badge variant="secondary">Search: {search}</Badge>}
          {params.type && (
            <Badge variant="secondary">Type: {params.type}</Badge>
          )}
          {params.category && (
            <Badge variant="secondary">Category: {params.category}</Badge>
          )}
          {params.status && (
            <Badge variant="secondary">Status: {params.status}</Badge>
          )}
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
        data={properties as unknown as PropertyData[]}
        pageCount={meta.totalPages}
        searchPlaceholder="Search properties..."
      />
    </div>
  );
}
