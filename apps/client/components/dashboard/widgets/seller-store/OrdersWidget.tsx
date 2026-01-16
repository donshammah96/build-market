"use client";

import Link from "next/link";
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
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  processing: {
    label: "Processing",
    icon: Package,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-red-50 text-red-700 border-red-200",
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
    <div className="p-4 hover:bg-zinc-50/50 transition-colors group flex items-center gap-4">
      {/* Status Icon */}
      <div
        className={cn(
          "p-2 rounded-lg border",
          order.status === "pending"
            ? "bg-amber-50 border-amber-200"
            : "bg-zinc-50 border-zinc-200"
        )}
      >
        <StatusIcon
          className={cn(
            "h-4 w-4",
            order.status === "pending" ? "text-amber-600" : "text-zinc-500"
          )}
        />
      </div>

      {/* Order Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-zinc-900 truncate">
            {order.customerName}
          </h4>
          <span className="text-[10px] text-zinc-400 shrink-0">
            {formatTime(order.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-500">
            {order.items} item{order.items > 1 ? "s" : ""}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-xs font-medium text-zinc-900">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] font-medium border shrink-0",
          statusConfig.color
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
    <Card className="border border-zinc-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="border-b border-zinc-100 py-5 px-6">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-5 w-28 bg-zinc-200 rounded" />
          <div className="h-5 w-16 bg-zinc-200 rounded-full" />
        </div>
      </CardHeader>
      <div className="divide-y divide-zinc-100">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 bg-zinc-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-24 bg-zinc-200 rounded" />
            </div>
            <div className="h-5 w-16 bg-zinc-200 rounded" />
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
  if (isLoading) {
    return <OrdersWidgetSkeleton />;
  }

  const displayPendingCount =
    pendingCount ?? orders.filter((o) => o.status === "pending").length;

  return (
    <Card
      className={cn(
        "border border-zinc-200 shadow-sm overflow-hidden bg-white",
        className
      )}
    >
      <CardHeader className="border-b border-zinc-100 py-5 px-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold text-zinc-900">
            Recent Orders
          </CardTitle>
          {displayPendingCount > 0 && (
            <div className="h-5 px-2 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center">
              {displayPendingCount} PENDING
            </div>
          )}
        </div>
        <Link
          href="/professional-portal/orders"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>

      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No orders yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            Orders from customers will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {orders.slice(0, 5).map((order) => (
            <OrderItem key={order.id} order={order} />
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <div className="p-4 border-t border-zinc-100">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-zinc-500 hover:text-zinc-900"
            asChild
          >
            <Link href="/professional-portal/orders">
              View All Orders
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

export default OrdersWidget;
