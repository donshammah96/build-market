"use client";

import * as React from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-widest border border-primary transition-all duration-300",
      outline:
        "bg-transparent text-foreground border border-border hover:bg-accent hover:text-accent-foreground transition duration-300 ease-out",
      ghost: "hover:bg-accent text-foreground",
      link: "text-primary hover:text-primary/80 transition gap-2 no-underline p-0",
    };

    const sizes = {
      default: "h-10 px-6 py-2 text-xs font-bold",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "h-14 px-8 text-sm tracking-[0.2em]",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md ring-offset-background transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
          "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className ?? "",
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground",
      "transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className ?? "",
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground appearance-none",
      "transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className ?? "",
    )}
    {...props}
  />
));
Select.displayName = "Select";
