"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError Boundary]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6 bg-zinc-50">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-zinc-200 p-2">
        <EmptyState
          title="Dashboard Error"
          description={
            error.message ||
            "An unexpected error occurred within the dashboard page. This might be a transient database query failure."
          }
          isError={true}
          action={{
            label: "Reload Page",
            onClick: reset,
          }}
        />
      </div>
    </div>
  );
}
