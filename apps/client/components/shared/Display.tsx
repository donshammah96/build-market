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
      "bg-card border border-border text-card-foreground rounded-lg",
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
      "inline-flex items-center border px-3 py-1 text-[10px] font-medium transition-colors bg-primary/10 text-primary border-primary/40 uppercase tracking-widest rounded-full",
      className ?? "",
    )}
    {...props}
  />
));
Badge.displayName = "Badge";
