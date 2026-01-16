import { Suspense } from "react";
import {
  getServiceCategories,
  type ServiceCategoryListItem,
} from "@/actions/admin";

export const dynamic = "force-dynamic";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Tags, Users, Activity } from "lucide-react";
import Link from "next/link";

interface ServicesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    isActive?: string;
  }>;
}

async function ServicesStats() {
  // In a real implementation, we'd have a getServiceStats function
  // For now, we'll derive stats from the services list
  const response = await getServiceCategories({ limit: 1000 });

  if (!response.success || !response.data) {
    return null;
  }

  const categories = response.data.categories as ServiceCategoryListItem[];
  const totalServices = categories.length;
  const activeServices = categories.filter((s) => s.isActive).length;
  const totalProfessionals = categories.reduce(
    (sum, s) => sum + s._count.professionals,
    0
  );
  const professionTypes = new Set(
    categories.map((s) => s.professionType).filter(Boolean)
  ).size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Total Services
          </CardTitle>
          <Wrench className="h-4 w-4 text-zinc-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalServices}</div>
          <p className="text-xs text-zinc-500">service types available</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Active Services
          </CardTitle>
          <Activity className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {activeServices}
          </div>
          <p className="text-xs text-zinc-500">
            {totalServices > 0
              ? `${((activeServices / totalServices) * 100).toFixed(0)}% of total`
              : "no services yet"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Profession Types
          </CardTitle>
          <Tags className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {professionTypes}
          </div>
          <p className="text-xs text-zinc-500">unique profession types</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Professionals Using
          </CardTitle>
          <Users className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {totalProfessionals}
          </div>
          <p className="text-xs text-zinc-500">
            professionals offering services
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function ServicesTable({
  searchParams,
}: {
  searchParams: ServicesPageProps["searchParams"];
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || undefined;
  const category = params.category || undefined;
  const isActive =
    params.isActive === "true"
      ? true
      : params.isActive === "false"
        ? false
        : undefined;

  const response = await getServiceCategories({
    page,
    limit: 20,
    search,
    professionType: category,
    isActive,
  });

  if (!response.success || !response.data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">
            Failed to load services: {response.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { categories: services, meta: pagination } = response.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Services</CardTitle>
            <CardDescription>
              Manage service categories and types offered by professionals
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/services/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={services}
          pageCount={pagination.totalPages}
          searchPlaceholder="Search services..."
        />

        {services.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench className="h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 mb-1">
              No services found
            </h3>
            <p className="text-zinc-500 mb-4">
              {search
                ? "Try adjusting your search query"
                : "Get started by adding your first service"}
            </p>
            {!search && (
              <Button asChild>
                <Link href="/services/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TableLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ServicesPage({
  searchParams,
}: ServicesPageProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">
            Services Management
          </h1>
          <p className="text-zinc-500 mt-1">
            Configure and manage professional service categories
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <ServicesStats />
      </Suspense>

      {/* Services Table */}
      <Suspense fallback={<TableLoadingSkeleton />}>
        <ServicesTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
