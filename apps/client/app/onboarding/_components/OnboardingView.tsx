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
import { useProfessionalFunnelTracking } from "@/app/lib/analytics/use-professional-funnel-tracking";
import { PROFESSIONAL_FUNNEL_EVENTS } from "@/app/lib/analytics/professional-funnel-events";
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
  roleLocked?: boolean;
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
  roleLocked = false,
}: OnboardingViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const trackFunnel = useProfessionalFunnelTracking();

  const onSelectRole = (selectedRole: OnboardingRole) => {
    if (selectedRole === "professional") {
      trackFunnel(PROFESSIONAL_FUNNEL_EVENTS.landingCtaClicked, {
        source: "onboarding_role_card",
        role: "professional",
      });
      trackFunnel(PROFESSIONAL_FUNNEL_EVENTS.onboardingStarted, {
        role: "professional",
      });
    }
    handleRoleSelect(selectedRole);
  };

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
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white px-4 py-8 md:px-6 md:py-12">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-125 w-[125%] rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="absolute top-1/3 -left-40 h-125 w-[125%] rounded-full bg-emerald-600/8 blur-[160px]" />
        <div className="absolute -bottom-40 right-10 h-125 w-[125%] rounded-full bg-blue-600/5 blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size[32px_32px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Top Floating Navigation Bar */}
        <motion.div
          {...variants.fadeIn}
          className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-5 py-3.5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
        >
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap gap-y-2 text-zinc-400">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/"
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-emerald-500"
                  >
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-zinc-400 text-sm">
                  Onboarding
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-emerald-400 text-sm">
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
                className="text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl gap-2 h-9 px-3 text-xs font-medium"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-bold text-white">
                  Cancel Onboarding?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  Are you sure you want to cancel the onboarding process? Your
                  progress will not be saved and you&apos;ll be redirected to
                  the homepage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white">
                  Continue Onboarding
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOnboarding}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>

        {/* Hero Step Header */}
        <motion.div
          {...variants.fadeIn}
          className="flex flex-col items-center text-center space-y-4"
        >
          {role !== "professional" && (
            <div className="flex items-center justify-center gap-4 mb-2">
              <StepIndicator
                current={step}
                stepNumber={1}
                label="Choose Role"
              />
              <div
                className={cn(
                  "h-0.5 w-12 sm:w-20 transition-all duration-500 rounded-full",
                  step >= 2
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    : "bg-zinc-800",
                )}
              />
              <StepIndicator
                current={step}
                stepNumber={2}
                label="Profile Details"
              />
            </div>
          )}

          <div className="space-y-2">
            <h1
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-['Syne'] text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight"
            >
              {step === 1
                ? "Build your legacy."
                : role === "client"
                  ? "Tell us about your project."
                  : "Showcase your expertise."}
            </h1>

            <p className="max-w-xl mx-auto text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
              {step === 1
                ? "Join Kenya's premier network of homeowners, architects, and builders."
                : "Complete your profile to unlock custom matches and verified opportunities."}
            </p>
          </div>

          {role !== "professional" && (
            <div className="w-full max-w-xs pt-1">
              <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Step {currentStep} of {totalSteps}
                </span>
                <span className="font-semibold text-emerald-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Dynamic Step View */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              {...variants.fadeScale}
              className="mx-auto w-full max-w-4xl space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RoleCard
                  icon={<Home size={28} />}
                  title="I am a Project Owner"
                  description="I am planning a construction or renovation project and need verified experts."
                  onClick={() => onSelectRole("client")}
                  delay={prefersReducedMotion ? 0 : 0.05}
                  highlight
                  prefersReducedMotion={prefersReducedMotion}
                  disabled={roleSelectionPending}
                  isLoading={roleSelectionPending}
                  isSelected={role === "client"}
                  helperText="Get matched with licensed professionals & vetted contractors"
                />
                <RoleCard
                  icon={<Briefcase size={28} />}
                  title="I am a Professional"
                  description="I am an Architect, Engineer, Contractor, or Supplier looking for quality leads."
                  onClick={() => onSelectRole("professional")}
                  delay={prefersReducedMotion ? 0 : 0.1}
                  prefersReducedMotion={prefersReducedMotion}
                  disabled={roleSelectionPending}
                  isLoading={roleSelectionPending}
                  isSelected={role === "professional"}
                  helperText="Build trust with verified credentials & expand your client pipeline"
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <Link
                  href="/"
                  className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white hover:bg-zinc-900/60 focus-visible:outline-2 focus-visible:outline-emerald-500"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  <span>Return to Homepage</span>
                </Link>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              {...variants.slideIn}
              className="mx-auto w-full max-w-3xl"
            >
              {role === "client" ? (
                <div className="relative rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
                  <div className="mb-6 flex items-center justify-between">
                    {!roleLocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep(1)}
                        disabled={submitting}
                        className="border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-xl"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Change Role
                      </Button>
                    ) : (
                      <div />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      Project Owner
                    </span>
                  </div>

                  {submitting && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-zinc-950/80 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                        <span className="font-semibold text-emerald-400 animate-pulse">
                          Creating Profile...
                        </span>
                      </div>
                    </div>
                  )}

                  <HomeownerForm
                    onBack={() => {
                      if (!roleLocked) setStep(1);
                    }}
                    onSubmit={handleSubmit}
                    onAuthSuccess={() => {}}
                    onSkip={() => handleSkip("client")}
                  />
                </div>
              ) : (
                <div className="relative">
                  <ProfessionalForm
                    onBack={() => {
                      if (!roleLocked) setStep(1);
                    }}
                    onSubmit={handleSubmit}
                    onAuthSuccess={() => {}}
                  />

                  <div className="mx-auto mt-8 max-w-2xl border-t border-zinc-800 pt-6 text-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSkip("professional")}
                      isLoading={submitting}
                      loadingText="Skipping..."
                      className="text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 rounded-xl"
                    >
                      <FastForward className="h-4 w-4 mr-2" />
                      Skip for now — complete profile later
                    </Button>
                    <p className="text-xs text-zinc-500">
                      You can complete your verification details from the
                      professional dashboard anytime
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
