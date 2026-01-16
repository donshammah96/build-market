'use client';

import Image from 'next/image';
import { FC, memo, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent } from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  images 
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
          "h-full flex flex-col border-0 shadow-sm bg-white overflow-hidden rounded-2xl cursor-pointer",
          "transition-shadow duration-300 hover:shadow-xl"
        )}
        onClick={handleCardClick}
        role="article"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Image Area */}
        <div className="relative h-64 overflow-hidden bg-zinc-100">
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
                className="left-2 bg-white/80 hover:bg-white border-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                aria-label="Previous image"
              />
              <CarouselNext 
                className="right-2 bg-white/80 hover:bg-white border-0 opacity-0 group-hover:opacity-100 transition-opacity" 
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
            className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" 
            aria-hidden="true"
          />
        </div>

        {/* Content Area */}
        <CardContent className="flex flex-col flex-grow p-6">
          <h3 className="text-xl font-bold text-zinc-900 mb-2 group-hover:text-emerald-600 transition-colors">
            {title}
          </h3>
          <p className="text-zinc-500 text-sm leading-relaxed line-clamp-2 mb-4">
            {description}
          </p>
          
          <div className="mt-auto flex items-center text-sm font-semibold text-emerald-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            Explore <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default FeatureCard;
