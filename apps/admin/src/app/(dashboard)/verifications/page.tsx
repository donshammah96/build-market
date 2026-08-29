import { Suspense } from "react";
import { getPendingVerifications, getVerificationStats } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";
import type { VerificationStatus } from "@/actions/admin/types";
import { VerificationStatsCards } from "@/components/admin/verification/VerificationStatsCards";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionErrorState } from "@/components/ui/action-error-state";
import { VerificationQueueWrapper } from "@/app/(dashboard)/verifications/VerificationQueueWrapper";

export const dynamic = "force-dynamic";

// Loading skeleton for stats
function StatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

// Loading skeleton for queue
function QueueLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

interface VerificationsPageProps {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    page?: string;
    search?: string;
  }>;
}

export default async function VerificationsPage({
  searchParams,
}: VerificationsPageProps) {
  const params = await searchParams;
  const activeTab =
    (params.tab as "all" | "professional" | "store" | "property") || "all";
  const status = (params.status as VerificationStatus) || "PENDING";
  const page = parseInt(params.page || "1", 10);

  // Fetch stats and initial queue data in parallel
  const [statsResponse, queueResponse, permissions] = await Promise.all([
    getVerificationStats(),
    getPendingVerifications({
      entityType: activeTab,
      status,
      page,
      limit: 20,
    }),
    getAdminPermissions(),
  ]);

  const canVerify = ["SUPER_ADMIN", "VERIFICATION_SPECIALIST"].includes(
    permissions.granularRole || "",
  );

  const hasStatsError = !statsResponse.success;
  const hasQueueError = !queueResponse.success;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verifications</h1>
          <p className="text-muted-foreground">
            Review and manage verification requests for professionals, stores,
            and properties.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        {hasStatsError ? (
          <ActionErrorState
            title="Unable to load verification statistics"
            description={`Failed to load verification statistics. ${statsResponse.error || "Unknown error"}`}
          />
        ) : (
          <VerificationStatsCards stats={statsResponse.data!} />
        )}
      </Suspense>

      {/* Tabs and Queue */}
      <Suspense fallback={<QueueLoading />}>
        {hasQueueError ? (
          <ActionErrorState
            title="Unable to load verification queue"
            description={`Failed to load verification queue. ${queueResponse.error || "Unknown error"}`}
          />
        ) : queueResponse.data ? (
          <VerificationQueueWrapper
            activeTab={activeTab}
            status={status}
            canVerify={canVerify}
            queueData={queueResponse.data}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
