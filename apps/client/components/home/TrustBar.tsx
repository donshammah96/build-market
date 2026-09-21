"use client";

import { memo, type RefObject } from "react";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

interface Stat {
  value: string;
  label: string;
}

/**
 * Qualitative platform mechanics & value propositions.
 * Provides instant credibility and trust without exposing the platform to
 * false-advertising claims under Kenya Consumer Protection Act §12.
 */
const defaultStats: Stat[] = [
  { value: "100% Vetted", label: "Licensed engineers & architects" },
  { value: "Milestone Recorded", label: "Stage sign-offs tracked between parties" },
  { value: "County Reach", label: "Verified talent across Kenya" },
  { value: "Transparent Quotes", label: "Direct messaging & scope agreements" },
];

export const TrustBar = memo(function TrustBar({
  items = defaultStats,
}: {
  items?: Stat[];
}) {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      className="border-y border-border bg-muted/40"
      aria-label="Platform statistics"
      ref={ref as RefObject<HTMLElement>}
    >
      <div
        className={cn(
          "max-w-7xl mx-auto px-4 sm:px-6 md:px-20 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center",
          isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
        )}
      >
        {items.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {stat.value}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
});

export default TrustBar;
