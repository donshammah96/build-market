"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/hooks/useProfileStatus";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileStrengthWidgetProps {
  /** Optional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProfileStrengthWidget({
  className,
}: ProfileStrengthWidgetProps) {
  const { percentage, isComplete, missingRequiredLabels, isLoading } =
    useProfileCompletion();

  if (isLoading) {
    return (
      <Card className={cn("border border-border shadow-sm bg-card", className)}>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Profile Strength
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-6">
          <div className="motion-safe:animate-pulse space-y-3">
            <div className="flex items-baseline gap-2">
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            <div className="h-1.5 bg-muted rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get status label and color
  const getStatus = () => {
    if (percentage >= 80) return { label: "Excellent", color: "text-success" };
    if (percentage >= 50) return { label: "Good", color: "text-warning" };
    return { label: "Needs Work", color: "text-error" };
  };

  const status = getStatus();

  return (
    <Card
      className={cn(
        "border border-border shadow-sm bg-card overflow-hidden",
        className,
      )}
    >
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Profile Strength
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6">
        {/* Percentage and status */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-foreground">
            {percentage}%
          </span>
          <span className={cn("text-sm font-medium", status.color)}>
            {status.label}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={percentage}
          className="h-1.5 bg-muted"
          indicatorClassName={cn(
            percentage >= 80
              ? "bg-success"
              : percentage >= 50
                ? "bg-warning"
                : "bg-error",
          )}
        />

        {/* Missing fields alert */}
        {!isComplete &&
          missingRequiredLabels &&
          missingRequiredLabels.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-warning">
                    Action Required
                  </p>
                  <p className="text-xs text-warning mt-0.5">
                    Complete: {missingRequiredLabels.slice(0, 2).join(", ")}
                    {missingRequiredLabels.length > 2 &&
                      ` and ${missingRequiredLabels.length - 2} more`}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href="/professional-portal/settings/complete-profile">
                  Complete Profile
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}

        {/* Completed state */}
        {isComplete && (
          <p className="mt-4 text-xs text-success font-medium">
            Your profile is complete! Great job.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ProfileStrengthWidget;
