"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import HomeownerForm from "@/components/forms/HomeownerForm";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import {
  Home,
  Briefcase,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  X,
  ChevronRight,
  FastForward,
} from "lucide-react";
import { OnboardingData } from "@build/types";
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
import { API_ROUTES, ROUTES } from "@/lib/links";

// ============================================================================
// TYPES
// ============================================================================

/** Clerk public metadata structure for onboarded users */
interface ClerkPublicMetadata {
  isOnboarded?: boolean;
  role?: "client" | "professional";
  profileId?: string;
}

/** User roles available during onboarding */
type UserRole = "client" | "professional";

/** Props for StepIndicator component */
interface StepIndicatorProps {
  current: number;
  stepNumber: number;
  label: string;
}

/** Props for RoleCard component */
interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
  highlight?: boolean;
  prefersReducedMotion?: boolean;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to detect reduced motion preference
 * Returns true if user prefers reduced motion (accessibility)
 */
function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// ANIMATION VARIANTS (with reduced motion support)
// ============================================================================

const createVariants = (
  prefersReducedMotion: boolean
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
// CONSTANTS
// ============================================================================

const MAX_METADATA_RETRIES = 5;
const METADATA_RETRY_DELAY = 300; // 300ms between retries

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Onboarding() {
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Memoize animation variants based on reduced motion preference
  const variants = useMemo(
    () => createVariants(prefersReducedMotion),
    [prefersReducedMotion]
  );

  // Redirect if user is already onboarded (check Clerk metadata)
  useEffect(() => {
    if (!userLoaded || !user) return;

    const metadata = user.publicMetadata as ClerkPublicMetadata;

    if (metadata?.isOnboarded) {
      const dashboardPath =
        metadata.role === "professional"
          ? ROUTES.professionalDashboard
          : ROUTES.userDashboard;
      router.replace(dashboardPath);
    }
  }, [userLoaded, user, router]);

  /**
   * Wait for Clerk metadata to propagate after onboarding
   * Uses exponential backoff with user.reload() to refresh session
   */
  const waitForMetadataPropagation = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    for (let attempt = 0; attempt < MAX_METADATA_RETRIES; attempt++) {
      try {
        // Reload user to get fresh metadata from Clerk
        await user.reload();

        const metadata = user.publicMetadata as ClerkPublicMetadata;

        if (metadata?.isOnboarded) {
          return true;
        }

        // Wait with exponential backoff before next attempt
        if (attempt < MAX_METADATA_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, METADATA_RETRY_DELAY * Math.pow(1.5, attempt))
          );
        }
      } catch (error) {
        console.error("Error reloading user:", error);
      }
    }

    return false;
  }, [user]);

  /**
   * Navigate to dashboard after successful onboarding
   * Uses router.push for SPA navigation, with fallback to hard nav if needed
   */
  const navigateToDashboard = useCallback(
    async (targetRole: UserRole) => {
      const dashboardPath =
        targetRole === "professional"
          ? ROUTES.professionalDashboard
          : ROUTES.userDashboard;

      // Wait for metadata to propagate
      const metadataReady = await waitForMetadataPropagation();

      if (metadataReady) {
        // Metadata is ready, use SPA navigation
        router.push(dashboardPath);
      } else {
        // Fallback: metadata didn't propagate in time
        // Use router.refresh() to get new session, then navigate
        router.refresh();
        router.push(dashboardPath);
      }
    },
    [router, waitForMetadataPropagation]
  );

  // Handle cancel onboarding - sign out and redirect to homepage
  const handleCancelOnboarding = async () => {
    toast.info("Onboarding cancelled. Signing out and returning to homepage.");
    await signOut({ redirectUrl: "/" });
  };

  // Handle skip onboarding for homeowners - creates minimal profile and goes to dashboard
  const handleSkipOnboarding = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.onboardingSkip, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to skip onboarding");
      }

      toast.info("Welcome! Redirecting to your dashboard...");
      await navigateToDashboard("client");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  };

  // Handle skip for professionals - creates minimal professional profile
  const handleSkipProfessionalOnboarding = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.onboardingSkipProfessional, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to skip onboarding");
      }

      toast.info("Welcome! Redirecting to your professional dashboard...");
      await navigateToDashboard("professional");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create minimal profile. Please complete the full form."
      );
      setSubmitting(false);
    }
  };

  // Get the current step label for breadcrumbs
  const getCurrentStepLabel = (): string => {
    if (step === 1) return "Select Role";
    if (role === "client") return "Project Owner Details";
    return "Professional Details";
  };

  const handleRoleSelect = (selectedRole: UserRole): void => {
    setRole(selectedRole);
    setStep(2);
  };

  const handleHomeownerSubmit = async (data: OnboardingData) => {
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.onboarding, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user?.id, ...data }),
      });

      if (!response.ok) throw new Error("Failed to complete onboarding");

      toast.success("Welcome home! Redirecting to your dashboard...");
      await navigateToDashboard("client");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleProfessionalSubmit = async (data: OnboardingData) => {
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.onboarding, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user?.id, ...data }),
      });

      if (!response.ok)
        throw new Error("Failed to create professional profile");

      // If store data was collected, create the store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storeData = (data as any).storeData;
      if (storeData) {
        try {
          const storeResponse = await fetch(API_ROUTES.stores, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(storeData),
          });

          if (!storeResponse.ok) {
            console.error(
              "Failed to create store, but professional profile was created"
            );
          }
        } catch (storeError) {
          console.error("Store creation error:", storeError);
        }
      }

      toast.success("Professional account verified! Redirecting...");
      await navigateToDashboard("professional");
    } catch {
      toast.error("Could not verify profile. Please try again.");
      setSubmitting(false);
    }
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
                step >= 2 ? "bg-emerald-500" : "bg-zinc-800"
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
                /* Homeowner Form - Keep existing wrapper */
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
                      onSubmit={handleHomeownerSubmit}
                      onAuthSuccess={() => {}}
                      onSkip={handleSkipOnboarding}
                    />
                  </div>
                </div>
              ) : (
                /* Professional Form - Multi-step wizard handles its own UI */
                <div className="relative">
                  <ProfessionalForm
                    onBack={() => setStep(1)}
                    onSubmit={handleProfessionalSubmit}
                    onAuthSuccess={() => {}}
                  />

                  {/* Skip option for professionals - shown below the wizard */}
                  <div className="mt-6 pt-4 border-t border-white/10 max-w-2xl mx-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleSkipProfessionalOnboarding}
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

// --- Helper Components ---

const StepIndicator: React.FC<StepIndicatorProps> = ({
  current,
  stepNumber,
  label,
}) => {
  const isActive = current >= stepNumber;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2",
          isActive
            ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            : "bg-transparent border-zinc-700 text-zinc-500"
        )}
      >
        {isActive ? <CheckCircle2 size={14} /> : stepNumber}
      </div>
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider",
          isActive ? "text-emerald-400" : "text-zinc-600"
        )}
      >
        {label}
      </span>
    </div>
  );
};

const RoleCard: React.FC<RoleCardProps> = ({
  icon,
  title,
  description,
  onClick,
  delay,
  highlight,
  prefersReducedMotion = false,
}) => (
  <motion.button
    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: prefersReducedMotion ? 0.1 : 0.5 }}
    whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.02 }}
    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start text-left p-8 rounded-2xl transition-all duration-300 border",
      "bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-800/60",
      highlight
        ? "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]"
        : "border-white/10 hover:border-white/20 hover:shadow-xl"
    )}
  >
    <div
      className={cn(
        "mb-6 p-4 rounded-xl transition-colors duration-300",
        highlight
          ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
          : "bg-white/5 text-zinc-400 group-hover:bg-white group-hover:text-zinc-900"
      )}
    >
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
      {title}
    </h3>
    <p className="text-zinc-400 text-sm leading-relaxed group-hover:text-zinc-300">
      {description}
    </p>
  </motion.button>
);
