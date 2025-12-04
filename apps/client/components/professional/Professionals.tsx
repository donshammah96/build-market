'use client';

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import ProfessionalCard from "./ProfessionalCard";
import { ProfessionalCardData } from "../../types/professional";
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

// Fallback Data (Brief for brevity, ensure you keep your full list)
const defaultProfessionals: ProfessionalCardData[] = [
  {
    id: "1",
    name: "Evans Ndegwa",
    companyName: "Evannas Structural Engineering",
    title: "Structural Engineer",
    servicesOffered: ["Structural Engineering", "Building Design"],
    portfolioImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800",
    yearsExperience: 10,
    verified: true,
    rating: 4.8,
    reviewCount: 24,
    location: "Nairobi, Kenya"
  },
  {
    id: "2",
    name: "Don Shammah",
    companyName: "Shammah Architecture",
    title: "Lead Architect",
    servicesOffered: ["Architecture", "3D Modeling"],
    portfolioImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800",
    yearsExperience: 8,
    verified: true,
    rating: 4.9,
    reviewCount: 31,
    location: "Karen, Nairobi"
  },
   {
    id: "3",
    name: "Robinson Jiriswa",
    companyName: "Jiriswa Interiors",
    title: "Interior Designer",
    servicesOffered: ["Interior Design", "Space Planning"],
    portfolioImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
    yearsExperience: 5,
    verified: true,
    rating: 5.0,
    reviewCount: 42,
    location: "Kisumu, Kenya"
  },
  {
    id: "4",
    name: "Ken Roy",
    companyName: "Roy Engineering",
    title: "Civil Engineer",
    servicesOffered: ["Civil Engineering", "Building Design"],
    portfolioImage: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800",
    yearsExperience: 7,
    verified: true,
    rating: 4.6,
    reviewCount: 18,
    location: "Embu, Kenya"
  },
];

interface ProfessionalsProps {
  professionals?: ProfessionalCardData[];
}

export function Professionals({ professionals = defaultProfessionals }: ProfessionalsProps) {
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
              Expert Talent
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold font-inter text-zinc-900 tracking-tight">
              Featured <span className="text-emerald-600">Professionals</span>
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
            {professionals.map((professional, index) => (
              <CarouselItem key={professional.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="h-full"
                >
                  <ProfessionalCard professional={professional} />
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-8 text-center sm:hidden">
            <Button variant="outline" className="w-full" asChild>
                <Link href="/professionals">View All Professionals</Link>
            </Button>
        </div>
      </div>
    </section>
  );
}