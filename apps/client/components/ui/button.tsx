import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[loading=true]:pointer-events-none data-[loading=true]:opacity-60 data-[loading=true]:cursor-wait data-[success=true]:border-success data-[success=true]:bg-success/10 data-[success=true]:text-success data-[error=true]:border-error data-[error=true]:bg-error/10 data-[error=true]:text-error active:scale-[0.98] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  isSuccess = false,
  isError = false,
  loadingText,
  successText,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
    isSuccess?: boolean;
    isError?: boolean;
    loadingText?: string;
    successText?: string;
  }) {
  const shouldUseSlot =
    asChild &&
    React.isValidElement(children) &&
    children.type !== React.Fragment;
  const slotChildElement = shouldUseSlot
    ? (React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>)
    : null;
  const contentSource = slotChildElement?.props.children ?? children;
  const Comp = shouldUseSlot ? Slot : "button";
  const effectiveDisabled = disabled || isLoading;

  const content = (
    <>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {!isLoading && isSuccess ? <Check className="h-4 w-4" /> : null}
      {!isLoading && !isSuccess && isError ? (
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {isLoading
        ? (loadingText ?? contentSource)
        : isSuccess
          ? (successText ?? contentSource)
          : contentSource}
    </>
  );

  const slotChild = slotChildElement
    ? React.cloneElement(slotChildElement, undefined, content)
    : null;

  return (
    <Comp
      data-slot="button"
      data-loading={isLoading || undefined}
      data-success={isSuccess || undefined}
      data-error={isError || undefined}
      disabled={effectiveDisabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {shouldUseSlot ? slotChild : content}
    </Comp>
  );
}

export { Button, buttonVariants };
