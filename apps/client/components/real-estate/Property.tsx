'use client';

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import PropertyCard from "./PropertyCard";
import { PropertyCardData } from "../../types/property";
import Link from "next/link";
import { Button } from "../ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "../ui/carousel";
import React from "react";

const FEATURED_PROPERTIES: PropertyCardData[] = [
  {
    id: "1",
    title: "Luxury 4-Bed Villa in Karen",
    price: 85000000,
    currency: "KES",
    location: "Karen, Nairobi",
    type: "SALE",
    category: "RESIDENTIAL",
    status: "AVAILABLE",
    beds: 4,
    baths: 5,
    area: 4500,
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
    featured: true,
    agent: { name: "Pam Golding", image: "https://i.pravatar.cc/150?u=pg" }
  },
  {
    id: "2",
    title: "Modern Apartment in Kilimani",
    price: 120000,
    currency: "KES",
    location: "Kilimani, Nairobi",
    type: "RENT",
    category: "RESIDENTIAL",
    featured: true,
    status: "AVAILABLE",
    beds: 2,
    baths: 2,
    area: 1200,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    agent: { name: "Hass Consult", image: "https://i.pravatar.cc/150?u=hc" }
  },
  {
    id: "3",
    title: "Prime Commercial Space",
    price: 250000,
    currency: "KES",
    location: "Westlands, Nairobi",
    type: "LEASE",
    category: "COMMERCIAL",
    status: "UNDER_OFFER",
    area: 2000,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    featured: true,
    agent: { name: "Shammah Realtors", image: "https://i.pravatar.cc/150?u=hc" }
  },
  {
    id: "4",
    title: "Half Acre Land",
    price: 15000000,
    currency: "KES",
    location: "Ruaka, Kiambu",
    type: "SALE",
    category: "LAND",
    status: "AVAILABLE",
    featured: true,
    area: 21780, // sqft approx for 0.5 acre
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    agent: { name: "Hass Consult", image: "https://i.pravatar.cc/150?u=hc" }
  }
];

interface PropertyProps {
    properties?: PropertyCardData[];
}

export function Property({ properties = FEATURED_PROPERTIES }: PropertyProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [api, setApi] = React.useState<CarouselApi>();

    return (
        <section className="py-20 bg-zinc-50 border-y border-zinc-200" ref={ref}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
            
            {/* Header with Navigation Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.6 }}
            >
                <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-emerald-600 uppercase bg-emerald-50 rounded-full">
                Real Estate
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold font-inter text-zinc-900 tracking-tight">
                Featured <span className="text-emerald-600">Properties</span>
                </h2>
            </motion.div>

            {/* Custom Navigation Buttons positioned at top-right */}
            <div className="hidden sm:flex gap-2">
                <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600"
                onClick={() => api?.scrollPrev()}
                >
                <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600"
                onClick={() => api?.scrollNext()}
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
                <CarouselItem key={property.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className="h-full"
                    >
                    <PropertyCard property={property} />
                    </motion.div>
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
}