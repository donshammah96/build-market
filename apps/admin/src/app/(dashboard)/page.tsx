import {
  getDashboardStats,
  getVerificationStats,
  getPendingVerifications,
} from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  Briefcase,
  PlusCircle,
  Server,
  AlertCircle,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { VerificationAlertWidget } from "@/components/admin/verification/VerificationAlertWidget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch real data from your server action
  const [
    dashboardResponse,
    verificationStatsResponse,
    urgentVerificationsResponse,
  ] = await Promise.all([
    getDashboardStats(),
    getVerificationStats(),
    getPendingVerifications({
      status: "PENDING",
      limit: 100,
      sortBy: "submittedAt",
      sortOrder: "asc",
    }),
  ]);

  if (!dashboardResponse.success || !dashboardResponse.data) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="rounded-md bg-destructive/15 p-4 text-destructive font-medium">
            {dashboardResponse.error || "Unknown error"}
          </div>
          <div className="flex justify-center">
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-zinc-50 shadow transition-colors hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = dashboardResponse.data;
  const verificationStats = verificationStatsResponse.success
    ? verificationStatsResponse.data
    : null;
  const urgentItems =
    urgentVerificationsResponse.success && urgentVerificationsResponse.data
      ? urgentVerificationsResponse.data.items.filter((item) => {
          if (!item.submittedAt) return false;
          const submittedDate = new Date(item.submittedAt);
          const hoursSinceSubmission =
            (Date.now() - submittedDate.getTime()) / (1000 * 60 * 60);
          return hoursSinceSubmission > 48; // Urgent if pending > 48 hours
        })
      : [];

  // Calculate percentages for visual context
  const verificationRate =
    stats.professionalCount > 0
      ? (
          (stats.verifiedProfessionalCount / stats.professionalCount) *
          100
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Dashboard Overview
          </h1>
          <p className="text-zinc-500 mt-1">
            System-wide metrics and performance indicators.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          System Operational
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={stats.userCount}
          icon={Users}
          trend="+12% this month"
          color="blue"
        />
        <MetricCard
          title="Professionals"
          value={stats.professionalCount}
          icon={Briefcase}
          trend="Growing segment"
          color="purple"
        />
        <MetricCard
          title="Verified Pros"
          value={stats.verifiedProfessionalCount}
          subValue={`${verificationRate}% verified`}
          icon={UserCheck}
          color="emerald"
        />
        <MetricCard
          title="Active Projects"
          value={stats.activeProjectCount}
          icon={PlusCircle}
          trend="Currently in progress"
          color="amber"
        />
      </div>

      {/* Verification Metrics */}
      {verificationStats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pending Verifications"
            value={verificationStats.pending.total}
            icon={Clock}
            subValue={`${verificationStats.pending.professionals} pros, ${verificationStats.pending.stores} stores, ${verificationStats.pending.properties} props`}
            color="amber"
          />
          <MetricCard
            title="Verified This Month"
            value={verificationStats.verified.total}
            icon={CheckCircle2}
            subValue="Successfully verified"
            color="emerald"
          />
          <MetricCard
            title="Needs Correction"
            value={verificationStats.needsCorrection.total}
            icon={AlertCircle}
            subValue="Awaiting resubmission"
            color="amber"
          />
          <MetricCard
            title="Urgent Items"
            value={urgentItems.length}
            icon={AlertCircle}
            subValue={
              urgentItems.length > 0 ? ">48 hours pending" : "All caught up"
            }
            color={urgentItems.length > 0 ? "amber" : "emerald"}
          />
        </div>
      )}

      {/* Secondary Section: System Health & Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* System Health Widget */}
        <Card className="col-span-1 lg:col-span-2 border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Link href="/sign-in/" className="text-blue-600 hover:underline">
                Please sign in
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-md border border-zinc-200">
                    <Server className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      Database Status
                    </p>
                    <p className="text-xs text-zinc-500">PostgreSQL (Neon)</p>
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  Healthy
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-md border border-zinc-200">
                    <ShieldCheck className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      Auth Service
                    </p>
                    <p className="text-xs text-zinc-500">Clerk</p>
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  Online
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Alerts Widget */}
        <Card className="col-span-1 border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Verification Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VerificationAlertWidget
              urgentCount={urgentItems.length}
              pendingCount={verificationStats?.pending.total ?? 0}
              verificationStats={verificationStats ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Helper Component ---

type ColorVariant = "blue" | "emerald" | "purple" | "amber";

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  subValue?: string;
  color: ColorVariant;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  subValue,
  color,
}: MetricCardProps) {
  const colors: Record<ColorVariant, string> = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };

  const activeColor = colors[color] || colors.blue;

  return (
    <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            {title}
          </p>
          <div className={`p-2 rounded-lg border ${activeColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-bold text-zinc-900">{value}</div>
          {(trend || subValue) && (
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              {subValue || trend}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
