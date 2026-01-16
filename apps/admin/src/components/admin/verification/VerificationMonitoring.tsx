"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, TrendingUp, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getVerificationUpdates } from "@/actions/admin";

interface VerificationMonitoringProps {
  initialUrgentCount: number;
  initialPendingCount: number;
  pollingInterval?: number; // in milliseconds, default 60000 (1 minute)
}

/**
 * Real-time monitoring component for pending verifications
 * Polls for updates and displays alerts based on SLA thresholds
 */
export function VerificationMonitoring({
  initialUrgentCount,
  initialPendingCount,
  pollingInterval = 60000, // 1 minute default
}: VerificationMonitoringProps) {
  const [urgentCount, setUrgentCount] = useState(initialUrgentCount);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate time since last update
  const timeSinceUpdate = Math.floor(
    (Date.now() - lastUpdate.getTime()) / 1000 / 60
  );

  // Poll for updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollForUpdates = async () => {
      if (isPolling) return; // Prevent concurrent polls

      setIsPolling(true);
      setError(null);

      try {
        const response = await getVerificationUpdates(
          lastUpdate.toISOString(),
          "all"
        );

        if (response.success && response.data) {
          if (response.data.hasUpdates) {
            // Count urgent items (>48 hours old)
            const now = Date.now();
            const urgentItems = response.data.items.filter((item) => {
              if (!item.submittedAt) return false;
              const submittedDate = new Date(item.submittedAt).getTime();
              const hoursSinceSubmission =
                (now - submittedDate) / (1000 * 60 * 60);
              return hoursSinceSubmission > 48;
            });

            setUrgentCount(urgentItems.length);
            setPendingCount(response.data.items.length);
            setLastUpdate(new Date());
          }
        } else {
          setError(response.error || "Failed to fetch updates");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsPolling(false);
      }
    };

    // Initial poll after component mounts
    const timeoutId = setTimeout(pollForUpdates, 5000); // Wait 5 seconds before first poll

    // Set up polling interval
    intervalId = setInterval(pollForUpdates, pollingInterval);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [lastUpdate, pollingInterval, isPolling]);

  // Determine alert level
  const getAlertLevel = () => {
    if (urgentCount >= 8) return "critical";
    if (urgentCount >= 3) return "warning";
    if (urgentCount > 0) return "info";
    if (pendingCount > 60) return "warning";
    if (pendingCount > 40) return "info";
    return "success";
  };

  const alertLevel = getAlertLevel();

  // Don't show monitoring widget if no urgent items and queue is healthy
  if (alertLevel === "success" && urgentCount === 0 && pendingCount < 40) {
    return null;
  }

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Verification Monitoring
          {isPolling && (
            <RefreshCw className="h-3 w-3 text-zinc-400 animate-spin ml-2" />
          )}
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Updated {timeSinceUpdate}m ago
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Urgent Items Alert */}
        {urgentCount > 0 && (
          <Alert
            variant={alertLevel === "critical" ? "destructive" : "default"}
            className={
              alertLevel === "critical"
                ? "border-red-500 bg-red-50"
                : alertLevel === "warning"
                  ? "border-amber-500 bg-amber-50"
                  : ""
            }
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">
              {urgentCount} Urgent Item{urgentCount > 1 ? "s" : ""} Pending
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {urgentCount} verification{urgentCount > 1 ? "s have" : " has"}{" "}
              been pending for over 48 hours.{" "}
              {alertLevel === "critical" &&
                "Immediate action required to meet SLA."}
            </AlertDescription>
          </Alert>
        )}

        {/* Queue Size Alert */}
        {pendingCount > 40 && (
          <Alert
            variant={pendingCount > 60 ? "destructive" : "default"}
            className={
              pendingCount > 60
                ? "border-red-500 bg-red-50"
                : "border-amber-500 bg-amber-50"
            }
          >
            <TrendingUp className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">
              Queue Size: {pendingCount} Items
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {pendingCount > 60
                ? "Queue size exceeds critical threshold. Consider capacity planning."
                : "Queue size is approaching threshold. Monitor closely."}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Pending</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Urgent</p>
            <p
              className={`text-2xl font-bold ${
                urgentCount > 0 ? "text-red-600" : "text-zinc-900"
              }`}
            >
              {urgentCount}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        <Link href="/verifications">
          <Button
            variant={alertLevel === "critical" ? "destructive" : "default"}
            size="sm"
            className="w-full"
          >
            {urgentCount > 0
              ? `Review ${urgentCount} Urgent Item${urgentCount > 1 ? "s" : ""}`
              : "View Verification Queue"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
