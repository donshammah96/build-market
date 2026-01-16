"use client";

import Link from "next/link";
import {
  Eye,
  FileText,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface PipelineStage {
  id: string;
  label: string;
  count: number;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export interface PipelineWidgetProps {
  /** Pipeline stages */
  stages?: PipelineStage[];
  /** Total pipeline value */
  totalValue?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// DEFAULT STAGES
// ============================================================================

const DEFAULT_STAGES: Omit<PipelineStage, "count" | "value">[] = [
  {
    id: "viewing",
    label: "Viewings Scheduled",
    icon: Eye,
    color: "text-blue-500 bg-blue-50",
  },
  {
    id: "offer",
    label: "Offers Pending",
    icon: FileText,
    color: "text-amber-500 bg-amber-50",
  },
  {
    id: "closing",
    label: "Ready to Close",
    icon: CheckCircle2,
    color: "text-emerald-500 bg-emerald-50",
  },
];

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface StageItemProps {
  stage: PipelineStage;
}

function StageItem({ stage }: StageItemProps) {
  const Icon = stage.icon;

  const formatValue = (amount: number) => {
    if (amount >= 1000000) {
      return `KSh ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `KSh ${(amount / 1000).toFixed(0)}k`;
    }
    return `KSh ${amount}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-lg transition-colors">
      <div className={cn("p-2 rounded-lg", stage.color.split(" ")[1])}>
        <Icon className={cn("h-4 w-4", stage.color.split(" ")[0])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500">{stage.label}</p>
        <p className="text-sm font-bold text-zinc-900">{stage.count}</p>
      </div>
      {stage.value > 0 && (
        <span className="text-xs font-medium text-zinc-500">
          {formatValue(stage.value)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function PipelineWidgetSkeleton() {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-24 bg-zinc-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 bg-zinc-200 rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="h-2 w-24 bg-zinc-200 rounded" />
                <div className="h-4 w-8 bg-zinc-200 rounded" />
              </div>
              <div className="h-3 w-16 bg-zinc-200 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PipelineWidget({
  stages,
  totalValue = 0,
  isLoading = false,
  className,
}: PipelineWidgetProps) {
  if (isLoading) {
    return <PipelineWidgetSkeleton />;
  }

  // Use provided stages or default empty stages
  const displayStages: PipelineStage[] =
    stages ||
    DEFAULT_STAGES.map((s) => ({
      ...s,
      count: 0,
      value: 0,
    }));

  const totalCount = displayStages.reduce((sum, s) => sum + s.count, 0);

  const formatTotalValue = (amount: number) => {
    if (amount >= 1000000) {
      return `KSh ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `KSh ${(amount / 1000).toFixed(0)}k`;
    }
    return `KSh ${amount}`;
  };

  return (
    <Card className={cn("border border-zinc-200 shadow-sm bg-white", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Sales Pipeline
        </CardTitle>
        <Link
          href="/professional-portal/pipeline"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          Details{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {/* Total Value Header */}
        {totalValue > 0 && (
          <div className="mx-3 mb-3 p-3 bg-gradient-to-r from-emerald-50 to-transparent rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-[10px] text-emerald-600 uppercase font-medium">
                  Pipeline Value
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatTotalValue(totalValue)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stages */}
        {totalCount === 0 ? (
          <div className="p-6 text-center">
            <TrendingUp className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No active deals</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Schedule viewings to build your pipeline
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayStages.map((stage) => (
              <StageItem key={stage.id} stage={stage} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PipelineWidget;
