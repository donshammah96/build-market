"use client";

import * as React from "react";
import { cn } from "./FormPrimitives";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-white/5 border border-white/10 text-cream-50 rounded-none",
      className ?? "",
    )}
    {...props}
  />
));
Card.displayName = "Card";

export const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center border px-3 py-1 text-[10px] font-medium transition-colors bg-[#E0C9A6]/10 text-[#E0C9A6] border-[#E0C9A6]/50 uppercase tracking-widest",
      className ?? "",
    )}
    {...props}
  />
));
Badge.displayName = "Badge";
