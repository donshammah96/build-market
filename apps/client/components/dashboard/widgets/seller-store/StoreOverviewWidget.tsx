"use client";

import Link from "next/link";
import {
  Store,
  Package,
  ShoppingCart,
  Eye,
  ChevronRight,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StoreData } from "@/lib/dashboard";

// ============================================================================
// TYPES
// ============================================================================

export interface StoreOverviewWidgetProps {
  /** Store data */
  store?: StoreData;
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface StatItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
}

function StatItem({ icon: Icon, label, value, subtext }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100">
      <div className="p-2 rounded-lg bg-white border border-zinc-200">
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-bold text-zinc-900">{value}</p>
        {subtext && <p className="text-[10px] text-zinc-400">{subtext}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function StoreOverviewSkeleton() {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="border-b border-zinc-100 py-5 px-6">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-10 w-10 bg-zinc-200 rounded-lg" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-zinc-200 rounded" />
            <div className="h-3 w-20 bg-zinc-200 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-zinc-100 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function NoStoreState() {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-12 text-center">
        <Store className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">
          No Store Setup
        </h3>
        <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">
          Create your store to start selling products and reach more customers.
        </p>
        <Button asChild>
          <Link href="/professional-portal/settings/stores">
            <Store className="h-4 w-4 mr-2" />
            Setup Store
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StoreOverviewWidget({
  store,
  isLoading = false,
  className,
}: StoreOverviewWidgetProps) {
  if (isLoading) {
    return <StoreOverviewSkeleton />;
  }

  if (!store) {
    return <NoStoreState />;
  }

  // Format revenue
  const formatRevenue = (amount: number) => {
    if (amount >= 1000000) {
      return `KSh ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `KSh ${(amount / 1000).toFixed(0)}k`;
    }
    return `KSh ${amount}`;
  };

  return (
    <Card
      className={cn(
        "border border-zinc-200 shadow-sm bg-white overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <CardHeader className="border-b border-zinc-100 py-5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
              <Store className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-zinc-900">
                {store.name}
              </CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                {store.totalProducts} products
              </p>
            </div>
          </div>
          <Link
            href={`/professional-portal/settings/stores/${store.id}`}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>

      {/* Stats Grid */}
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={ShoppingCart}
            label="Total Orders"
            value={store.totalOrders}
            subtext={store.pendingOrders > 0 ? `${store.pendingOrders} pending` : undefined}
          />
          <StatItem
            icon={Package}
            label="Products"
            value={store.totalProducts}
          />
          <StatItem
            icon={Eye}
            label="Store Views"
            value={store.views.toLocaleString()}
          />
          <StatItem
            icon={Store}
            label="Revenue"
            value={formatRevenue(store.totalRevenue)}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            asChild
          >
            <Link href="/professional-portal/products">
              Manage Products
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs bg-zinc-900 hover:bg-zinc-800"
            asChild
          >
            <Link href="/professional-portal/products/new">
              Add Product
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoreOverviewWidget;
