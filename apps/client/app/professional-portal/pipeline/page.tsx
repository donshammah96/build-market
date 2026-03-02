"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Eye,
  FileText,
  CheckCircle2,
  TrendingUp,
  Building2,
  Phone,
  Calendar,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { usePipelineSummary } from "@/hooks/usePipeline";
import { useInquiries } from "@/hooks/useInquiries";
import type { PropertyInquiryList } from "@/lib/inquiries-client";

// ─── Static stage config ───────────────────────────────────────────────────

interface PipelineStageConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  status: "viewing_scheduled" | "offer_made" | "closed";
}

const STAGES: PipelineStageConfig[] = [
  {
    id: "viewing",
    label: "Viewings Scheduled",
    icon: Eye,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    status: "viewing_scheduled",
  },
  {
    id: "offer",
    label: "Offers Pending",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    status: "offer_made",
  },
  {
    id: "closing",
    label: "Ready to Close",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    status: "closed",
  },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * PipelinePage Component
 *
 * Enterprise-level sales pipeline interface with:
 * - Kanban-style pipeline view via custom hooks (usePipelineSummary + useInquiries)
 * - Inquiries grouped by stage
 * - Links to inquiry detail pages
 * - Pipeline value tracking
 */
export default function PipelinePage() {
  // ─── Data Fetching via custom hooks ────────────────────────────────────

  const { data: pipelineSummary, isLoading: isLoadingPipeline } =
    usePipelineSummary();

  // Request up to 100 inquiries to populate pipeline stages.
  // InquiriesQuerySchema.limit is a string-coercing field (z.string → transform → number).
  const { data: inquiries = [], isLoading: isLoadingInquiries } = useInquiries({
    limit: "100",
  } as unknown as Parameters<typeof useInquiries>[0]);

  const isLoading = isLoadingPipeline || isLoadingInquiries;
  const totalValue = pipelineSummary?.totalValue ?? 0;

  // ─── Computed state ────────────────────────────────────────────────────

  /** Merge static stage config with live counts/values from the API. */
  const stages = useMemo(() => {
    return STAGES.map((stage) => {
      const apiStage = pipelineSummary?.stages?.find(
        (s: { id: string; count: number; value: number }) => s.id === stage.id,
      );
      return {
        ...stage,
        count: apiStage?.count ?? 0,
        value: apiStage?.value ?? 0,
      };
    });
  }, [pipelineSummary]);

  /** Group inquiries by pipeline status key. */
  const inquiriesByStage = useMemo(() => {
    const grouped: Record<string, PropertyInquiryList[]> = {
      viewing_scheduled: [],
      offer_made: [],
      closed: [],
    };

    inquiries.forEach((inquiry) => {
      const status = inquiry.status as string;
      if (
        status === "viewing_scheduled" ||
        status === "offer_made" ||
        status === "closed"
      ) {
        grouped[status]?.push(inquiry);
      }
    });

    return grouped;
  }, [inquiries]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Sales Pipeline
          </h1>
          <p className="text-zinc-500 mt-1">
            Track property inquiries through the sales process.
          </p>
        </div>
        {totalValue > 0 && (
          <Card className="border border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-medium">
                    Total Pipeline Value
                  </p>
                  <p className="text-xl font-bold text-emerald-700">
                    {formatCurrency(totalValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pipeline Stages */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-zinc-200">
              <CardHeader>
                <div className="h-6 w-32 bg-zinc-200 animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-24 bg-zinc-100 animate-pulse rounded"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const stageInquiries = inquiriesByStage[stage.status] ?? [];

            return (
              <Card
                key={stage.id}
                className="border border-zinc-200 shadow-sm bg-white"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", stage.bgColor)}>
                        <Icon className={cn("h-5 w-5", stage.color)} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-zinc-900">
                          {stage.label}
                        </CardTitle>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {stage.count}{" "}
                          {stage.count === 1 ? "inquiry" : "inquiries"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {stage.value > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-100">
                      <p className="text-xs text-zinc-500">Stage Value</p>
                      <p className="text-lg font-bold text-zinc-900">
                        {formatCurrency(stage.value)}
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {stageInquiries.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400">
                      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No inquiries in this stage</p>
                    </div>
                  ) : (
                    stageInquiries.map((inquiry) => (
                      <InquiryCard
                        key={inquiry.id}
                        inquiry={inquiry}
                        stageColor={stage.color}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── InquiryCard Component ─────────────────────────────────────────────────

function InquiryCard({
  inquiry,
  stageColor,
}: {
  inquiry: PropertyInquiryList;
  stageColor: string;
}) {
  return (
    <Link href={`/professional-portal/inquiries/${inquiry.id}`}>
      <Card className="border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all duration-200 bg-white cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-zinc-900 text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors">
                {inquiry.propertyTitle ?? "Untitled Inquiry"}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3 text-zinc-400" />
                <span className="text-xs text-zinc-500">Property</span>
              </div>
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors flex-shrink-0",
                stageColor,
              )}
            />
          </div>

          {inquiry.message && (
            <p className="text-xs text-zinc-600 line-clamp-2 mt-2">
              {inquiry.message}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
            <Avatar className="h-6 w-6 border border-zinc-200">
              <AvatarFallback className="text-xs">
                {inquiry.clientName?.charAt(0).toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-900 truncate">
                {inquiry.clientName}
              </p>
              {inquiry.clientPhone && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs text-zinc-500 truncate">
                    {inquiry.clientPhone}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-50">
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Calendar className="h-3 w-3" />
              {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
            <Badge
              variant="outline"
              className="text-xs border-zinc-200 text-zinc-600"
            >
              View Details
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
