"use client";

import { memo, useMemo } from "react";
import type { Review } from "@/app/data/homeData";
import { reviews as allReviews } from "@/app/data/homeData";
import { ReviewCard } from "./ReviewCard";
import Link from "next/link";
import { ROUTES } from "@/lib/links";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

// Robust helper component for the title
const TitleWithHighlight = memo(function TitleWithHighlight({
  text,
}: {
  text: string;
}) {
  const words = text.split(" ");
  const highlightCount = words.length > 3 ? 2 : 1;
  const normalText = words.slice(0, -highlightCount).join(" ");
  const highlightText = words.slice(-highlightCount).join(" ");

  return (
    <span className="block">
      {normalText}{" "}
      <span className="text-emerald-600 relative inline-block">
        {highlightText}
      </span>
    </span>
  );
});

interface ReviewsSectionProps {
  searchTerm?: string;
}

export const ReviewsSection = memo(function ReviewsSection({
  searchTerm = "",
}: ReviewsSectionProps) {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  const filteredReviews = useMemo(() => {
    if (!searchTerm.trim()) return allReviews;
    const term = searchTerm.toLowerCase().trim();
    return allReviews.filter(
      (review: Review) =>
        review.quote.toLowerCase().includes(term) ||
        review.name.toLowerCase().includes(term),
    );
  }, [searchTerm]);

  const displayReviews: Review[] =
    filteredReviews.length > 0 ? filteredReviews : allReviews;
  const displaySlice = displayReviews.slice(0, 3);

  return (
    <section
      className="bg-zinc-50/50 relative py-16 sm:py-24"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="reviews-heading"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-12 gap-6">
          <div
            className={cn(isInView && shouldAnimate && "animate-slide-in-left")}
          >
            <h2
              id="reviews-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-2"
            >
              <TitleWithHighlight text="Trusted by Kenyans everywhere" />
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl">
              From Runda to Riverside, see how we are helping homeowners build
              their dreams with confidence.
            </p>
          </div>

          <div
            className={cn(
              "hidden sm:block",
              isInView && shouldAnimate && "animate-slide-in-right",
            )}
            style={{ animationDelay: "200ms" }}
          >
            <Button variant="outline" className="group" asChild>
              <Link href={ROUTES.reviews}>
                Read all stories
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displaySlice.map((review, index) => (
            <div
              key={review.id}
              className={cn(
                "h-full",
                isInView && shouldAnimate && "animate-fade-in-up",
              )}
              style={{
                animationDelay:
                  isInView && shouldAnimate ? `${index * 150}ms` : "0ms",
              }}
            >
              <ReviewCard
                quote={review.quote}
                name={review.name}
                location={review.location}
                role={review.role}
                image={review.image}
                rating={review.rating}
              />
            </div>
          ))}
        </div>

        {/* Mobile-only View More Button */}
        <div className="mt-8 sm:hidden text-center">
          <Button variant="outline" className="w-full" asChild>
            <Link href={ROUTES.reviews}>Read all stories</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default ReviewsSection;
