import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { getVerificationUserContext } from "@/lib/auth";
import { fetchVerificationOpsCases } from "@/lib/verification-ops-data";
import { z } from "zod";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AuthorityFilterSelect } from "./authority-filter-select";
import type {
  VerificationStatutoryAuthority,
  CompoundQueueType,
} from "@build/verification-domain";

export const dynamic = "force-dynamic";

const searchParamsSchema = z.object({
  queue: z
    .enum([
      "PENDING",
      "AUTOMATED_REVIEW",
      "NEEDS_CHANGES",
      "ESCALATED",
      "SLA_BREACHED",
      "VERIFIED",
      "REJECTED",
    ])
    .catch("PENDING"),
  authority: z
    .enum(["EBK", "BORAQS", "NCA", "EARB", "VRB", "ISK", "EPRA"])
    .optional()
    .catch(undefined),
  page: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = parseInt(val || "1", 10);
      return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
});

interface PageProps {
  searchParams: Promise<{
    queue?: string;
    authority?: string;
    page?: string;
  }>;
}

export default async function VerificationOpsDashboard({
  searchParams,
}: PageProps) {
  const userContext = await getVerificationUserContext();
  if (!userContext) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-zinc-100 p-6 text-center">
        <div className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center mb-4 text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Your account is authenticated, but lacks an active Admin Profile or
            authorization for the Verification Operations Center (§2
            Default-Deny Access Policy).
          </p>
          <div className="flex flex-col gap-3">
            <SignOutButton>
              <button
                type="button"
                className="w-full px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg font-medium text-sm transition-colors cursor-pointer"
              >
                Sign Out & Switch Account
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  const rawParams = await searchParams;
  const parsedParams = searchParamsSchema.parse(rawParams);
  const currentQueue = parsedParams.queue as CompoundQueueType;
  const currentAuthority = parsedParams.authority as
    VerificationStatutoryAuthority | undefined;
  const page = parsedParams.page;
  const pageSize = 20;

  // Query verification ops cases via Domain DTO data layer
  const { cases, totalCount, totalPages, slaHours } =
    await fetchVerificationOpsCases({
      queue: currentQueue,
      authority: currentAuthority,
      page,
      pageSize,
    });

  const queueTabs: { key: CompoundQueueType; label: string }[] = [
    { key: "PENDING", label: "Pending Queue" },
    { key: "AUTOMATED_REVIEW", label: "Processing (In-Flight)" },
    { key: "NEEDS_CHANGES", label: "Needs Review" },
    { key: "ESCALATED", label: "Escalated (4-Eyes)" },
    { key: "SLA_BREACHED", label: `SLA Breached (${slaHours}h)` },
    { key: "VERIFIED", label: "Verified" },
    { key: "REJECTED", label: "Rejected" },
  ];

  const statutoryAuthorities: { key: string; label: string }[] = [
    { key: "", label: "All Statutory Authorities" },
    { key: "EBK", label: "EBK (Engineers Board of Kenya)" },
    { key: "BORAQS", label: "BORAQS (Architects & QS Board)" },
    { key: "NCA", label: "NCA (National Construction Auth.)" },
    { key: "EARB", label: "EARB (Estate Agents Reg. Board)" },
    { key: "VRB", label: "VRB (Valuers Registration Board)" },
    { key: "ISK", label: "ISK (Institution of Surveyors)" },
    { key: "EPRA", label: "EPRA (Energy & Petroleum Auth.)" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 text-zinc-100 min-h-screen">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Verification Operations Center
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                verification-ops
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Statutory regulator license verification surface (§1 Topology)
            </p>
          </div>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-zinc-200">
              {userContext.fullName}
            </p>
            <p className="text-[10px] font-mono text-emerald-400">
              {userContext.verificationRole}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-xs font-bold text-emerald-400">
            {userContext.fullName[0] || "V"}
          </div>
        </div>
      </header>

      {/* Queue Tabs Bar with next/link */}
      <div className="bg-zinc-850 border-b border-zinc-800 px-6 pt-4 flex gap-1 overflow-x-auto">
        {queueTabs.map((tab) => {
          const isActive = currentQueue === tab.key;
          const queryParams = new URLSearchParams();
          queryParams.set("queue", tab.key);
          if (currentAuthority) {
            queryParams.set("authority", currentAuthority);
          }
          return (
            <Link
              key={tab.key}
              href={`/?${queryParams.toString()}`}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
                isActive
                  ? "border-emerald-500 text-emerald-400 bg-zinc-800"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <p className="text-xs text-zinc-400">Queue Total Items</p>
            <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <p className="text-xs text-zinc-400">Governance Policy</p>
            <p className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" />
              Four-Eyes Required (Escalated)
            </p>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <p className="text-xs text-zinc-400">Evidence Audit</p>
            <p className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" />
              Append-Only Audit Active
            </p>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <p className="text-xs text-zinc-400">Packet Exporting</p>
            <p className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {userContext.canExportPackets
                ? "Export Enabled"
                : "Export Restricted"}
            </p>
          </div>
        </div>

        {/* Queue Toolbar & Controls */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white">
                Verification Cases ({totalCount})
              </h2>
              <span className="text-xs text-zinc-400 font-mono">
                Page {page} of {totalPages}
              </span>
            </div>

            {/* Authority Filter Select — Client Component (onChange cannot live in a Server Component) */}
            <AuthorityFilterSelect
              currentQueue={currentQueue}
              currentAuthority={currentAuthority}
              authorities={statutoryAuthorities}
            />
          </div>

          {/* Case Table */}
          {cases.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-sm">
              No verification cases found matching current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <caption className="sr-only">
                  Statutory Regulator License Verification Cases Queue
                </caption>
                <thead className="bg-zinc-850 text-zinc-400 uppercase tracking-wider font-mono border-b border-zinc-700">
                  <tr>
                    <th className="px-6 py-3">Authority</th>
                    <th className="px-6 py-3">License No.</th>
                    <th className="px-6 py-3">Professional</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Confidence</th>
                    <th className="px-6 py-3">Submitted</th>
                    <th className="px-6 py-3">SLA Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/50">
                  {cases.map((item) => {
                    let statusBadgeClass =
                      "bg-zinc-800 text-zinc-300 border-zinc-700";
                    if (
                      item.status === "AUTO_VERIFIED" ||
                      item.status === "MANUALLY_VERIFIED"
                    ) {
                      statusBadgeClass =
                        "bg-emerald-950/70 text-emerald-300 border-emerald-800";
                    } else if (
                      item.status === "AUTO_REJECTED" ||
                      item.status === "MANUALLY_REJECTED"
                    ) {
                      statusBadgeClass =
                        "bg-red-950/70 text-red-300 border-red-800";
                    } else if (
                      item.status === "NEEDS_MANUAL_REVIEW" ||
                      item.status === "LOW_CONFIDENCE" ||
                      item.status === "REGULATOR_UNAVAILABLE"
                    ) {
                      statusBadgeClass =
                        "bg-amber-950/70 text-amber-300 border-amber-800";
                    } else if (
                      item.status === "PROCESSING" ||
                      item.status === "QUEUED"
                    ) {
                      statusBadgeClass =
                        "bg-blue-950/70 text-blue-300 border-blue-800";
                    }

                    return (
                      <tr
                        key={item.caseId}
                        className="hover:bg-zinc-750 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-white">
                          {item.authority}
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-200">
                          {item.licenseNumber}
                        </td>
                        <td className="px-6 py-4 text-zinc-200 font-medium">
                          {item.professionalName}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${statusBadgeClass}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-300">
                          {(item.confidenceScore * 100).toFixed(0)}%
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {new Date(item.submittedAt)
                            .toISOString()
                            .substring(0, 10)}
                        </td>
                        <td className="px-6 py-4">
                          {item.isSlaBreached ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" /> SLA
                              Breached
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <Clock className="h-3.5 w-3.5" /> On Track
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {userContext.canExportPackets && (
                            <button
                              type="button"
                              title="Export Decision Packet"
                              aria-label="Export Decision Packet"
                              className="p-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors inline-flex items-center cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="px-6 py-4 border-t border-zinc-700 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Showing page {page} of {totalPages} ({totalCount} total cases)
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/?queue=${currentQueue}${
                    currentAuthority ? `&authority=${currentAuthority}` : ""
                  }&page=${page - 1}`}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-zinc-900 text-xs text-zinc-600 font-medium inline-flex items-center gap-1 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`/?queue=${currentQueue}${
                    currentAuthority ? `&authority=${currentAuthority}` : ""
                  }&page=${page + 1}`}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-zinc-900 text-xs text-zinc-600 font-medium inline-flex items-center gap-1 cursor-not-allowed">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
