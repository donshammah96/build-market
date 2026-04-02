"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, Package, ChevronRight, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SellerInventoryAlert } from "@/app/lib/domains/seller-insights";

// ============================================================================
// TYPES
// ============================================================================

export interface InventoryAlertsWidgetProps {
  /** Inventory alerts */
  alerts?: SellerInventoryAlert[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface AlertItemProps {
  alert: SellerInventoryAlert;
}

function AlertItem({ alert }: AlertItemProps) {
  const router = useRouter();
  const [isRestockPending, startRestockTransition] = useTransition();
  const isOutOfStock = alert.status === "out_of_stock";

  const handleRestock = () => {
    startRestockTransition(() => {
      router.push(`/professional-portal/products/${alert.id}`);
    });
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/60 rounded-lg motion-safe:transition-colors">
      <div
        className={cn(
          "p-1.5 rounded-md",
          isOutOfStock ? "bg-destructive/10" : "bg-muted",
        )}
      >
        <AlertTriangle
          className={cn(
            "h-3.5 w-3.5",
            isOutOfStock ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {alert.productName}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {isOutOfStock ? (
            <span className="text-destructive font-medium">Out of stock</span>
          ) : (
            <>
              <span className="text-foreground font-medium">
                {alert.currentStock} left
              </span>
              {" · "}
              Min: {alert.threshold}
            </>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs min-h-11 px-3 motion-safe:active:scale-[0.98]"
        isLoading={isRestockPending}
        loadingText="Opening..."
        isError={isOutOfStock}
        isSuccess={!isOutOfStock}
        onClick={handleRestock}
      >
        <ArrowUp className="h-3 w-3 mr-1" />
        Restock
      </Button>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function InventoryAlertsSkeleton() {
  return (
    <Card className="border border-border shadow-sm bg-card">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-28 bg-muted rounded motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 motion-safe:animate-pulse"
            >
              <div className="h-7 w-7 bg-muted rounded" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-28 bg-muted rounded" />
                <div className="h-2 w-16 bg-muted rounded" />
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
  const router = useRouter();
  const [isViewMorePending, startViewMoreTransition] = useTransition();

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

  const handleViewMoreAlerts = () => {
    startViewMoreTransition(() => {
      router.push("/professional-portal/products?filter=low_stock");
    });
  };

  return (
    <Card className={cn("border border-border shadow-sm bg-card", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Inventory Alerts
        </CardTitle>
        {safeAlerts.length > 0 && (
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              outOfStockCount > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
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
            <Package className="h-8 w-8 text-primary/40 mx-auto mb-2" />
            <p className="text-xs text-primary font-medium">
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
            className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground min-h-11 motion-safe:active:scale-[0.98]"
            isLoading={isViewMorePending}
            loadingText="Opening..."
            onClick={handleViewMoreAlerts}
          >
            View {safeAlerts.length - 5} more alerts
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default InventoryAlertsWidget;
