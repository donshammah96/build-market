"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60 border border-border">
      <div className="p-2 rounded-lg bg-card border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
        {subtext && (
          <p className="text-[10px] text-muted-foreground">{subtext}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function StoreOverviewSkeleton() {
  return (
    <Card className="border border-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="border-b border-border py-5 px-6">
        <div className="flex items-center gap-2 motion-safe:animate-pulse">
          <div className="h-10 w-10 bg-muted rounded-lg" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3 motion-safe:animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
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
  const router = useRouter();
  const [isSetupPending, startSetupTransition] = useTransition();

  const handleSetupStore = () => {
    startSetupTransition(() => {
      router.push("/professional-portal/settings/stores");
    });
  };

  return (
    <Card className="border border-border shadow-sm bg-card overflow-hidden">
      <CardContent className="p-12 text-center">
        <Store className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">
          No Store Setup
        </h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
          Create your store to start selling products and reach more customers.
        </p>
        <Button
          className="min-h-11 px-4 motion-safe:active:scale-[0.98]"
          isLoading={isSetupPending}
          loadingText="Opening..."
          onClick={handleSetupStore}
        >
          <Store className="h-4 w-4 mr-2" />
          Setup Store
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
  const router = useRouter();
  const [isSettingsPending, startSettingsTransition] = useTransition();
  const [isManageProductsPending, startManageProductsTransition] =
    useTransition();
  const [isAddProductPending, startAddProductTransition] = useTransition();

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

  const handleOpenStoreSettings = () => {
    startSettingsTransition(() => {
      router.push(`/professional-portal/settings/stores/${store.id}`);
    });
  };

  const handleManageProducts = () => {
    startManageProductsTransition(() => {
      router.push("/professional-portal/products");
    });
  };

  const handleAddProduct = () => {
    startAddProductTransition(() => {
      router.push("/professional-portal/products/new");
    });
  };

  return (
    <Card
      className={cn(
        "border border-border shadow-sm bg-card overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <CardHeader className="border-b border-border py-5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {store.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {store.totalProducts} products
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg motion-safe:transition-colors motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            isLoading={isSettingsPending}
            loadingText=""
            onClick={handleOpenStoreSettings}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Stats Grid */}
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={ShoppingCart}
            label="Total Orders"
            value={store.totalOrders}
            subtext={
              store.pendingOrders > 0
                ? `${store.pendingOrders} pending`
                : undefined
            }
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
            className="flex-1 text-xs min-h-11 motion-safe:active:scale-[0.98]"
            isLoading={isManageProductsPending}
            loadingText="Opening..."
            onClick={handleManageProducts}
          >
            Manage Products
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs min-h-11 motion-safe:active:scale-[0.98]"
            isLoading={isAddProductPending}
            loadingText="Opening..."
            onClick={handleAddProduct}
          >
            Add Product
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoreOverviewWidget;
