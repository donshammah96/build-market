"use client";

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
  validate?: () => boolean | Promise<boolean>;
}

export interface OnboardingWizardProps {
  steps: WizardStep[];
  children: React.ReactNode[];
  onComplete: () => void | Promise<void>;
  onStepChange?: (stepIndex: number) => void;
  initialStep?: number;
  storageKey?: string; // For localStorage draft saving
  className?: string;
  showProgress?: boolean;
  allowSkipOptional?: boolean;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for managing wizard draft in localStorage
 */
function useWizardDraft<T>(storageKey: string | undefined, defaultValue: T) {
  const [draft, setDraft] = useState<T>(defaultValue);

  // Load draft on mount
  useEffect(() => {
    if (!storageKey) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setDraft(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load wizard draft:", e);
    }
  }, [storageKey]);

  // Save draft function
  const saveDraft = useCallback(
    (data: T) => {
      setDraft(data);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to save wizard draft:", e);
        }
      }
    },
    [storageKey]
  );

  // Clear draft function
  const clearDraft = useCallback(() => {
    setDraft(defaultValue);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn("Failed to clear wizard draft:", e);
      }
    }
  }, [storageKey, defaultValue]);

  return { draft, saveDraft, clearDraft };
}

// ============================================================================
// STEP INDICATOR COMPONENT
// ============================================================================

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (index: number) => void;
}

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav
      className="flex items-center justify-center gap-2 mb-8"
      aria-label="Wizard progress"
      role="navigation"
    >
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = completedSteps.has(index);
        const isPast = index < currentStep;
        const isClickable = isPast || isCompleted;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                isActive &&
                  "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25",
                isCompleted &&
                  !isActive &&
                  "border-emerald-500 bg-emerald-100 text-emerald-600 cursor-pointer hover:bg-emerald-200",
                !isActive &&
                  !isCompleted &&
                  "border-zinc-200 bg-white text-zinc-400",
                isClickable && !isActive && "cursor-pointer"
              )}
              aria-label={`Step ${index + 1}: ${step.title}${isCompleted ? " (completed)" : ""}${isActive ? " (current)" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              {isCompleted && !isActive ? (
                <Check className="h-5 w-5" aria-hidden="true" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </button>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2 transition-colors duration-300",
                  isPast || isCompleted ? "bg-emerald-500" : "bg-zinc-200"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ============================================================================
// STEP CONTENT CONTAINER
// ============================================================================

interface StepContentProps {
  step: WizardStep;
  isActive: boolean;
  direction: "forward" | "backward";
  children: React.ReactNode;
  prefersReducedMotion: boolean;
}

function StepContent({
  step,
  isActive,
  direction,
  children,
  prefersReducedMotion,
}: StepContentProps) {
  const variants = {
    enter: (direction: "forward" | "backward") => ({
      x: prefersReducedMotion ? 0 : direction === "forward" ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: "forward" | "backward") => ({
      x: prefersReducedMotion ? 0 : direction === "forward" ? -100 : 100,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      key={step.id}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        duration: prefersReducedMotion ? 0.1 : 0.3,
        ease: "easeInOut",
      }}
      role="tabpanel"
      aria-labelledby={`step-${step.id}`}
      aria-hidden={!isActive}
    >
      {/* Step Header */}
      <div className="text-center mb-8">
        {step.icon && (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
            {step.icon}
          </div>
        )}
        <h2 id={`step-${step.id}`} className="text-2xl font-bold text-zinc-900">
          {step.title}
        </h2>
        {step.description && (
          <p className="text-zinc-500 mt-2 max-w-md mx-auto">
            {step.description}
          </p>
        )}
        {step.optional && (
          <span className="inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-500">
            Optional
          </span>
        )}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">{children}</div>
    </motion.div>
  );
}

// ============================================================================
// MAIN WIZARD COMPONENT
// ============================================================================

export function OnboardingWizard({
  steps,
  children,
  onComplete,
  onStepChange,
  initialStep = 0,
  storageKey,
  className,
  showProgress = true,
  allowSkipOptional = true,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reduced motion detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Draft saving
  const { saveDraft, clearDraft } = useWizardDraft(storageKey, {
    currentStep: 0,
  });

  // Save current step to draft when it changes
  useEffect(() => {
    saveDraft({ currentStep });
  }, [currentStep, saveDraft]);

  // Notify parent of step change
  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // Progress percentage
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  // Go to next step
  const goNext = useCallback(async () => {
    const step = steps[currentStep];
    if (!step) return; // Guard against undefined step

    // Validate current step if validator exists
    if (step.validate) {
      setIsValidating(true);
      try {
        const isValid = await step.validate();
        if (!isValid) {
          setIsValidating(false);
          return;
        }
      } catch {
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    // Mark step as completed
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setDirection("forward");

    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final step - complete wizard
      setIsCompleting(true);
      try {
        await onComplete();
        clearDraft();
      } catch (e) {
        console.error("Failed to complete wizard:", e);
      }
      setIsCompleting(false);
    }
  }, [currentStep, steps, onComplete, clearDraft]);

  // Go to previous step
  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection("backward");
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Go to specific step (only if completed or current)
  const goToStep = useCallback(
    (index: number) => {
      if (index < currentStep || completedSteps.has(index)) {
        setDirection(index < currentStep ? "backward" : "forward");
        setCurrentStep(index);
      }
    },
    [currentStep, completedSteps]
  );

  // Skip optional step
  const skipStep = useCallback(() => {
    const step = steps[currentStep];
    if (step?.optional && allowSkipOptional) {
      setDirection("forward");
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [currentStep, steps, allowSkipOptional]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          if (
            e.key === "Enter" &&
            (e.target as HTMLElement).tagName !== "BUTTON"
          ) {
            return; // Don't interfere with form inputs
          }
          if (!isValidating && !isCompleting) {
            goNext();
          }
          break;
        case "ArrowLeft":
          if (currentStep > 0) {
            goBack();
          }
          break;
        case "Escape": {
          const escapeStep = steps[currentStep];
          if (escapeStep?.optional && allowSkipOptional) {
            skipStep();
          }
          break;
        }
      }
    },
    [
      goNext,
      goBack,
      skipStep,
      currentStep,
      steps,
      allowSkipOptional,
      isValidating,
      isCompleting,
    ]
  );

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Guard against undefined step data
  if (!currentStepData) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Profile completion wizard"
    >
      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-6">
          <Progress
            value={progressPercentage}
            className="h-2 bg-zinc-100"
            indicatorClassName="bg-emerald-500 transition-all duration-300"
          />
          <p
            className="text-xs text-zinc-500 mt-2 text-center"
            aria-live="polite"
          >
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      )}

      {/* Step Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      {/* Step Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <StepContent
          key={currentStepData.id}
          step={currentStepData}
          isActive={true}
          direction={direction}
          prefersReducedMotion={prefersReducedMotion}
        >
          {children[currentStep]}
        </StepContent>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100">
        {/* Back Button */}
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={isFirstStep || isValidating || isCompleting}
          className="text-zinc-600 hover:text-zinc-900"
          aria-label="Go to previous step"
        >
          <ChevronLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {/* Skip Button (for optional steps) */}
          {currentStepData.optional && allowSkipOptional && !isLastStep && (
            <Button
              type="button"
              variant="ghost"
              onClick={skipStep}
              disabled={isValidating || isCompleting}
              className="text-zinc-500 hover:text-zinc-700"
            >
              Skip
            </Button>
          )}

          {/* Next/Complete Button */}
          <Button
            type="button"
            onClick={goNext}
            disabled={isValidating || isCompleting}
            className="bg-zinc-900 hover:bg-zinc-800 text-white min-w-[120px]"
            aria-label={isLastStep ? "Complete profile" : "Go to next step"}
          >
            {isValidating || isCompleting ? (
              <>
                <Loader2
                  className="h-4 w-4 mr-2 animate-spin"
                  aria-hidden="true"
                />
                {isValidating ? "Validating..." : "Saving..."}
              </>
            ) : isLastStep ? (
              <>
                Complete
                <Check className="h-4 w-4 ml-2" aria-hidden="true" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {`Currently on step ${currentStep + 1}: ${currentStepData.title}`}
      </div>
    </div>
  );
}

export default OnboardingWizard;
