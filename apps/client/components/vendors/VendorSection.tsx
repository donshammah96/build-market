"use client";

import { memo, useMemo, useState } from "react";
import VendorCard from "../vendors/VendorCard";
import Link from "next/link";
import { ROUTES } from "@/lib/links";
import { Button } from "../ui/button";
import { VendorCardData, County } from "../../types/vendor";
import {
  STORE_CATEGORY_LABELS,
  STORE_TYPE_LABELS,
  COUNTY_LABELS,
} from "../../types/store";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

const defaultStores: VendorCardData[] = [
  {
    id: "1",
    name: "Evannas Hardware Store",
    description:
      "We sell a variety of hardware products for your home and business.",
    image: "/hardware.png",
    categories: ["hardware"],
    verified: true,
    rating: 4.5,
    slug: "hardware",
    county: "NAIROBI" as County,
    images: [],
    categoryLabels: [STORE_CATEGORY_LABELS.hardware],
    storeType: "retail",
    storeTypeLabel: STORE_TYPE_LABELS.retail,
    reviewCount: 100,
    productCount: 1000,
    location: `${COUNTY_LABELS.NAIROBI}, ${COUNTY_LABELS.NAIROBI}`,
    address: "Lavington, Nairobi",
    city: "Nairobi",
    featured: true,
  },
  {
    id: "2",
    name: "Shammah's Kitchen Fixtures",
    description:
      "We sell a variety of kitchen fixtures for your home and business.",
    image: "/kitchen-fixtures.png",
    categories: ["kitchen_and_bath"],
    verified: true,
    rating: 4.5,
    featured: true,
    slug: "kitchen-and-bath",
    county: "NAIROBI" as County,
    images: [],
    categoryLabels: [STORE_CATEGORY_LABELS.kitchen_and_bath],
    storeType: "retail",
    storeTypeLabel: STORE_TYPE_LABELS.retail,
    reviewCount: 100,
    productCount: 1000,
    location: `${COUNTY_LABELS.NAIROBI}, ${COUNTY_LABELS.NAIROBI}`,
    address: "123 Main St, Nairobi",
    city: "Nairobi",
  },
  {
    id: "3",
    name: "Roy's Bespoke Tiles",
    description: "We sell a variety of tiles for your home and business.",
    image: "/tiles.png",
    categories: ["tiles_and_ceramics"],
    verified: true,
    rating: 4.5,
    featured: true,
    slug: "tiles-and-ceramics",
    county: "NAIROBI" as County,
    images: [],
    categoryLabels: [STORE_CATEGORY_LABELS.tiles_and_ceramics],
    storeType: "retail",
    storeTypeLabel: STORE_TYPE_LABELS.retail,
    reviewCount: 100,
    productCount: 1000,
    location: `${COUNTY_LABELS.NAIROBI}, ${COUNTY_LABELS.NAIROBI}`,
    address: "Waiyaki Way, Nairobi",
    city: "Nairobi",
  },
  {
    id: "4",
    name: "Amanda's Interior Designs",
    description:
      "We deal in interior design products for your home and business.",
    image: "/home-decor.png",
    categories: ["building_materials"],
    verified: true,
    rating: 4.5,
    slug: "interior-design",
    featured: true,
    county: "EMBU" as County,
    images: [],
    categoryLabels: [STORE_CATEGORY_LABELS.building_materials],
    storeType: "retail",
    storeTypeLabel: STORE_TYPE_LABELS.retail,
    reviewCount: 100,
    productCount: 1000,
    location: `${COUNTY_LABELS.EMBU}, ${COUNTY_LABELS.EMBU}`,
    address: "123 Main St, Embu",
    city: "Nairobi",
  },
];

interface VendorsSectionProps {
  searchTerm?: string;
  stores?: VendorCardData[];
}

export const VendorsSection = memo(function VendorsSection({
  searchTerm = "",
  stores,
}: VendorsSectionProps) {
  const [ref, isInView] = useIntersectionObserver();
  const [api, setApi] = useState<CarouselApi>();
  const shouldAnimate = useShouldAnimate();

  const vendorCards: VendorCardData[] = stores || defaultStores;

  // Memoize filtered stores
  const filteredStores = useMemo(() => {
    if (!searchTerm) return vendorCards;
    return vendorCards.filter((vendor) =>
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vendorCards, searchTerm]);

  return (
    <section
      className="py-20 bg-white"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="vendors-heading"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
          <div
            className={cn(isInView && shouldAnimate && "animate-slide-in-left")}
          >
            <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-amber-600 uppercase bg-amber-50 rounded-full">
              Marketplace
            </div>
            <h2
              id="vendors-heading"
              className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight"
            >
              Top Rated <span className="text-emerald-600">Suppliers</span>
            </h2>
          </div>

          {/* Controls */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollPrev()}
              aria-label="Previous supplier"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollNext()}
              aria-label="Next supplier"
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
            {filteredStores.map((vendor, index) => (
              <CarouselItem
                key={vendor.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <div
                  className={cn(
                    "h-full",
                    isInView && shouldAnimate && "animate-fade-in-up"
                  )}
                  style={{
                    animationDelay:
                      isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
                  }}
                >
                  <VendorCard vendor={vendor} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-12 text-center">
          <Button
            variant="ghost"
            size="lg"
            className="text-zinc-500 hover:text-emerald-600 transition-colors"
            asChild
          >
            <Link href={ROUTES.stores}>
              Browse all suppliers <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default VendorsSection;
