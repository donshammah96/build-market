// ============================================================================
// SystemInfrastructureWidget
// ============================================================================
// Async React Server Component that runs real infrastructure health probes
// and renders them as a status list.
//
// Usage in page.tsx:
//
//   import { Suspense } from "react";
//   import {
//     SystemInfrastructureWidget,
//     SystemInfrastructureSkeleton,
//   } from "@/components/admin/dashboard/SystemInfrastructureWidget";
//
//   <Suspense fallback={<SystemInfrastructureSkeleton />}>
//     <SystemInfrastructureWidget />
//   </Suspense>
//
// The Suspense boundary means health probes load independently of the main
// dashboard stats above it — the page is never blocked waiting for Redis
// or database pings to resolve.
// ============================================================================

import { systemHealthService } from "@/lib/domains/system-health/service";
import type {
  ServiceStatus,
  SystemHealthEntry,
} from "@/lib/domains/system-health/contracts";
import {
  Server,
  Zap,
  Radio,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

// ── Icon map ─────────────────────────────────────────────────────────────

const SERVICE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  database: Server,
  cache: Zap,
  "message-bus": Radio,
  auth: ShieldCheck,
};

function ServiceIcon({ id, status }: { id: string; status: ServiceStatus }) {
  const Icon = SERVICE_ICON[id] ?? Server;
  const colorClass = {
    healthy: "text-emerald-500",
    degraded: "text-amber-500",
    unhealthy: "text-red-500",
    unknown: "text-zinc-400",
  }[status];
  return <Icon className={`h-4 w-4 ${colorClass}`} />;
}

// ── Status badge ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  ServiceStatus,
  {
    label: string;
    classes: string;
    dot: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  healthy: {
    label: "Healthy",
    classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    classes: "text-amber-700 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    Icon: AlertTriangle,
  },
  unhealthy: {
    label: "Unhealthy",
    classes: "text-red-700 bg-red-50 border-red-200",
    dot: "bg-red-500",
    Icon: XCircle,
  },
  unknown: {
    label: "Unknown",
    classes: "text-zinc-500 bg-zinc-100 border-zinc-200",
    dot: "bg-zinc-400",
    Icon: HelpCircle,
  },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const { label, classes, dot } = STATUS_BADGE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ── Individual service row ────────────────────────────────────────────────

function ServiceRow({ check }: { check: SystemHealthEntry }) {
  const hasLatency =
    check.latencyMs !== undefined && check.status !== "unknown";

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100 gap-4">
      {/* Left: icon + service info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 p-2 bg-white rounded-md border border-zinc-200">
          <ServiceIcon id={check.id} status={check.status} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">
            {check.name}
          </p>
          <p className="text-xs text-zinc-500 truncate">{check.description}</p>
          {check.detail && check.status !== "healthy" && (
            <p className="text-[10px] text-zinc-400 mt-0.5 truncate font-mono">
              {check.detail}
            </p>
          )}
        </div>
      </div>

      {/* Right: latency + status badge */}
      <div className="flex items-center gap-2 shrink-0">
        {hasLatency && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
            <Clock className="h-3 w-3" />
            {check.latencyMs}ms
          </span>
        )}
        <StatusBadge status={check.status} />
      </div>
    </div>
  );
}

// ── Overall status header strip ───────────────────────────────────────────

function OverallStatusStrip({
  status,
  checkedAt,
}: {
  status: ServiceStatus;
  checkedAt: string;
}) {
  const config = {
    healthy: {
      text: "All systems operational",
      classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-500 animate-pulse",
    },
    degraded: {
      text: "Some services degraded",
      classes: "text-amber-700 bg-amber-50 border-amber-200",
      dot: "bg-amber-500 animate-pulse",
    },
    unhealthy: {
      text: "Service disruption detected",
      classes: "text-red-700 bg-red-50 border-red-200",
      dot: "bg-red-500 animate-pulse",
    },
    unknown: {
      text: "Status indeterminate",
      classes: "text-zinc-500 bg-zinc-100 border-zinc-200",
      dot: "bg-zinc-400",
    },
  }[status];

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium mb-4 ${config.classes}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
        {config.text}
      </span>
      <span className="font-mono text-[10px] opacity-70">
        {new Date(checkedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}

// ── Skeleton (Suspense fallback) ──────────────────────────────────────────

export function SystemInfrastructureSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading system health">
      {/* Overall status strip skeleton */}
      <div className="h-8 bg-zinc-100 rounded-lg border border-zinc-200" />
      {/* Four service row skeletons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-zinc-200 rounded-md" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-zinc-200 rounded" />
              <div className="h-2.5 w-32 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="h-5 w-16 bg-zinc-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Error fallback (used when the probe itself throws) ────────────────────

function ProbeError() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-400" />
      <p className="text-sm font-medium text-zinc-700">
        Health check unavailable
      </p>
      <p className="text-xs text-zinc-400 max-w-50">
        Could not reach infrastructure services. Reload to retry.
      </p>
    </div>
  );
}

// ── Main async RSC ────────────────────────────────────────────────────────

/**
 * Async RSC — fetches real infrastructure health probe results and renders
 * a status list. Must be wrapped in <Suspense> at the call site.
 *
 * Auth precondition: the (dashboard) layout.tsx enforces Clerk authentication
 * before any child RSC is rendered. No explicit actor / safeAction wrapper is
 * required here — infrastructure health status is non-sensitive diagnostic
 * data visible to all authenticated admins.
 */
export async function SystemInfrastructureWidget() {
  let health;
  try {
    health = await systemHealthService.getSystemHealth();
  } catch {
    return <ProbeError />;
  }

  return (
    <div>
      <OverallStatusStrip
        status={health.overallStatus}
        checkedAt={health.checkedAt}
      />
      <div className="space-y-3">
        {health.checks.map((check) => (
          <ServiceRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}
