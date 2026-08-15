"use client";

import { memo, useMemo } from "react";
import { features as allFeatures, type Feature } from "../../app/data/homeData";
import FeatureCard from "./FeatureCard";
import { ROUTES } from "@/lib/links";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

const defaultFeatures: Feature[] = [
  {
    title: "Idea Books",
    description: "Curated galleries of Kenyan homes to spark your imagination.",
    image: "/design.png",
    imageAlt: "Idea Books",
    href: ROUTES.ideaBooks,
  },
  {
    title: "Find a Professional",
    description:
      "Connect with verified architects, engineers, and contractors.",
    image: "/professional.png",
    imageAlt: "Find a Professional",
    href: ROUTES.findProfessional,
  },
  {
    title: "Find Properties",
    description: "Get free expert guidance on your construction journey.",
    image: "/hero-realestate.jpg",
    imageAlt: "Find Properties",
    href: ROUTES.properties,
  },
];

interface FeaturesSectionProps {
  searchTerm?: string;
  features?: Feature[];
}

export const FeaturesSection = memo(function FeaturesSection({
  searchTerm = "",
  features = allFeatures.length > 0 ? allFeatures : defaultFeatures,
}: FeaturesSectionProps) {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  // Memoize filtered features to prevent recalculation on every render
  const filteredFeatures = useMemo(() => {
    if (!searchTerm) return features;
    const term = searchTerm.toLowerCase();
    return features.filter(
      (feature) =>
        feature.title.toLowerCase().includes(term) ||
        feature.description.toLowerCase().includes(term),
    );
  }, [features, searchTerm]);

  return (
    <section
      className="py-24 bg-linear-to-b from-muted/60 via-background to-background"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-20">
        {/* Section Header */}
        <div
          className={cn(
            "mb-12 max-w-2xl",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
        >
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight"
          >
            Everything you need to{" "}
            <span className="text-primary">build better.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Navigate your construction project with tools designed for the
            Kenyan market.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredFeatures.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
              )}
              style={{
                animationDelay:
                  isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
              }}
            >
              <FeatureCard {...feature} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default FeaturesSection;
