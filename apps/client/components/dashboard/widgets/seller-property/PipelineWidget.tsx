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
    color: "text-primary bg-primary/10",
  },
  {
    id: "offer",
    label: "Offers Pending",
    icon: FileText,
    color: "text-muted-foreground bg-muted",
  },
  {
    id: "closing",
    label: "Ready to Close",
    icon: CheckCircle2,
    color: "text-accent-foreground bg-accent",
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
    <div className="flex items-center gap-3 p-3 hover:bg-muted/60 rounded-lg motion-safe:transition-colors">
      <div className={cn("p-2 rounded-lg", stage.color.split(" ")[1])}>
        <Icon className={cn("h-4 w-4", stage.color.split(" ")[0])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{stage.label}</p>
        <p className="text-sm font-bold text-foreground">{stage.count}</p>
      </div>
      {stage.value > 0 && (
        <span className="text-xs font-medium text-muted-foreground">
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
    <Card className="border border-border shadow-sm bg-card">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-24 bg-muted rounded motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 motion-safe:animate-pulse"
            >
              <div className="h-9 w-9 bg-muted rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="h-2 w-24 bg-muted rounded" />
                <div className="h-4 w-8 bg-muted rounded" />
              </div>
              <div className="h-3 w-16 bg-muted rounded" />
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
    <Card className={cn("border border-border shadow-sm bg-card", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Sales Pipeline
        </CardTitle>
        <Link
          href="/professional-portal/pipeline"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          Details{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {/* Total Value Header */}
        {totalValue > 0 && (
          <div className="mx-3 mb-3 p-3 bg-gradient-to-r from-primary/10 to-transparent rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] text-primary uppercase font-medium">
                  Pipeline Value
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatTotalValue(totalValue)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stages */}
        {totalCount === 0 ? (
          <div className="p-6 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No active deals</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
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
