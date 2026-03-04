"use client";

import Link from "next/link";
import { AlertTriangle, Package, ChevronRight, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InventoryAlert } from "@/lib/services/inventory";

// ============================================================================
// TYPES
// ============================================================================

export interface InventoryAlertsWidgetProps {
  /** Inventory alerts */
  alerts?: InventoryAlert[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface AlertItemProps {
  alert: InventoryAlert;
}

function AlertItem({ alert }: AlertItemProps) {
  const isOutOfStock = alert.status === "out_of_stock";

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-lg transition-colors">
      <div
        className={cn(
          "p-1.5 rounded-md",
          isOutOfStock ? "bg-red-100" : "bg-amber-100",
        )}
      >
        <AlertTriangle
          className={cn(
            "h-3.5 w-3.5",
            isOutOfStock ? "text-red-600" : "text-amber-600",
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-900 truncate">
          {alert.productName}
        </p>
        <p className="text-[10px] text-zinc-500">
          {isOutOfStock ? (
            <span className="text-red-600 font-medium">Out of stock</span>
          ) : (
            <>
              <span className="text-amber-600 font-medium">
                {alert.currentStock} left
              </span>
              {" · "}
              Min: {alert.threshold}
            </>
          )}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="text-xs h-7 px-2" asChild>
        <Link href={`/professional-portal/products/${alert.id}`}>
          <ArrowUp className="h-3 w-3 mr-1" />
          Restock
        </Link>
      </Button>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function InventoryAlertsSkeleton() {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-28 bg-zinc-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-7 w-7 bg-zinc-200 rounded" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-28 bg-zinc-200 rounded" />
                <div className="h-2 w-16 bg-zinc-200 rounded" />
              </div>
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

export function InventoryAlertsWidget({
  alerts = [],
  isLoading = false,
  className,
}: InventoryAlertsWidgetProps) {
  if (isLoading) {
    return <InventoryAlertsSkeleton />;
  }

  // Ensure alerts is always an array
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const outOfStockCount = safeAlerts.filter(
    (a) => a.status === "out_of_stock",
  ).length;
  const lowStockCount = safeAlerts.filter(
    (a) => a.status === "low_stock",
  ).length;

  return (
    <Card
      className={cn("border border-zinc-200 shadow-sm bg-white", className)}
    >
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Inventory Alerts
        </CardTitle>
        {safeAlerts.length > 0 && (
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              outOfStockCount > 0
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700",
            )}
          >
            {outOfStockCount > 0
              ? `${outOfStockCount} OUT`
              : `${lowStockCount} LOW`}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {safeAlerts.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="h-8 w-8 text-emerald-200 mx-auto mb-2" />
            <p className="text-xs text-emerald-600 font-medium">
              All stock levels healthy
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {safeAlerts.slice(0, 5).map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}

        {safeAlerts.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-zinc-500 hover:text-zinc-900"
            asChild
          >
            <Link href="/professional-portal/products?filter=low_stock">
              View {safeAlerts.length - 5} more alerts
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default InventoryAlertsWidget;
