"use client";

import { memo, type FC } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Button } from "../ui/button";
import { ArrowRight, Hammer } from "lucide-react";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

export const CTA: FC = memo(function CTA() {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-20 px-4 sm:px-6 md:px-20 bg-linear-to-br from-emerald-50 via-white to-emerald-100/60 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/50 border-t border-emerald-200/60 dark:border-emerald-500/20 overflow-hidden relative transition-colors duration-300"
      aria-labelledby="cta-heading"
    >
      {/* Abstract Background shapes - GPU optimized with will-change */}
      <div
        className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-400/20 dark:bg-primary/20 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-teal-300/20 dark:bg-chart-2/20 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
        {/* Text Content */}
        <div
          className={cn(
            "max-w-2xl text-center md:text-left",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Hammer size={14} aria-hidden="true" />
            <span>Ready to build?</span>
          </div>

          <h2
            id="cta-heading"
            className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold text-foreground tracking-tight mb-6"
          >
            Let&apos;s get your project{" "}
            <span className="text-primary">off the ground.</span>
          </h2>

          <p className="text-muted-foreground text-lg md:text-xl max-w-lg mx-auto md:mx-0 font-light leading-relaxed">
            Join thousands of Kenyan homeowners and top-rated professionals
            building better, together.
          </p>
        </div>

        {/* Buttons */}
        <div
          className={cn(
            "flex flex-col sm:flex-row gap-4 w-full md:w-auto",
            isInView && shouldAnimate && "motion-safe:animate-slide-in-right",
          )}
          style={{
            animationDelay: isInView && shouldAnimate ? "200ms" : "0ms",
          }}
        >
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-base sm:text-lg h-14 px-8 font-semibold rounded-full shadow-xl shadow-primary/20 motion-safe:hover:scale-[1.02] active:scale-95 transition-all"
            asChild
          >
            <Link href={ROUTES.professional}>
              Join as a Pro
              <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="text-base sm:text-lg h-14 px-8 rounded-full bg-card hover:bg-accent text-foreground border border-border shadow-xs motion-safe:hover:scale-[1.02] active:scale-95 transition-all"
            asChild
          >
            <Link href={ROUTES.findProfessional}>Find Professionals</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default CTA;
