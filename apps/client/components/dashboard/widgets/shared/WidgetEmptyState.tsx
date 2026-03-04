"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface WidgetEmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Primary message */
  title: string;
  /** Optional secondary message */
  description?: string;
  /** Optional action (e.g. Link as child) */
  action?: React.ReactNode;
  /** Optional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Consistent empty state for dashboard widgets.
 * Follows platform design system for icon, typography, spacing.
 */
export function WidgetEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: WidgetEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 py-12",
        className,
      )}
    >
      <div className="p-4 rounded-full bg-zinc-100 mb-4">
        <Icon className="h-10 w-10 text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default WidgetEmptyState;
