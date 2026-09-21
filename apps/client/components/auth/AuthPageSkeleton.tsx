import React from "react";

interface AuthPageSkeletonProps {
  variant: "sign-in" | "sign-up";
}

export function AuthPageSkeleton({ variant }: AuthPageSkeletonProps) {
  return (
    <div className="w-full animate-pulse space-y-6 p-6 sm:p-8">
      {/* Header section */}
      <div className="space-y-3">
        <div className="h-7 w-2/3 rounded-md bg-zinc-200" />
        <div className="h-4 w-1/2 rounded-md bg-zinc-100" />
      </div>

      {/* Social login button (placed at bottom or top depending on appearance setup, Clerk defaults block button first or bottom, let's build for typical) */}
      <div className="space-y-4 pt-2">
        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded-md bg-zinc-200" />
            <div className="h-11 w-full rounded-lg bg-zinc-100" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded-md bg-zinc-200" />
            <div className="h-11 w-full rounded-lg bg-zinc-100" />
          </div>
          {variant === "sign-up" && (
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-md bg-zinc-200" />
              <div className="h-11 w-full rounded-lg bg-zinc-100" />
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <div
            className={`h-11 w-full rounded-lg ${variant === "sign-up" ? "bg-emerald-200" : "bg-zinc-200"}`}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-zinc-100" />
        <div className="h-3 w-8 rounded-sm bg-zinc-200 text-center" />
        <div className="h-px flex-1 bg-zinc-100" />
      </div>

      {/* Social buttons block */}
      <div className="h-11 w-full rounded-lg bg-zinc-100" />

      {/* Footer text link */}
      <div className="flex justify-center pt-2">
        <div className="h-4 w-40 rounded-md bg-zinc-100" />
      </div>
    </div>
  );
}
