"use client";

import React, { memo, useMemo } from "react";
import Link from "next/link";
import { MapPin, Bed, Bath, Square, Heart, ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/app/lib/ImageWithFallback";
import { getPropertyUrl } from "@/lib/links";
import { cn } from "@/lib/utils";
import { PropertyCardData } from "@/types/property";

interface PropertyCardProps {
  property: PropertyCardData;
}

const PropertyCard: React.FC<PropertyCardProps> = memo(function PropertyCard({
  property,
}) {
  const propertyUrl = getPropertyUrl(property.id);

  // Memoize formatted price
  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: property.currency,
      maximumFractionDigits: 0,
    }).format(property.price);
  }, [property.price, property.currency]);

  return (
    <div className="h-full group hover-lift">
      <Card
        className={cn(
          "h-full flex flex-col border border-zinc-200 bg-white overflow-hidden rounded-xl shadow-sm",
          "transition-all duration-300 hover:shadow-lg"
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
          <Link href={propertyUrl}>
            <div className="h-full w-full overflow-hidden">
              <ImageWithFallback
                src={property.image || "/property-placeholder.png"}
                alt={property.title}
                className="w-full h-full object-cover img-zoom"
              />
            </div>
          </Link>

          {/* Status Badge */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-white/90 backdrop-blur-md text-zinc-900 hover:bg-white shadow-sm font-semibold border-0">
              For {property.type.toLowerCase()}
            </Badge>
            {property.featured && (
              <Badge className="bg-emerald-600 text-white border-0 shadow-sm">
                Featured
              </Badge>
            )}
          </div>

          {/* Favorite Button */}
          <button
            className="absolute top-3 right-3 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-colors"
            aria-label="Add to favorites"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Price Tag Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
            <p className="text-white text-xl font-bold tracking-tight">
              {formattedPrice}
            </p>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className="flex flex-col flex-grow p-5">
          {/* Title & Location */}
          <div className="mb-4">
            <Link
              href={propertyUrl}
              className="group-hover:text-emerald-700 transition-colors"
            >
              <h3 className="font-bold text-zinc-900 text-lg line-clamp-1 mb-1">
                {property.title}
              </h3>
            </Link>
            <div className="flex items-center text-zinc-500 text-sm">
              <MapPin className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              <span>{property.location}</span>
            </div>
          </div>

          {/* Key Features */}
          <div className="flex items-center gap-4 text-sm text-zinc-600 mb-5 pb-5 border-b border-zinc-100">
            {property.beds && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.beds} Bedrooms`}
              >
                <Bed className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span className="font-medium">{property.beds}</span>
                <span className="sr-only">bedrooms</span>
              </div>
            )}
            {property.baths && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.baths} Bathrooms`}
              >
                <Bath className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span className="font-medium">{property.baths}</span>
                <span className="sr-only">bathrooms</span>
              </div>
            )}
            {property.area && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.area} Sq Ft`}
              >
                <Square
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <span className="font-medium">
                  {property.area}{" "}
                  <span className="text-xs text-zinc-400">sqft</span>
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-auto flex items-center justify-between">
            {/* Agent Info */}
            {property.agent ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="h-6 w-6 rounded-full bg-zinc-200 overflow-hidden relative">
                  <ImageWithFallback
                    src={property.agent.image}
                    alt=""
                    className="object-cover"
                  />
                </div>
                <span className="truncate max-w-[100px]">
                  {property.agent.name}
                </span>
              </div>
            ) : (
              <span />
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-0 h-auto font-medium"
              asChild
            >
              <Link href={propertyUrl} className="flex items-center gap-1">
                View Details{" "}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default PropertyCard;
