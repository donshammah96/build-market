import { adminEnvConfig } from "@/lib/infrastructure/env";
import { Suspense } from "react";
import { listRegulatorVerificationCases } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";
import { RegulatorVerificationQueue } from "@/components/admin/verification/RegulatorVerificationQueue";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionErrorState } from "@/components/ui/action-error-state";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

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

interface PageProps {
  searchParams: Promise<{
    status?: string;
    authority?: string;
    page?: string;
  }>;
}

export default async function RegulatorVerificationsPage({
  searchParams,
}: PageProps) {
  const verificationOpsUrl =
    adminEnvConfig.NEXT_PUBLIC_VERIFICATION_OPS_URL || "http://localhost:3501";
  const params = await searchParams;
  const statusParam = params.status;
  const authority = params.authority;
  const page = parseInt(params.page || "1", 10);
  const filterStatus = statusParam ? [statusParam] : undefined;
  const [casesResponse, permissions] = await Promise.all([
    listRegulatorVerificationCases({
      status: filterStatus,
      authority,
      page,
      pageSize: 25,
    }),
    getAdminPermissions(),
  ]);
  const hasError = !casesResponse.success;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Regulator Manual Verification Operator Queue
          </h1>
          <p className="text-muted-foreground">
            Triage dead-letter cases, review regulator evidence snapshots, and
            record multi-approver manual decisions across statutory authorities.
          </p>
        </div>
        {/* Phase 8 Read-Only Shadow Mode Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Shadow Mode Active:</strong> Verification mutations have
              migrated to the standalone{" "}
              <strong>
                Verification Ops surface (`apps/verification-ops`)
              </strong>
              .
            </span>
          </div>
          <a
            href={verificationOpsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 transition-colors ml-4 shrink-0"
          >
            Open apps/verification-ops &rarr;
          </a>
        </div>
        {permissions.granularRole && (
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Shield className="h-3.5 w-3.5" />
            {permissions.granularRole.replace(/_/g, " ")}
          </Badge>
        )}
      </div>
      <Suspense fallback={<QueueLoading />}>
        {hasError ? (
          <ActionErrorState
            title="Unable to load regulator verification cases"
            description={
              casesResponse.error || "Failed to fetch regulator cases queue"
            }
          />
        ) : casesResponse.data ? (
          <RegulatorVerificationQueue
            items={casesResponse.data.items}
            total={casesResponse.data.pagination.total}
            page={casesResponse.data.pagination.page}
            pageSize={casesResponse.data.pagination.limit}
            filters={casesResponse.data.filters}
            onFilterChange={() => {}}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
