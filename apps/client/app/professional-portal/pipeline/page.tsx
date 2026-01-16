"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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

// Property Inquiry interface matching API response
interface PropertyInquiry {
  id: string;
  propertyTitle: string;
  clientName: string;
  clientPhone: string;
  message: string;
  status: "new" | "contacted" | "viewing_scheduled" | "offer_made" | "closed";
  createdAt: string;
}

interface PipelineStage {
  id: string;
  label: string;
  count: number;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  status: "viewing_scheduled" | "offer_made" | "closed";
}

const STAGES: Omit<PipelineStage, "count" | "value">[] = [
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

/**
 * PipelinePage Component
 *
 * Enterprise-level sales pipeline interface with:
 * - Kanban-style pipeline view
 * - Inquiries grouped by stage
 * - Links to inquiry detail pages
 * - Pipeline value tracking
 */
export default function PipelinePage() {
  // Fetch Pipeline Summary
  const { data: pipelineData, isLoading: isLoadingPipeline } = useQuery<{
    data: { stages: PipelineStage[]; totalValue: number };
  }>({
    queryKey: ["professional-pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/pipeline");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pipeline");
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Fetch Inquiries for each stage
  const { data: inquiriesData, isLoading: isLoadingInquiries } = useQuery<{
    data: PropertyInquiry[];
  }>({
    queryKey: ["professional-inquiries"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/inquiries?limit=100");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch inquiries");
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Ensure inquiries is always an array
  const inquiries = useMemo(() => {
    if (!inquiriesData) return [];
    if (Array.isArray(inquiriesData)) return inquiriesData;
    if (inquiriesData.data && Array.isArray(inquiriesData.data)) {
      return inquiriesData.data;
    }
    return [];
  }, [inquiriesData]);

  // Get pipeline stages with data
  const stages = useMemo(() => {
    if (!pipelineData?.data?.stages) {
      return STAGES.map((stage) => ({ ...stage, count: 0, value: 0 }));
    }
    return STAGES.map((stage) => {
      const apiStage = pipelineData.data.stages.find((s) => s.id === stage.id);
      return {
        ...stage,
        count: apiStage?.count || 0,
        value: apiStage?.value || 0,
      };
    });
  }, [pipelineData]);

  // Group inquiries by stage
  const inquiriesByStage = useMemo(() => {
    const grouped: Record<string, PropertyInquiry[]> = {
      viewing_scheduled: [],
      offer_made: [],
      closed: [],
    };

    inquiries.forEach((inquiry) => {
      const status = inquiry.status;
      if (
        status === "viewing_scheduled" ||
        status === "offer_made" ||
        status === "closed"
      ) {
        const stageArray = grouped[status];
        if (stageArray) {
          stageArray.push(inquiry);
        }
      }
    });

    return grouped;
  }, [inquiries]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalValue = pipelineData?.data?.totalValue || 0;
  const isLoading = isLoadingPipeline || isLoadingInquiries;

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
            const stageInquiries = inquiriesByStage[stage.status] || [];

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

function InquiryCard({
  inquiry,
  stageColor,
}: {
  inquiry: PropertyInquiry;
  stageColor: string;
}) {
  return (
    <Link href={`/professional-portal/inquiries/${inquiry.id}`}>
      <Card className="border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all duration-200 bg-white cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-zinc-900 text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors">
                {inquiry.propertyTitle}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3 text-zinc-400" />
                <span className="text-xs text-zinc-500">Property</span>
              </div>
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors flex-shrink-0",
                stageColor
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
                {inquiry.clientName.charAt(0).toUpperCase()}
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
