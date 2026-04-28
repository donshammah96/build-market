"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Clock,
  ChevronRight,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ShoppingCart,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderData } from "@/lib/dashboard";

// ============================================================================
// TYPES
// ============================================================================

export interface OrdersWidgetProps {
  /** Orders data */
  orders?: OrderData[];
  /** Loading state */
  isLoading?: boolean;
  /** Number of pending orders for badge */
  pendingCount?: number;
  /** Optional className */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "bg-muted text-muted-foreground border-border",
  },
  processing: {
    label: "Processing",
    icon: Package,
    color: "bg-primary/10 text-primary border-primary/30",
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
    color: "bg-accent text-accent-foreground border-border",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    color: "bg-secondary text-secondary-foreground border-border",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const;

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface OrderItemProps {
  order: OrderData;
}

function OrderItem({ order }: OrderItemProps) {
  const statusConfig = STATUS_CONFIG[order.status];
  const StatusIcon = statusConfig.icon;

  // Format currency
  const formatPrice = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-4 hover:bg-muted/60 motion-safe:transition-colors group flex items-center gap-4">
      {/* Status Icon */}
      <div
        className={cn(
          "p-2 rounded-lg border",
          order.status === "pending"
            ? "bg-muted border-border"
            : "bg-muted/60 border-border",
        )}
      >
        <StatusIcon
          className={cn(
            "h-4 w-4",
            order.status === "pending"
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        />
      </div>

      {/* Order Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground truncate">
            {order.customerName}
          </h4>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatTime(order.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {order.items} item{order.items > 1 ? "s" : ""}
          </span>
          <span className="text-border">•</span>
          <span className="text-xs font-medium text-foreground">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] font-medium border shrink-0",
          statusConfig.color,
        )}
      >
        {statusConfig.label}
      </Badge>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function OrdersWidgetSkeleton() {
  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card">
      <CardHeader className="border-b border-border py-5 px-6">
        <div className="flex items-center gap-2 motion-safe:animate-pulse">
          <div className="h-5 w-28 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded-full" />
        </div>
      </CardHeader>
      <div className="divide-y divide-border">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 flex items-center gap-4 motion-safe:animate-pulse"
          >
            <div className="h-10 w-10 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OrdersWidget({
  orders = [],
  isLoading = false,
  pendingCount,
  className,
}: OrdersWidgetProps) {
  const router = useRouter();
  const [isViewOrdersPending, startViewOrdersTransition] = useTransition();

  if (isLoading) {
    return <OrdersWidgetSkeleton />;
  }

  const displayPendingCount =
    pendingCount ?? orders.filter((o) => o.status === "pending").length;

  const handleViewOrders = () => {
    startViewOrdersTransition(() => {
      router.push("/professional-portal/orders");
    });
  };

  return (
    <Card
      className={cn(
        "border border-border shadow-sm overflow-hidden bg-card",
        className,
      )}
    >
      <CardHeader className="border-b border-border py-5 px-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold text-foreground">
            Recent Orders
          </CardTitle>
          {displayPendingCount > 0 && (
            <div className="h-5 px-2 rounded-full bg-muted text-foreground text-[10px] font-bold flex items-center">
              {displayPendingCount} PENDING
            </div>
          )}
        </div>
        <Link
          href="/professional-portal/orders"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </CardHeader>

      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No orders yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Orders from customers will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {orders.slice(0, 5).map((order) => (
            <OrderItem key={order.id} order={order} />
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground min-h-11 motion-safe:active:scale-[0.98]"
            isLoading={isViewOrdersPending}
            loadingText="Opening..."
            onClick={handleViewOrders}
          >
            View All Orders
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </Card>
  );
}

export default OrdersWidget;
