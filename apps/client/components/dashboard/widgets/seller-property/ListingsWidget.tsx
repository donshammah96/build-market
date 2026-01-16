"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Eye,
  MessageSquare,
  ChevronRight,
  Home,
  MapPin,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PropertyListingData } from "@/lib/dashboard";

// ============================================================================
// TYPES
// ============================================================================

export interface ListingsWidgetProps {
  /** Property listings data */
  properties?: PropertyListingData[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  pending: {
    label: "Pending",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  sold: {
    label: "Sold",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  rented: {
    label: "Rented",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
} as const;

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface PropertyCardProps {
  property: PropertyListingData;
}

function PropertyCard({ property }: PropertyCardProps) {
  const statusConfig = STATUS_CONFIG[property.status];

  // Format price
  const formatPrice = (amount: number) => {
    if (amount >= 1000000) {
      return `KSh ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `KSh ${(amount / 1000).toFixed(0)}k`;
    }
    return `KSh ${amount}`;
  };

  return (
    <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden">
        {property.images[0] ? (
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Home className="h-12 w-12 text-zinc-200" />
          </div>
        )}
        <Badge
          variant="outline"
          className={cn(
            "absolute top-2 right-2 text-[10px] font-medium border",
            statusConfig.color
          )}
        >
          {statusConfig.label}
        </Badge>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <div className="mb-2">
          <h4 className="text-sm font-semibold text-zinc-900 truncate">
            {property.title}
          </h4>
          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {property.location}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-zinc-900">
            {formatPrice(property.price)}
          </span>
          <div className="flex items-center gap-3 text-zinc-400">
            <span className="flex items-center gap-1 text-xs">
              <Eye className="h-3.5 w-3.5" />
              {property.views}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              {property.inquiries}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function ListingsWidgetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-zinc-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-zinc-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card
            key={i}
            className="border border-zinc-200 shadow-sm bg-white overflow-hidden"
          >
            <div className="aspect-[4/3] bg-zinc-200 animate-pulse" />
            <CardContent className="p-4 animate-pulse space-y-2">
              <div className="h-4 w-3/4 bg-zinc-200 rounded" />
              <div className="h-3 w-1/2 bg-zinc-200 rounded" />
              <div className="h-4 w-1/4 bg-zinc-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ListingsWidget({
  properties = [],
  isLoading = false,
  className,
}: ListingsWidgetProps) {
  if (isLoading) {
    return <ListingsWidgetSkeleton />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900">Active Listings</h3>
        <Link
          href="/professional-portal/properties"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {properties.length === 0 ? (
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-12 text-center">
            <Home className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No property listings</p>
            <p className="text-xs text-zinc-400 mt-1">
              Add properties to start attracting buyers
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/professional-portal/properties/new">
                <Plus className="h-4 w-4 mr-1" />
                Add Listing
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.slice(0, 4).map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ListingsWidget;
