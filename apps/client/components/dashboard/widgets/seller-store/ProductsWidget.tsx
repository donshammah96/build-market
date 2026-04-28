"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Package, TrendingUp, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface ProductItem {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  soldCount: number;
  revenue: number;
}

export interface ProductsWidgetProps {
  /** Top products data */
  products?: ProductItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface ProductItemRowProps {
  product: ProductItem;
  rank: number;
}

function ProductItemRow({ product, rank }: ProductItemRowProps) {
  const formatPrice = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/60 rounded-lg motion-safe:transition-colors">
      {/* Rank */}
      <span
        className={cn(
          "text-xs font-bold w-5 text-center",
          rank === 1 ? "text-primary" : "text-muted-foreground",
        )}
      >
        #{rank}
      </span>

      {/* Product Image */}
      <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground/60" />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {product.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatPrice(product.price)}
        </p>
      </div>

      {/* Sales Info */}
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-foreground">
          {product.soldCount} sold
        </p>
        <p className="text-[10px] text-primary flex items-center justify-end gap-0.5">
          <TrendingUp className="h-2.5 w-2.5" />
          {formatPrice(product.revenue)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function ProductsWidgetSkeleton() {
  return (
    <Card className="border border-border shadow-sm bg-card">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-24 bg-muted rounded motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 motion-safe:animate-pulse"
            >
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="h-10 w-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-2 w-16 bg-muted rounded" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-3 w-12 bg-muted rounded" />
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

export function ProductsWidget({
  products = [],
  isLoading = false,
  className,
}: ProductsWidgetProps) {
  const router = useRouter();
  const [isAddProductPending, startAddProductTransition] = useTransition();

  if (isLoading) {
    return <ProductsWidgetSkeleton />;
  }

  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];

  const handleAddProduct = () => {
    startAddProductTransition(() => {
      router.push("/professional-portal/products/new");
    });
  };

  return (
    <Card className={cn("border border-border shadow-sm bg-card", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Top Products
        </CardTitle>
        <Link
          href="/professional-portal/products"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {safeProducts.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              No products yet
            </p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 motion-safe:active:scale-[0.98]"
              isLoading={isAddProductPending}
              loadingText="Opening..."
              onClick={handleAddProduct}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Product
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {safeProducts.slice(0, 5).map((product, index) => (
              <ProductItemRow
                key={product.id}
                product={product}
                rank={index + 1}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductsWidget;
