"use client";

import { memo, useState } from "react";
import PropertyCard from "./PropertyCard";
import {
  PropertyCardData,
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
} from "../../types/property";
import { COUNTY_LABELS } from "../../types/store";
import Link from "next/link";
import { Button } from "../ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "../ui/carousel";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

const FEATURED_PROPERTIES: PropertyCardData[] = [
  {
    id: "1",
    title: "Luxury 4-Bed Villa in Karen",
    price: 85000000,
    currency: "KES",
    location: "Karen, Nairobi",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    type: "SALE",
    typeLabel: PROPERTY_TYPE_LABELS.SALE,
    category: "RESIDENTIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.RESIDENTIAL,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    beds: 4,
    baths: 5,
    area: 4500,
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
    featured: true,
    verified: true,
    agent: {
      id: "agent-1",
      name: "Pam Golding",
      image: "https://i.pravatar.cc/150?u=pg",
      companyName: "Pam Golding Properties",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Modern Apartment in Kilimani",
    price: 120000,
    currency: "KES",
    location: "Kilimani, Nairobi",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    type: "RENT",
    typeLabel: PROPERTY_TYPE_LABELS.RENT,
    category: "RESIDENTIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.RESIDENTIAL,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    beds: 2,
    baths: 2,
    area: 1200,
    image:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    featured: true,
    verified: true,
    agent: {
      id: "agent-2",
      name: "Hass Consult",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Hass Consult",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Prime Commercial Space",
    price: 250000,
    currency: "KES",
    location: "Westlands, Nairobi",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    type: "LEASE",
    typeLabel: PROPERTY_TYPE_LABELS.LEASE,
    category: "COMMERCIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.COMMERCIAL,
    status: "UNDER_OFFER",
    statusLabel: PROPERTY_STATUS_LABELS.UNDER_OFFER,
    area: 2000,
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    featured: true,
    verified: true,
    agent: {
      id: "agent-3",
      name: "Shammah Realtors",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Shammah Realtors",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Half Acre Land",
    price: 15000000,
    currency: "KES",
    location: "Ruaka, Kiambu",
    county: "KIAMBU",
    countyLabel: COUNTY_LABELS.KIAMBU,
    type: "SALE",
    typeLabel: PROPERTY_TYPE_LABELS.SALE,
    category: "LAND",
    categoryLabel: PROPERTY_CATEGORY_LABELS.LAND,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    featured: true,
    verified: true,
    area: 21780,
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    agent: {
      id: "agent-4",
      name: "Hass Consult",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Hass Consult",
    },
    createdAt: new Date().toISOString(),
  },
];

interface PropertyProps {
  properties?: PropertyCardData[];
}

export const Property = memo(function Property({
  properties = FEATURED_PROPERTIES,
}: PropertyProps) {
  const [ref, isInView] = useIntersectionObserver();
  const [api, setApi] = useState<CarouselApi>();
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      className="py-20 bg-zinc-50 border-y border-zinc-200"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="properties-heading"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        {/* Header with Navigation Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
          <div
            className={cn(isInView && shouldAnimate && "animate-slide-in-left")}
          >
            <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-emerald-600 uppercase bg-emerald-50 rounded-full">
              Real Estate
            </div>
            <h2
              id="properties-heading"
              className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight"
            >
              Featured <span className="text-emerald-600">Properties</span>
            </h2>
          </div>

          {/* Custom Navigation Buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollPrev()}
              aria-label="Previous property"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollNext()}
              aria-label="Next property"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {properties.map((property, index) => (
              <CarouselItem
                key={property.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <div
                  className={cn(
                    "h-full",
                    isInView && shouldAnimate && "animate-fade-in-up",
                  )}
                  style={{
                    animationDelay:
                      isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
                  }}
                >
                  <PropertyCard property={property} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/properties">View All Properties</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default Property;
