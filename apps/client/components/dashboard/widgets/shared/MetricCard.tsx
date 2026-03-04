"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface MetricCardProps {
  /** Metric title */
  title: string;
  /** Formatted value to display */
  value: string;
  /** Trend text (e.g., "+12%", "On Track") */
  trend?: string;
  /** Trend direction for icon */
  trendDirection?: "up" | "down" | "neutral";
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Sparkline chart data (array of percentages 0-100) */
  chart?: number[];
  /** Whether to use highlighted (dark) style */
  highlight?: boolean;
  /** Optional className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MetricCard({
  title,
  value,
  trend,
  trendDirection = "up",
  icon: Icon,
  chart = [],
  highlight = false,
  className,
  isLoading = false,
}: MetricCardProps) {
  // Determine trend icon
  const TrendIcon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
        ? TrendingDown
        : Minus;

  // Determine trend color
  const getTrendColor = () => {
    if (highlight) {
      return trendDirection === "up"
        ? "text-emerald-400 bg-emerald-500/10"
        : trendDirection === "down"
          ? "text-red-400 bg-red-500/10"
          : "text-zinc-400 bg-zinc-500/10";
    }
    return trendDirection === "up"
      ? "text-emerald-600 bg-emerald-50"
      : trendDirection === "down"
        ? "text-red-600 bg-red-50"
        : "text-zinc-600 bg-zinc-100";
  };

  if (isLoading) {
    return (
      <Card
        className={cn("border border-zinc-200 shadow-sm bg-white", className)}
      >
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between">
              <div className="h-11 w-11 bg-zinc-200 rounded-xl" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="w-1.5 h-8 bg-zinc-200 rounded" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-8 w-28 bg-zinc-200 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500 group",
        highlight
          ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-0 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.45)] hover:-translate-y-1"
          : "border border-zinc-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white/80 backdrop-blur-sm",
        className,
      )}
    >
      {/* Animated shimmer effect for highlighted cards */}
      {highlight && (
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
        </div>
      )}

      {/* Subtle gradient overlay */}
      {highlight && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-2xl" />
      )}

      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div
            className={cn(
              "p-3 rounded-xl transition-all duration-300",
              highlight
                ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : "bg-gradient-to-br from-zinc-100 to-zinc-50 border border-zinc-200/50 text-zinc-500 group-hover:text-zinc-900 group-hover:border-zinc-300",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* Sparkline chart */}
          {chart.length > 0 && (
            <div className="flex items-end gap-1 h-10 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
              {chart.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-t transition-all duration-300",
                    highlight
                      ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-t from-zinc-400 to-zinc-300",
                  )}
                  style={{
                    height: `${h}%`,
                    transitionDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-1",
              highlight ? "text-zinc-400" : "text-zinc-500",
            )}
          >
            {title}
          </p>
          <div className="flex items-baseline gap-3 mt-2">
            <h3
              className={cn(
                "text-3xl font-bold tracking-tight",
                highlight ? "text-white" : "text-zinc-900",
              )}
            >
              {value}
            </h3>
            {trend && (
              <span
                className={cn(
                  "text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-full",
                  getTrendColor(),
                )}
              >
                <TrendIcon className="h-3 w-3" /> {trend}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
