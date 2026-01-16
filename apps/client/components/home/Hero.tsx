"use client";

import { Suspense, useState, type FC, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import RegisterForm from "@/components/forms/RegisterForm";
import { ROUTES } from "@/lib/links";
import { useShouldAnimate } from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

// =============================================================================
// Hero Component - Optimized for performance
// =============================================================================

/**
 * Hero section for the homepage.
 * Uses CSS animations with JS enhancement fallback for reduced motion users.
 */
export const Hero: FC = memo(function Hero() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      className="relative min-h-[95vh] flex flex-col justify-center items-center overflow-hidden bg-zinc-900"
      aria-label="Hero section"
    >
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 bg-zinc-900">
        {/* Fallback gradient (shown immediately or on image error) */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black z-0" />

        {/* Hero image with proper loading optimization */}
        {!imageError && (
          <div
            className={cn(
              "relative w-full h-full z-10 transition-opacity duration-1000",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          >
            <Image
              src="/hero.png"
              alt="Modern Kenyan Architecture showcasing contemporary building design"
              fill
              className="object-cover"
              priority
              sizes="100vw"
              quality={85}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMH/8QAIhAAAgEDAwUBAAAAAAAAAAAAAQIDAAQRBRIhBhMiMUFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAaEQADAQADAAAAAAAAAAAAAAABAgMAESEi/9oADAMBAAIRAxEAPwCdE1C4+P0W5A8iKUpUM8vkOAjxJ//Z"
            />
          </div>
        )}

        {/* Overlay gradient for text readability */}
        <div
          className="absolute inset-0 z-20 bg-black/60 bg-gradient-to-r from-black/80 via-black/40 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-30 container mx-auto px-4 sm:px-6 md:px-20 pt-20 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
          {/* Left Column: Text Content */}
          <div
            className={cn(
              "max-w-2xl text-center lg:text-left space-y-8",
              shouldAnimate && "animate-fade-in-up"
            )}
          >
            <h1
              className={cn(
                "text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]",
                shouldAnimate && "animate-fade-in-up"
              )}
              style={{ animationDelay: shouldAnimate ? "100ms" : "0ms" }}
            >
              Build with <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Confidence.
              </span>
            </h1>

            <p
              className={cn(
                "text-lg sm:text-xl text-zinc-300 font-light leading-relaxed max-w-xl mx-auto lg:mx-0",
                shouldAnimate && "animate-fade-in-up"
              )}
              style={{ animationDelay: shouldAnimate ? "200ms" : "0ms" }}
            >
              Connect with Kenya&apos;s top verified architects, engineers, and
              contractors. From blueprint to occupancy, we bridge the trust gap.
            </p>

            <div
              className={cn(
                "flex flex-col sm:flex-row gap-4 justify-center lg:justify-start",
                shouldAnimate && "animate-fade-in-up"
              )}
              style={{ animationDelay: shouldAnimate ? "300ms" : "0ms" }}
            >
              <Button
                size="lg"
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-8 text-lg rounded-full shadow-lg shadow-emerald-900/20 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Link href={ROUTES.findProfessional}>Find a Professional</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-14 px-8 text-lg rounded-full backdrop-blur-sm transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Link href={ROUTES.ideaBooks}>View Projects</Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Register Form Card */}
          <div
            className={cn(
              "w-full max-w-md",
              shouldAnimate && "animate-slide-in-right"
            )}
            style={{ animationDelay: shouldAnimate ? "400ms" : "0ms" }}
          >
            <div className="bg-white/95 backdrop-blur-xl p-1 rounded-2xl shadow-2xl border border-white/20">
              <div className="bg-white/60 p-6 sm:p-8 rounded-xl">
                <div className="mb-6 space-y-1">
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                    Get Started
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    Join the marketplace today
                  </p>
                </div>

                <Suspense fallback={<FormSkeleton />}>
                  <div className="min-h-[320px]">
                    <RegisterForm />
                  </div>
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

// =============================================================================
// Sub-components
// =============================================================================

/** Skeleton loader for the registration form */
const FormSkeleton: FC = () => (
  <div
    className="space-y-4 w-full h-[320px] flex flex-col justify-center"
    role="status"
    aria-label="Loading registration form"
  >
    <div className="h-10 bg-zinc-200 rounded-md w-full animate-pulse" />
    <div
      className="h-10 bg-zinc-200 rounded-md w-full animate-pulse"
      style={{ animationDelay: "75ms" }}
    />
    <div
      className="h-12 bg-zinc-300 rounded-md w-full mt-4 animate-pulse"
      style={{ animationDelay: "150ms" }}
    />
    <div
      className="h-4 bg-zinc-100 rounded-md w-2/3 mx-auto mt-4 animate-pulse"
      style={{ animationDelay: "225ms" }}
    />
    <span className="sr-only">Loading...</span>
  </div>
);

export default Hero;
