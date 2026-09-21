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
          "h-full flex flex-col border border-border/70 bg-card text-card-foreground overflow-hidden rounded-xl shadow-xs hover:shadow-xl dark:hover:shadow-black/50 hover:border-primary/40 group transition-all duration-300",
        )}
      >
        {/* Image Area */}
        <div className="relative aspect-video overflow-hidden bg-muted border-b border-border/60">
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
            <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1">
              <Package className="h-3 w-3" aria-hidden="true" />
              <span>{vendor.productCount} Products</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-col grow p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-foreground text-lg flex items-center gap-1.5 group-hover:text-primary transition-colors">
                <StoreIcon
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                {vendor.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 text-primary" aria-hidden="true" />
                <span>{displayLocation}</span>
              </div>
            </div>
            {vendor.verified && (
              <BadgeCheck
                className="h-5 w-5 text-primary"
                aria-label="Verified vendor"
              />
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
            {vendor.description}
          </p>

          <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star
                className="h-4 w-4 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-foreground">
                {vendor.rating?.toFixed(1) || "New"}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80 hover:bg-primary/10 px-2 py-1 h-auto font-medium transition-colors"
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
