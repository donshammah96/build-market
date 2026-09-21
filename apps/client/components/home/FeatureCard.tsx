"use client";

import Image from "next/image";
import { FC, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent } from "../ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feature {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
  images?: string[];
}

const FeatureCard: FC<Feature> = memo(function FeatureCard({
  title,
  description,
  image,
  imageAlt,
  href,
  images,
}) {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const allImages = images && images.length > 0 ? [image, ...images] : [image];
  const hasMultipleImages = allImages.length > 1;

  const handleCardClick = useCallback(() => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(href)}`);
    } else {
      router.push(href);
    }
  }, [isSignedIn, router, href]);

  return (
    <div className="h-full group hover-lift">
      <Card
        className={cn(
          "h-full flex flex-col border border-border/70 shadow-sm bg-card overflow-hidden rounded-2xl cursor-pointer",
          "transition-shadow duration-300 hover:shadow-xl hover:border-primary/30",
        )}
        onClick={handleCardClick}
        role="article"
        tabIndex={0}
        aria-label={`Open ${title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Image Area */}
        <div className="relative h-64 overflow-hidden bg-muted">
          {hasMultipleImages ? (
            <Carousel opts={{ loop: true }} className="w-full h-full">
              <CarouselContent className="h-full ml-0">
                {allImages.map((img, index) => (
                  <CarouselItem key={index} className="h-full pl-0">
                    <div className="relative h-64 w-full">
                      <Image
                        src={img}
                        alt={`${imageAlt} - ${index + 1}`}
                        fill
                        className="object-cover img-zoom"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        loading="lazy"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                className="left-2 bg-card/90 hover:bg-card border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Previous image"
              />
              <CarouselNext
                className="right-2 bg-card/90 hover:bg-card border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Next image"
              />
            </Carousel>
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={image}
                alt={imageAlt}
                fill
                className="object-cover img-zoom"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                loading="lazy"
              />
            </div>
          )}

          {/* Overlay Gradient on hover */}
          <div
            className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* Content Area */}
        <CardContent className="flex flex-col grow p-6">
          <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
            {description}
          </p>

          <div className="mt-auto flex items-center text-sm font-semibold text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            Explore <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default FeatureCard;
