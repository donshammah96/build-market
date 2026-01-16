"use client";

import { memo, type FC } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/links";
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
      className="py-20 px-4 sm:px-6 md:px-20 bg-zinc-900 overflow-hidden relative"
      aria-labelledby="cta-heading"
    >
      {/* Abstract Background shapes - GPU optimized with will-change */}
      <div
        className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-[1280px] mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
        {/* Text Content */}
        <div
          className={cn(
            "max-w-2xl text-center md:text-left",
            isInView && shouldAnimate && "animate-fade-in-up"
          )}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm font-medium mb-6">
            <Hammer size={14} aria-hidden="true" />
            <span>Ready to build?</span>
          </div>

          <h2
            id="cta-heading"
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6"
          >
            Let&apos;s get your project{" "}
            <span className="text-emerald-500">off the ground.</span>
          </h2>

          <p className="text-zinc-400 text-lg md:text-xl max-w-lg mx-auto md:mx-0">
            Join thousands of Kenyan homeowners and top-rated professionals
            building better, together.
          </p>
        </div>

        {/* Buttons */}
        <div
          className={cn(
            "flex flex-col sm:flex-row gap-4 w-full md:w-auto",
            isInView && shouldAnimate && "animate-slide-in-right"
          )}
          style={{
            animationDelay: isInView && shouldAnimate ? "200ms" : "0ms",
          }}
        >
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg h-14 px-8 transition-transform hover:scale-[1.02] active:scale-95"
            asChild
          >
            <Link href={ROUTES.joinAsPro}>
              Join as a Pro
              <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="text-lg h-14 px-8 bg-white text-zinc-900 hover:bg-zinc-100 transition-transform hover:scale-[1.02] active:scale-95"
            asChild
          >
            <Link href={ROUTES.signIn}>Log In</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default CTA;
