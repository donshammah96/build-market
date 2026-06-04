import { Suspense } from "react";
import {
  getPlatformAnalytics,
  getTopProfessionals,
  getGeographicDistribution,
} from "@/actions/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionErrorState } from "@/components/ui/action-error-state";
import {
  Users,
  Building2,
  Home,
  FolderKanban,
  Target,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  CheckCircle,
  MapPin,
  Award,
} from "lucide-react";

export const dynamic = "force-dynamic";

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function GrowthIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0;
  return (
    <div
      className={`flex items-center gap-1 text-xs ${isPositive ? "text-emerald-600" : "text-red-600"}`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(value)}% {label}
    </div>
  );
}

async function AnalyticsDashboard() {
  const [analyticsResponse, topProfsResponse, geoResponse] = await Promise.all([
    getPlatformAnalytics(),
    getTopProfessionals("leads", 5),
    getGeographicDistribution("professionals"),
  ]);

  if (!analyticsResponse.success || !analyticsResponse.data) {
    return (
      <ActionErrorState
        title="Unable to load analytics"
        description={analyticsResponse.error || "Failed to load analytics"}
      />
    );
  }

  const analytics = analyticsResponse.data;
  const topProfessionals = topProfsResponse.success
    ? topProfsResponse.data
    : [];
  const geoData = geoResponse.success ? geoResponse.data?.slice(0, 10) : [];

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalUsers.toLocaleString()}
            </div>
            <GrowthIndicator
              value={analytics.growth.userGrowthRate}
              label="vs last month"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Professionals</CardTitle>
            <Building2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalProfessionals.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                {analytics.overview.verifiedProfessionals} verified
              </Badge>
              <GrowthIndicator
                value={analytics.growth.professionalGrowthRate}
                label=""
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stores</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalStores.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Active marketplaces</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Home className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalProperties.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Listed properties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalProjects.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ongoing projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalLeads.toLocaleString()}
            </div>
            <GrowthIndicator
              value={analytics.growth.leadGrowthRate}
              label="vs last month"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overview.totalOrders.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Completed orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.engagement.activeUsersToday.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.engagement.activeUsersThisWeek} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Verification */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Overview
            </CardTitle>
            <CardDescription>Platform financial metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  KES {(analytics.revenue.totalRevenue / 1000000).toFixed(2)}M
                </p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-lg">
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  KES {(analytics.revenue.revenueThisMonth / 1000).toFixed(0)}K
                </p>
                <GrowthIndicator
                  value={analytics.revenue.revenueGrowthRate}
                  label="vs last month"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-lg font-semibold">
                  KES {analytics.revenue.avgOrderValue.toLocaleString()}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-lg font-semibold text-amber-600">
                  KES {analytics.revenue.pendingPayouts.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Verification Queue
            </CardTitle>
            <CardDescription>Items awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Professionals</span>
                </div>
                <Badge variant="secondary">
                  {analytics.verification.pendingProfessionals}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Stores</span>
                </div>
                <Badge variant="secondary">
                  {analytics.verification.pendingStores}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Properties</span>
                </div>
                <Badge variant="secondary">
                  {analytics.verification.pendingProperties}
                </Badge>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Pending</span>
                <span className="font-semibold">
                  {analytics.verification.pendingProfessionals +
                    analytics.verification.pendingStores +
                    analytics.verification.pendingProperties}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers & Geographic Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Professionals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Professionals
            </CardTitle>
            <CardDescription>By lead generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProfessionals && topProfessionals.length > 0 ? (
                topProfessionals.map((prof, index) => (
                  <div
                    key={prof.userId}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${
                          index === 0
                            ? "bg-amber-100 text-amber-700"
                            : index === 1
                              ? "bg-zinc-200 text-zinc-700"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-zinc-100 text-zinc-600"
                        }
                      `}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {prof.companyName}
                        </p>
                        {prof.verified && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold">{prof.value} leads</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geographic Distribution
            </CardTitle>
            <CardDescription>Professionals by county</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {geoData && geoData.length > 0 ? (
                geoData.map((item) => {
                  const maxCount = geoData[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={item.county} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">
                          {item.county.toLowerCase().replace(/_/g, " ")}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Analytics & Reports
        </h1>
        <p className="text-muted-foreground">
          Platform-wide analytics and performance metrics.
        </p>
      </div>

      {/* Analytics Dashboard */}
      <Suspense fallback={<AnalyticsLoading />}>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
