"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import HomeownerForm from "@/components/forms/HomeownerForm";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import {
  Home,
  Briefcase,
  ArrowLeft,
  Loader2,
  X,
  ChevronRight,
  FastForward,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumbs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialogue";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { RoleCard } from "./RoleCard";
import { StepIndicator } from "./StepIndicator";
import type { OnboardingData } from "@build/types";

const createVariants = (
  prefersReducedMotion: boolean,
): Record<string, Variants> => ({
  fadeIn: {
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : -10 },
    animate: { opacity: 1, y: 0 },
  },
  fadeScale: {
    initial: { opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.95,
      transition: { duration: 0.2 },
    },
  },
  slideIn: {
    initial: { opacity: 0, x: prefersReducedMotion ? 0 : 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: prefersReducedMotion ? 0 : -50 },
  },
});

export type OnboardingRole = "client" | "professional";

export type OnboardingViewProps = {
  step: number;
  setStep: (step: number) => void;
  role: OnboardingRole | null;
  submitting: boolean;
  showCancelDialog: boolean;
  setShowCancelDialog: (open: boolean) => void;
  handleRoleSelect: (role: OnboardingRole) => void;
  handleCancelOnboarding: () => Promise<void>;
  handleSkip: (role: OnboardingRole) => Promise<void>;
  handleSubmit: (data: OnboardingData) => Promise<void>;
};

export function OnboardingView({
  step,
  setStep,
  role,
  submitting,
  showCancelDialog,
  setShowCancelDialog,
  handleRoleSelect,
  handleCancelOnboarding,
  handleSkip,
  handleSubmit,
}: OnboardingViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(raf);
  }, [step]);

  const variants = useMemo(
    () => createVariants(prefersReducedMotion),
    [prefersReducedMotion],
  );

  const roleSelectionPending = submitting && step === 1;
  const totalSteps = role === "professional" ? 6 : 2;
  const currentStep = step === 1 ? 1 : role === "professional" ? 1 : 2;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const getCurrentStepLabel = (): string => {
    if (step === 1) return "Select Role";
    if (role === "client") return "Project Owner Details";
    return "Professional Details";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 md:px-6 md:py-10">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(130deg,var(--color-onboarding-surface)_0%,color-mix(in_oklab,var(--color-onboarding-primary)_20%,transparent)_38%,transparent_100%)]" />
        <div className="absolute top-32 right-28 h-112 w-md rounded-full bg-onboarding-glow/30 blur-3xl" />
        <div className="absolute bottom-40 left-32 h-104 w-104 rounded-full bg-onboarding-primary/18 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4b5f7f14_1px,transparent_1px),linear-gradient(to_bottom,#4b5f7f14_1px,transparent_1px)] bg-size-[24px_24px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
        <motion.div
          {...variants.fadeIn}
          className="flex flex-col gap-4 rounded-[14px] border border-onboarding-primary/25 bg-onboarding-surface/75 px-4 py-3 shadow-[0_24px_55px_-35px_rgba(13,20,32,0.95)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:px-5"
        >
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap gap-y-2 text-onboarding-ink/75">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/"
                    className="flex min-h-11 items-center gap-1.5 rounded-md px-1 transition-colors hover:text-(--color-onboarding-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) focus-visible:outline-offset-2"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-onboarding-ink/65">
                  Onboarding
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium text-(--color-onboarding-primary)">
                  {getCurrentStepLabel()}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <AlertDialog
            open={showCancelDialog}
            onOpenChange={setShowCancelDialog}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 text-onboarding-ink/75 hover:text-(--color-onboarding-ink) hover:bg-white/[0.07] rounded-xl gap-2"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Cancel Onboarding?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Are you sure you want to cancel the onboarding process? Your
                  progress will not be saved and you&apos;ll be redirected to
                  the homepage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground">
                  Continue Onboarding
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOnboarding}
                  className="bg-(--color-error) text-white hover:opacity-90"
                >
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>

        <motion.div
          {...variants.fadeIn}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            <StepIndicator current={step} stepNumber={1} label="Role" />
            <div
              className={cn(
                "h-px w-12 transition-colors duration-500 sm:w-16",
                step >= 2
                  ? "bg-(--color-onboarding-primary)"
                  : "bg-onboarding-ink/35",
              )}
            />
            <StepIndicator current={step} stepNumber={2} label="Details" />
          </div>

          <h1
            ref={stepHeadingRef}
            tabIndex={-1}
            className="mb-3 font-['Syne'] text-[22px] font-extrabold leading-[1.2] tracking-tight text-(--color-onboarding-ink) md:text-4xl md:leading-[1.08]"
          >
            {step === 1
              ? "Build your legacy."
              : role === "client"
                ? "Tell us about your dream."
                : "Showcase your expertise."}
          </h1>

          <div className="mb-5 w-full max-w-sm px-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-onboarding-ink/45">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span className="font-semibold text-(--color-onboarding-primary)">
                {progressPercent}%
              </span>
            </div>
            <div className="h-0.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full bg-(--color-onboarding-primary)"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
              />
            </div>
          </div>

          <p className="max-w-2xl text-base leading-7 text-onboarding-ink/80 sm:text-lg sm:leading-8">
            {step === 1
              ? "Join Kenya's premier network of homeowners and building professionals."
              : "Complete your profile to get started."}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              {...variants.fadeScale}
              className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2"
            >
              <RoleCard
                icon={<Home size={32} />}
                title="I Am a Project Owner"
                description="I am planning a project and I need verified experts."
                onClick={() => handleRoleSelect("client")}
                delay={prefersReducedMotion ? 0 : 0.1}
                highlight
                prefersReducedMotion={prefersReducedMotion}
                disabled={roleSelectionPending}
                isLoading={roleSelectionPending}
                isSelected={role === "client"}
                helperText="Get matched with reliable professionals for your project."
              />
              <RoleCard
                icon={<Briefcase size={32} />}
                title="I am a Professional"
                description="I am an Architect, Engineer, or Contractor looking for quality leads."
                onClick={() => handleRoleSelect("professional")}
                delay={prefersReducedMotion ? 0 : 0.2}
                prefersReducedMotion={prefersReducedMotion}
                disabled={roleSelectionPending}
                isLoading={roleSelectionPending}
                isSelected={role === "professional"}
                helperText="Build trust with verified credentials and grow your pipeline."
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="col-span-1 md:col-span-2 flex justify-center mt-4"
              >
                <Link
                  href="/"
                  className="group flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-onboarding-ink/70 transition-colors hover:text-(--color-onboarding-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) focus-visible:outline-offset-2"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  Back to Homepage
                </Link>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              {...variants.slideIn}
              className="mx-auto w-full max-w-4xl"
            >
              {role === "client" ? (
                <div className="relative mx-auto max-w-2xl rounded-2xl border border-onboarding-primary/30 bg-onboarding-surface/90 p-1 shadow-[0_32px_64px_-24px_rgba(4,10,18,0.90),0_0_0_1px_oklch(0.70_0.21_162/0.10)] backdrop-blur-xl">
                  <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                      disabled={submitting}
                      className="min-h-11 border-onboarding-primary/35 bg-onboarding-surface/60 text-onboarding-ink/80 hover:bg-onboarding-primary/10 hover:text-(--color-onboarding-ink)"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                  </div>

                  <div className="rounded-xl border border-white/8 bg-onboarding-surface/95 p-4 pt-16 sm:p-6 sm:pt-16 md:p-8 md:pt-16">
                    {submitting && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-(--color-onboarding-primary)" />
                          <span className="font-medium text-(--color-onboarding-primary) animate-pulse">
                            Creating Profile...
                          </span>
                        </div>
                      </div>
                    )}

                    <HomeownerForm
                      onBack={() => setStep(1)}
                      onSubmit={handleSubmit}
                      onAuthSuccess={() => {}}
                      onSkip={() => handleSkip("client")}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <ProfessionalForm
                    onBack={() => setStep(1)}
                    onSubmit={handleSubmit}
                    onAuthSuccess={() => {}}
                  />

                  <div className="mx-auto mt-6 max-w-2xl border-t border-onboarding-primary/25 pt-4">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => handleSkip("professional")}
                      isLoading={submitting}
                      loadingText="Skipping..."
                      className="min-h-11 w-full justify-center text-onboarding-ink/75 hover:text-(--color-onboarding-primary)"
                    >
                      <FastForward className="h-4 w-4 mr-2" />
                      Skip for now - complete profile later
                    </Button>
                    <p className="mt-2 text-center text-xs text-onboarding-ink/60">
                      You can complete your verification from the dashboard
                      anytime
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
