"use client";

import Link from "next/link";
import Image from "next/image";
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
    <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-lg transition-colors">
      {/* Rank */}
      <span
        className={cn(
          "text-xs font-bold w-5 text-center",
          rank === 1 ? "text-amber-500" : "text-zinc-400"
        )}
      >
        #{rank}
      </span>

      {/* Product Image */}
      <div className="h-10 w-10 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
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
            <Package className="h-4 w-4 text-zinc-300" />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-900 truncate">
          {product.name}
        </p>
        <p className="text-[10px] text-zinc-500">
          {formatPrice(product.price)}
        </p>
      </div>

      {/* Sales Info */}
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-zinc-900">
          {product.soldCount} sold
        </p>
        <p className="text-[10px] text-emerald-600 flex items-center justify-end gap-0.5">
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
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-24 bg-zinc-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-5 w-5 bg-zinc-200 rounded" />
              <div className="h-10 w-10 bg-zinc-200 rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 bg-zinc-200 rounded" />
                <div className="h-2 w-16 bg-zinc-200 rounded" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-3 w-12 bg-zinc-200 rounded" />
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

export function ProductsWidget({
  products = [],
  isLoading = false,
  className,
}: ProductsWidgetProps) {
  if (isLoading) {
    return <ProductsWidgetSkeleton />;
  }

  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <Card
      className={cn("border border-zinc-200 shadow-sm bg-white", className)}
    >
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Top Products
        </CardTitle>
        <Link
          href="/professional-portal/products"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {safeProducts.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 mb-3">No products yet</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/professional-portal/products/new">
                <Plus className="h-3 w-3 mr-1" />
                Add Product
              </Link>
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
