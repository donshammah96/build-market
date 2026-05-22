import { Skeleton } from "@/components/ui/skeleton";

/**
 * Layout-matched skeleton for onboarding route.
 * Mirrors the onboarding page structure: card outline with form field placeholders.
 */
export default function OnboardingLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 md:px-6 md:py-10">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(130deg,var(--color-onboarding-surface)_0%,color-mix(in_oklab,var(--color-onboarding-primary)_20%,transparent)_38%,transparent_100%)]" />
        <div className="absolute top-[-8rem] right-[-7rem] h-[28rem] w-[28rem] rounded-full bg-[var(--color-onboarding-glow)]/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-[26rem] w-[26rem] rounded-full bg-[var(--color-onboarding-accent)]/22 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4b5f7f1f_1px,transparent_1px),linear-gradient(to_bottom,#4b5f7f1f_1px,transparent_1px)] bg-[size:22px_22px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Breadcrumb skeleton */}
        <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-onboarding-primary)]/25 bg-[var(--color-onboarding-surface)]/70 px-4 py-4 shadow-[0_24px_55px_-35px_rgba(13,20,32,0.95)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:px-5">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-11 w-28" />
        </div>

        {/* Step indicator skeleton */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-14 rounded-full" />
            <Skeleton className="h-0.5 w-10 sm:w-12" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <Skeleton className="mb-3 h-12 w-72 sm:w-96" />
          <Skeleton className="h-5 w-64 sm:w-[32rem]" />
        </div>

        {/* Card skeleton */}
        <div className="mx-auto w-full max-w-2xl">
          <div className="space-y-6 rounded-[18px] border border-[var(--color-onboarding-primary)]/30 bg-[var(--color-onboarding-surface)]/80 p-4 shadow-[0_24px_55px_-35px_rgba(13,20,32,0.95)] backdrop-blur-xl sm:p-6 md:p-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-11 w-full mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
