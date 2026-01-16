"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { VerificationStats } from "@/actions/admin";

interface VerificationAlertWidgetProps {
  urgentCount: number;
  pendingCount: number;
  verificationStats: VerificationStats | null;
}

export function VerificationAlertWidget({
  urgentCount,
  pendingCount,
  verificationStats,
}: VerificationAlertWidgetProps) {
  // Determine alert level based on thresholds from policies
  const getAlertLevel = () => {
    if (urgentCount >= 8) return "critical"; // Critical threshold
    if (urgentCount >= 3) return "warning"; // Warning threshold
    if (urgentCount > 0) return "info";
    if (pendingCount > 60) return "warning"; // Queue size critical
    if (pendingCount > 40) return "info"; // Queue size warning
    return "success";
  };

  const alertLevel = getAlertLevel();

  if (alertLevel === "success") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">All verifications on track</span>
        </div>
        <div className="text-xs text-zinc-500 space-y-1">
          <p>Pending: {pendingCount} items</p>
          <p>Urgent: {urgentCount} items</p>
        </div>
        <Link href="/verifications">
          <Button variant="outline" size="sm" className="w-full">
            View Verifications
            <ArrowRight className="h-3 w-3 ml-2" />
          </Button>
        </Link>
      </div>
    );
  }

  const alerts: Array<{
    level: "critical" | "warning" | "info";
    title: string;
    description: string;
    icon: typeof AlertCircle;
    variant: "destructive" | "default";
  }> = [];

  // Add urgent items alert
  if (urgentCount >= 8) {
    alerts.push({
      level: "critical",
      title: "Critical: High Urgent Items",
      description: `${urgentCount} items have been pending for over 48 hours. Immediate action required.`,
      icon: AlertCircle,
      variant: "destructive",
    });
  } else if (urgentCount >= 3) {
    alerts.push({
      level: "warning",
      title: "Warning: Urgent Items",
      description: `${urgentCount} items have been pending for over 48 hours.`,
      icon: Clock,
      variant: "default",
    });
  } else if (urgentCount > 0) {
    alerts.push({
      level: "info",
      title: "Urgent Items",
      description: `${urgentCount} item${urgentCount > 1 ? "s" : ""} ${urgentCount > 1 ? "have" : "has"} been pending for over 48 hours.`,
      icon: Clock,
      variant: "default",
    });
  }

  // Add queue size alert
  if (pendingCount > 60) {
    alerts.push({
      level: "critical",
      title: "Critical: Large Queue",
      description: `Queue size (${pendingCount}) exceeds critical threshold. Consider capacity planning.`,
      icon: AlertTriangle,
      variant: "destructive",
    });
  } else if (pendingCount > 40) {
    alerts.push({
      level: "warning",
      title: "Warning: Growing Queue",
      description: `Queue size (${pendingCount}) is approaching threshold. Monitor closely.`,
      icon: AlertTriangle,
      variant: "default",
    });
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <Alert
          key={index}
          variant={alert.variant}
          className={
            alert.level === "critical" ? "border-red-500 bg-red-50" : ""
          }
        >
          <alert.icon className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            {alert.title}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {alert.description}
          </AlertDescription>
        </Alert>
      ))}

      {/* Stats Summary */}
      {verificationStats && (
        <div className="pt-2 border-t border-zinc-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Pending</span>
            <Badge variant="secondary">{verificationStats.pending.total}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Verified (month)</span>
            <Badge variant="outline" className="text-emerald-600">
              {verificationStats.verified.total}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Needs Correction</span>
            <Badge variant="outline" className="text-orange-600">
              {verificationStats.needsCorrection.total}
            </Badge>
          </div>
        </div>
      )}

      <Link href="/verifications">
        <Button
          variant={alertLevel === "critical" ? "destructive" : "default"}
          size="sm"
          className="w-full"
        >
          {urgentCount > 0
            ? `Review ${urgentCount} Urgent Item${urgentCount > 1 ? "s" : ""}`
            : "View Verifications"}
          <ArrowRight className="h-3 w-3 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
