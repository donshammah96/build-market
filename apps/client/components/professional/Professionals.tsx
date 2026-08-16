"use client";

import { memo, useState } from "react";
import ProfessionalCard from "./ProfessionalCard";
import { ProfessionalCardData } from "../../types/professional";
import Link from "next/link";
import { Button } from "../ui/button";
import { ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { ROUTES } from "@/lib/routes";
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

// Fallback Data - using services array (matches ServiceCategory structure from seed)
const defaultProfessionals: ProfessionalCardData[] = [
  {
    id: "1",
    name: "Evans Ndegwa",
    companyName: "Evannas Structural Engineering",
    profession: "structural_engineer",
    professionLabel: "Structural Engineer",
    title: "Structural Engineer",
    services: [
      {
        id: "1",
        name: "Structural Analysis",
        slug: "structural-analysis",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "Civil Works",
        slug: "civil-works",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    portfolioImage:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800",
    yearsExperience: 6,
    projectCount: 10 as number | undefined,
    status: "VERIFIED",
    verified: true,
    rating: 4.8,
    reviewCount: 24,
    location: "Nairobi, Kenya",
  },
  {
    id: "2",
    name: "Don Shammah",
    companyName: "Shammah Architecture",
    profession: "architect",
    professionLabel: "Architect",
    title: "Lead Architect",
    services: [
      {
        id: "3",
        name: "Architectural Design",
        slug: "architectural-design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "4",
        name: "3D Rendering & Visualization",
        slug: "3d-rendering-visualization",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    portfolioImage:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800",
    yearsExperience: 5,
    projectCount: 8 as number | undefined,
    status: "VERIFIED",
    verified: true,
    rating: 4.9,
    reviewCount: 31,
    location: "Karen, Nairobi",
  },
  {
    id: "3",
    name: "Robinson Jiriswa",
    companyName: "Jiriswa Interiors",
    profession: "interior_designer",
    professionLabel: "Interior Designer",
    title: "Interior Designer",
    services: [
      {
        id: "5",
        name: "Full Home Furnishing",
        slug: "full-home-furnishing",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "6",
        name: "Lighting Design",
        slug: "lighting-design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    portfolioImage:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
    yearsExperience: 3,
    projectCount: 2 as number | undefined,
    status: "VERIFIED",
    verified: true,
    rating: 5.0,
    reviewCount: 42,
    location: "Kisumu, Kenya",
  },
  {
    id: "4",
    name: "Ken Roy",
    companyName: "Roy Engineering",
    profession: "civil_engineer",
    professionLabel: "Civil Engineer",
    title: "Civil Engineer",
    services: [
      {
        id: "7",
        name: "Civil Works",
        slug: "civil-works",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "8",
        name: "Retaining Walls",
        slug: "retaining-walls",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    portfolioImage:
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800",
    yearsExperience: 7,
    status: "VERIFIED",
    projectCount: 4 as number | undefined,
    verified: true,
    rating: 4.6,
    reviewCount: 18,
    location: "Embu, Kenya",
  },
];

interface ProfessionalsProps {
  professionals?: ProfessionalCardData[];
}

export const Professionals = memo(function Professionals({
  professionals = defaultProfessionals,
}: ProfessionalsProps) {
  const [ref, isInView] = useIntersectionObserver();
  const [api, setApi] = useState<CarouselApi>();
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      className="py-20 bg-zinc-50 border-y border-zinc-200"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="professionals-heading"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        {/* Header with Navigation Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
          <div
            className={cn(isInView && shouldAnimate && "animate-slide-in-left")}
          >
            <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-emerald-600 uppercase bg-emerald-50 rounded-full">
              Expert Talent
            </div>
            <h2
              id="professionals-heading"
              className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight font-display"
            >
              Featured <span className="text-emerald-600">Professionals</span>
            </h2>
          </div>

          {/* Custom Navigation Buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollPrev()}
              aria-label="Previous professional"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              onClick={() => api?.scrollNext()}
              aria-label="Next professional"
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
              <CarouselItem
                key={professional.id}
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
                  <ProfessionalCard professional={professional} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Pro Recruitment Callout Banner */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-zinc-950 text-white border border-zinc-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              For Licensed Practitioners
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              Are you an Architect, Engineer, or Contractor in Kenya?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Showcase your project portfolio to vetted clients, protect your
              milestone earnings with escrow, and win high-budget contracts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold rounded-full h-11 px-6 text-sm shadow-md shadow-emerald-950/50 w-full sm:w-auto transition-all"
              asChild
            >
              <Link href={ROUTES.professional}>
                Explore Pro Network
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white rounded-full h-11 px-6 text-sm bg-zinc-900/50 backdrop-blur-xs w-full sm:w-auto transition-all"
              asChild
            >
              <Link href={ROUTES.findProfessional}>Browse Directory</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
});

export default Professionals;
