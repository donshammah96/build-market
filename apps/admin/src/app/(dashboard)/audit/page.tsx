import { Suspense } from "react";
import { getAuditLogs, type AuditLogFilterInput } from "@/actions/admin";

export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  User,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Plus,
  Eye,
  Shield,
  Clock,
} from "lucide-react";

interface AuditPageProps {
  searchParams: Promise<{
    page?: string;
    entityType?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

const actionIcons: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-4 w-4 text-emerald-500" />,
  UPDATE: <Edit className="h-4 w-4 text-blue-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  VIEW: <Eye className="h-4 w-4 text-zinc-500" />,
  VERIFY: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  REJECT: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  LOGIN: <Shield className="h-4 w-4 text-blue-500" />,
  LOGOUT: <Shield className="h-4 w-4 text-zinc-400" />,
};

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  VIEW: "bg-zinc-100 text-zinc-700 border-zinc-200",
  VERIFY: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECT: "bg-amber-100 text-amber-700 border-amber-200",
  LOGIN: "bg-blue-100 text-blue-700 border-blue-200",
  LOGOUT: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

async function AuditStats() {
  // Get recent audit stats
  const todayResponse = await getAuditLogs({
    dateFrom: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    limit: 1000,
  });

  const weekResponse = await getAuditLogs({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 1000,
  });

  const todayCount = todayResponse.success
    ? todayResponse.data?.logs.length || 0
    : 0;
  const weekCount = weekResponse.success
    ? weekResponse.data?.logs.length || 0
    : 0;

  // Count by action type
  const logs =
    weekResponse.success && weekResponse.data ? weekResponse.data.logs : [];
  const createCount = logs.filter((l) => l.action === "CREATE").length;
  const updateCount = logs.filter((l) => l.action === "UPDATE").length;
  const deleteCount = logs.filter((l) => l.action === "DELETE").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Today&#39;s Activity
          </CardTitle>
          <Clock className="h-4 w-4 text-zinc-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayCount}</div>
          <p className="text-xs text-zinc-500">actions logged today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Creates
          </CardTitle>
          <Plus className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {createCount}
          </div>
          <p className="text-xs text-zinc-500">this week</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Updates
          </CardTitle>
          <Edit className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{updateCount}</div>
          <p className="text-xs text-zinc-500">this week</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">
            Deletes
          </CardTitle>
          <Trash2 className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{deleteCount}</div>
          <p className="text-xs text-zinc-500">this week</p>
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

async function AuditLogsList({
  searchParams,
}: {
  searchParams: AuditPageProps["searchParams"];
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const filters: Partial<AuditLogFilterInput> = {};

  if (params.entityType) {
    const validEntityTypes = [
      "user",
      "property",
      "store",
      "professional",
      "settings",
      "all",
    ] as const;
    if (
      validEntityTypes.includes(
        params.entityType as (typeof validEntityTypes)[number]
      )
    ) {
      filters.entityType =
        params.entityType as (typeof validEntityTypes)[number];
    }
  }
  if (params.action) filters.action = params.action;
  if (params.userId) filters.adminId = params.userId;
  if (params.startDate)
    filters.dateFrom = new Date(params.startDate).toISOString();
  if (params.endDate) filters.dateTo = new Date(params.endDate).toISOString();

  const response = await getAuditLogs({
    page,
    limit: 50,
    ...filters,
  });

  if (!response.success || !response.data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">
            Failed to load audit logs: {response.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { logs, meta } = response.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Complete history of system activities and changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 mb-1">
              No audit logs found
            </h3>
            <p className="text-zinc-500">
              Activity will appear here as users interact with the system
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={log.id}>
                <div className="flex items-start gap-4 py-4 hover:bg-zinc-50 rounded-lg px-3 -mx-3 transition-colors">
                  {/* Action Icon */}
                  <div className="mt-0.5">
                    {actionIcons[log.action] || (
                      <Activity className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={actionColors[log.action] || ""}
                      >
                        {log.action}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {log.entityType}
                      </Badge>
                    </div>

                    <p className="text-sm text-zinc-900 mb-1">
                      {`${log.action} on ${log.entityType}`}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      {log.adminName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.adminName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {log.entityId && (
                        <span className="font-mono text-zinc-400">
                          ID: {log.entityId.slice(0, 8)}...
                        </span>
                      )}
                    </div>

                    {/* Show details changes if available */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">
                          View changes
                        </summary>
                        <pre className="mt-2 p-2 bg-zinc-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right text-xs text-zinc-400 whitespace-nowrap">
                    {formatRelativeTime(new Date(log.createdAt))}
                  </div>
                </div>
                {index < logs.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}

        {/* Pagination Info */}
        {meta.total > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1} to{" "}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}{" "}
              entries
            </span>
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function LogsLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 py-4">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="flex-1">
                <div className="flex gap-2 mb-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Audit Logs</h1>
        <p className="text-zinc-500 mt-1">
          Track all system activities and administrative actions
        </p>
      </div>

      {/* Stats Overview */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <AuditStats />
      </Suspense>

      {/* Audit Logs */}
      <Suspense fallback={<LogsLoadingSkeleton />}>
        <AuditLogsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
