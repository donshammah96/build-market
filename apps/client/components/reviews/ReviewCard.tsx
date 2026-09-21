"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Star, Quote, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewCardProps {
  quote: string;
  name: string;
  location?: string;
  role?: string;
  image: string;
  rating?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ReviewCard = memo(function ReviewCard({
  quote,
  name,
  location = "Nairobi, Kenya",
  role = "Homeowner",
  image,
  rating = 5,
}: ReviewCardProps) {
  return (
    <div className="h-full hover-lift">
      <Card
        className={cn(
          "h-full border border-border/70 bg-card text-card-foreground shadow-xs hover:shadow-xl dark:hover:shadow-black/50 hover:border-primary/40 flex flex-col p-6 rounded-2xl relative overflow-hidden group transition-all duration-300",
        )}
      >
        {/* Background Decoration Quote Icon */}
        <div
          className="absolute top-4 right-6 opacity-5 group-hover:opacity-10 transition-opacity"
          aria-hidden="true"
        >
          <Quote size={80} className="text-primary fill-primary" />
        </div>

        {/* Rating Stars */}
        <div
          className="flex gap-1 mb-4"
          role="img"
          aria-label={`Rating: ${rating} out of 5 stars`}
        >
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={16}
              className={cn(
                "fill-current",
                i < rating ? "text-amber-400" : "text-muted-foreground/25",
              )}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Quote Content */}
        <blockquote className="grow mb-6 relative z-10">
          <p className="text-foreground/90 text-lg leading-relaxed font-medium">
            &ldquo;{quote}&rdquo;
          </p>
        </blockquote>

        {/* Footer: User Info */}
        <footer className="flex items-center gap-3 mt-auto pt-4 border-t border-border/60">
          <Avatar className="h-12 w-12 border-2 border-border/80 shadow-xs">
            <AvatarImage src={image} alt={name} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <cite className="text-foreground font-semibold text-sm not-italic">
                {name}
              </cite>
              <BadgeCheck
                size={14}
                className="text-primary"
                aria-label="Verified reviewer"
              />
            </div>
            <span className="text-muted-foreground text-xs font-medium">
              {role} • {location}
            </span>
          </div>
        </footer>
      </Card>
    </div>
  );
});
