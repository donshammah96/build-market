"use client";

import React, { memo } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
  Star,
  MapPin,
  BadgeCheck,
  Store as StoreIcon,
  Package,
} from "lucide-react";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import Link from "next/link";
import { VendorCardData } from "../../types/vendor";
import { cn } from "@/lib/utils";

interface VendorCardProps {
  vendor: VendorCardData;
}

const VendorCard: React.FC<VendorCardProps> = memo(function VendorCard({
  vendor,
}) {
  const displayLocation = vendor.location || vendor.city || "Kenya";

  return (
    <div className="h-full p-1 hover-lift">
      <Card
        className={cn(
          "h-full flex flex-col border border-zinc-200 bg-white overflow-hidden rounded-xl shadow-sm",
          "transition-all duration-300 hover:shadow-xl hover:border-emerald-100 group",
        )}
      >
        {/* Image Area */}
        <div className="relative aspect-video overflow-hidden bg-zinc-100 border-b border-zinc-50">
          <Link href={`/vendors/${vendor.id}`}>
            <div className="h-full w-full overflow-hidden">
              <ImageWithFallback
                src={vendor.image || vendor.images?.[0]?.url || "/hardware.png"}
                alt={vendor.name}
                className="w-full h-full object-cover img-zoom"
              />
            </div>
          </Link>

          {/* Product Count Badge */}
          {vendor.productCount && (
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1">
              <Package className="h-3 w-3" aria-hidden="true" />
              <span>{vendor.productCount} Products</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-col flex-grow p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-zinc-900 text-lg flex items-center gap-1.5 group-hover:text-emerald-700 transition-colors">
                <StoreIcon
                  className="h-4 w-4 text-emerald-500"
                  aria-hidden="true"
                />
                {vendor.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>{displayLocation}</span>
              </div>
            </div>
            {vendor.verified && (
              <BadgeCheck
                className="h-5 w-5 text-emerald-500"
                aria-label="Verified vendor"
              />
            )}
          </div>

          <p className="text-sm text-zinc-500 line-clamp-2 mb-4 leading-relaxed">
            {vendor.description}
          </p>

          <div className="mt-auto pt-4 border-t border-zinc-50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star
                className="h-4 w-4 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-zinc-900">
                {vendor.rating?.toFixed(1) || "New"}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-0 h-auto font-medium"
              asChild
            >
              <Link href={`/vendors/${vendor.id}`}>Visit Store →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default VendorCard;
