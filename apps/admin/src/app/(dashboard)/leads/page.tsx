import { Suspense } from "react";
import { getLeads, getLeadStats } from "@/actions/admin";
import { LeadSource, ProjectType } from "@build/db";
import { columns, LeadData } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Clock, Target, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LeadsFilter } from "./leads-filter";

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

async function LeadStatsCards() {
  const response = await getLeadStats();

  if (!response.success || !response.data) {
    return null;
  }

  const stats = response.data;
  const wonCount = stats.byStatus.find((s) => s.status === "WON")?.count || 0;
  const newCount = stats.byStatus.find((s) => s.status === "NEW")?.count || 0;
  const inProgressCount = stats.byStatus
    .filter((s) => ["CONTACTED", "PROPOSAL", "NEGOTIATION"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.thisMonth} this month
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New Leads</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{newCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.thisWeek} this week
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          <Target className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inProgressCount}</div>
          <p className="text-xs text-muted-foreground">Active negotiations</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.conversionRate}%</div>
          <p className="text-xs text-muted-foreground">{wonCount} won leads</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface LeadsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST";
    source?: string;
    projectType?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || "";

  const response = await getLeads({
    page,
    limit: 10,
    search,
    status: params.status,
    source: params.source as LeadSource | undefined,
    projectType: params.projectType as ProjectType | undefined,
    sortBy:
      (params.sortBy as "createdAt" | "status" | "clientName" | "updatedAt") ||
      "createdAt",
    sortOrder: (params.sortOrder as "asc" | "desc") || "desc",
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load leads");
  }

  const { leads, meta } = response.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              View and manage all lead inquiries sent to professionals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Users className="mr-1 h-3 w-3" />
              {meta.total} total
            </Badge>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <LeadsFilter />
        </div>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <LeadStatsCards />
      </Suspense>

      {/* Active Filters */}
      {(search || params.status || params.source || params.projectType) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Filters:</span>
          {search && <Badge variant="secondary">Search: {search}</Badge>}
          {params.status && (
            <Badge variant="secondary">Status: {params.status}</Badge>
          )}
          {params.source && (
            <Badge variant="secondary">Source: {params.source}</Badge>
          )}
          {params.projectType && (
            <Badge variant="secondary">Type: {params.projectType}</Badge>
          )}
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={leads as unknown as LeadData[]}
        pageCount={meta.totalPages}
        searchPlaceholder="Search leads..."
      />
    </div>
  );
}
