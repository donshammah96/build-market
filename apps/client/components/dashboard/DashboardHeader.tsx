"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardConfig, formatWelcomeMessage } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardHeaderProps {
  /** Dashboard configuration */
  config: DashboardConfig;
  /** Data for welcome message */
  welcomeData?: {
    leads?: number;
    projects?: number;
    orders?: number;
    products?: number;
    inquiries?: number;
    listings?: number;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DashboardHeader({
  config,
  welcomeData = {},
  isLoading = false,
  className,
}: DashboardHeaderProps) {
  const welcomeMessage = formatWelcomeMessage(config, welcomeData);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-zinc-100",
          className
        )}
      >
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-32 bg-zinc-200 rounded" />
          <div className="h-4 w-64 bg-zinc-200 rounded" />
        </div>
        <div className="flex gap-3 animate-pulse">
          <div className="h-10 w-28 bg-zinc-200 rounded" />
          <div className="h-10 w-36 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-zinc-100",
        className
      )}
    >
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
          Overview
        </h1>
        <p className="text-zinc-500 mt-2 text-sm max-w-md leading-relaxed">
          {welcomeMessage}
        </p>
      </div>
      <div className="flex gap-3">
        {/* Render quick actions from config */}
        {config.quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant={action.variant === "primary" ? "default" : "outline"}
              className={cn(
                action.variant === "primary"
                  ? "bg-zinc-900 hover:bg-zinc-800 text-white shadow-md transition-all hover:shadow-lg"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-white shadow-sm"
              )}
              asChild
            >
              <Link href={action.href}>
                {index === config.quickActions.length - 1 &&
                action.variant === "primary" ? (
                  <>
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </>
                ) : (
                  <>
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </>
                )}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardHeader;
