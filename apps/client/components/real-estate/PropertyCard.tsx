"use client";

import React, { memo, useMemo } from "react";
import Link from "next/link";
import { MapPin, Bed, Bath, Square, Heart, ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { getPropertyUrl } from "@/lib/routes";
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
          "h-full flex flex-col border border-border/70 bg-card text-card-foreground overflow-hidden rounded-xl shadow-xs",
          "transition-all duration-300 hover:shadow-xl hover:border-primary/40",
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-4/3 overflow-hidden bg-muted">
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
            <Badge className="bg-background/90 dark:bg-card/90 backdrop-blur-md text-foreground hover:bg-background border border-border/40 shadow-xs font-semibold">
              For {property.type.toLowerCase()}
            </Badge>
            {property.featured && (
              <Badge className="bg-emerald-600 text-white border-0 shadow-xs">
                Featured
              </Badge>
            )}
          </div>

          {/* Favorite Button */}
          <button
            className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-xs transition-colors"
            aria-label="Add to favorites"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Price Tag Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 pt-12">
            <p className="text-white text-xl font-bold tracking-tight">
              {formattedPrice}
            </p>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className="flex flex-col grow p-5">
          {/* Title & Location */}
          <div className="mb-4">
            <Link
              href={propertyUrl}
              className="group-hover:text-primary transition-colors"
            >
              <h3 className="font-bold text-foreground text-lg line-clamp-1 mb-1">
                {property.title}
              </h3>
            </Link>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin
                className="h-3.5 w-3.5 mr-1 text-primary"
                aria-hidden="true"
              />
              <span>{property.location}</span>
            </div>
          </div>

          {/* Key Features */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5 pb-5 border-b border-border/60">
            {property.beds && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.beds} Bedrooms`}
              >
                <Bed className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {property.beds}
                </span>
                <span className="sr-only">bedrooms</span>
              </div>
            )}
            {property.baths && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.baths} Bathrooms`}
              >
                <Bath className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {property.baths}
                </span>
                <span className="sr-only">bathrooms</span>
              </div>
            )}
            {property.area && (
              <div
                className="flex items-center gap-1.5"
                title={`${property.area} Sq Ft`}
              >
                <Square className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {property.area}{" "}
                  <span className="text-xs text-muted-foreground/70">sqft</span>
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-auto flex items-center justify-between">
            {/* Agent Info */}
            {property.agent ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-muted overflow-hidden relative border border-border/60">
                  <ImageWithFallback
                    src={property.agent.image}
                    alt=""
                    className="object-cover"
                  />
                </div>
                <span className="truncate max-w-25 text-foreground/80">
                  {property.agent.name}
                </span>
              </div>
            ) : (
              <span />
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80 hover:bg-primary/10 px-2 py-1 h-auto font-medium transition-colors"
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
