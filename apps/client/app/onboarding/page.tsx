"use client";

import { useMemo } from "react";
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
import { RoleCard } from "./_components/RoleCard";
import { StepIndicator } from "./_components/StepIndicator";
import { useOnboarding } from "./_hooks/useOnboarding";

// ============================================================================
// ANIMATION VARIANTS (Move directly here? Or keep in a constants file?
// For now keeping here as it is view-specific)
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Onboarding() {
  const {
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
  } = useOnboarding();

  const prefersReducedMotion = useReducedMotion();

  // Memoize animation variants
  const variants = useMemo(
    () => createVariants(prefersReducedMotion),
    [prefersReducedMotion],
  );

  // Get the current step label for breadcrumbs
  const getCurrentStepLabel = (): string => {
    if (step === 1) return "Select Role";
    if (role === "client") return "Project Owner Details";
    return "Professional Details";
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-zinc-950 overflow-hidden px-4 py-12">
      {/* --- 1. Architectural Background --- */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* --- Navigation Bar with Breadcrumbs and Cancel --- */}
        <motion.div
          {...variants.fadeIn}
          className="flex items-center justify-between mb-8 px-4"
        >
          {/* Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList className="text-zinc-400">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-zinc-300">
                  Onboarding
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-emerald-400 font-medium">
                  {getCurrentStepLabel()}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Cancel Onboarding Button with Confirmation */}
          <AlertDialog
            open={showCancelDialog}
            onOpenChange={setShowCancelDialog}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
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

        {/* --- 2. Header / Progress --- */}
        <motion.div
          {...variants.fadeIn}
          className="flex flex-col items-center mb-12 text-center"
        >
          <div className="flex items-center gap-3 mb-6">
            <StepIndicator current={step} stepNumber={1} label="Role" />
            <div
              className={cn(
                "w-12 h-0.5 transition-colors duration-500",
                step >= 2 ? "bg-emerald-500" : "bg-zinc-800",
              )}
            />
            <StepIndicator current={step} stepNumber={2} label="Details" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
            {step === 1
              ? "Build your legacy."
              : role === "client"
                ? "Tell us about your dream."
                : "Showcase your expertise."}
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg">
            {step === 1
              ? "Join Kenya's premier network of homeowners and building professionals."
              : "Complete your profile to get started."}
          </p>
        </motion.div>

        {/* --- 3. Content Area --- */}
        <AnimatePresence mode="wait">
          {/* STEP 1: SELECT ROLE */}
          {step === 1 && (
            <motion.div
              key="step1"
              {...variants.fadeScale}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
            >
              <RoleCard
                icon={<Home size={32} />}
                title="I Am a Project Owner"
                description="I am planning a project and I need verified experts."
                onClick={() => handleRoleSelect("client")}
                delay={prefersReducedMotion ? 0 : 0.1}
                prefersReducedMotion={prefersReducedMotion}
              />
              <RoleCard
                icon={<Briefcase size={32} />}
                title="I am a Professional"
                description="I am an Architect, Engineer, or Contractor looking for quality leads."
                onClick={() => handleRoleSelect("professional")}
                delay={prefersReducedMotion ? 0 : 0.2}
                highlight
                prefersReducedMotion={prefersReducedMotion}
              />

              {/* Back to Home Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="col-span-1 md:col-span-2 flex justify-center mt-4"
              >
                <Link
                  href="/"
                  className="text-zinc-500 hover:text-emerald-400 text-sm flex items-center gap-2 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  Back to Homepage
                </Link>
              </motion.div>
            </motion.div>
          )}

          {/* STEP 2: FORMS */}
          {step === 2 && (
            <motion.div
              key="step2"
              {...variants.slideIn}
              className="w-full max-w-4xl mx-auto"
            >
              {role === "client" ? (
                /* Homeowner Form */
                <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-1 rounded-2xl shadow-2xl max-w-2xl mx-auto">
                  <div className="absolute top-4 left-4 z-20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(1)}
                      className="text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                  </div>

                  <div className="bg-white/5 rounded-xl p-8 pt-14 border border-white/5">
                    {/* Loading Overlay */}
                    {submitting && (
                      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                          <span className="text-emerald-500 font-medium animate-pulse">
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
                /* Professional Form */
                <div className="relative">
                  <ProfessionalForm
                    onBack={() => setStep(1)}
                    onSubmit={handleSubmit}
                    onAuthSuccess={() => {}}
                  />

                  {/* Skip option for professionals */}
                  <div className="mt-6 pt-4 border-t border-white/10 max-w-2xl mx-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSkip("professional")}
                      disabled={submitting}
                      className="w-full text-zinc-400 hover:text-white hover:bg-white/5"
                    >
                      <FastForward className="h-4 w-4 mr-2" />
                      Skip for now — complete profile later
                    </Button>
                    <p className="text-xs text-zinc-500 text-center mt-2">
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
