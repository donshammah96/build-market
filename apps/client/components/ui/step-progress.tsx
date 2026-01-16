"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface Step {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
  icon?: React.ReactNode;
}

export type StepProgressTheme = "dark" | "light";

export interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
  /** Allow clicking only on completed steps */
  allowClickOnCompleted?: boolean;
  /** Variant for different visual styles */
  variant?: "default" | "minimal" | "dots";
  /** Orientation of the progress indicator */
  orientation?: "horizontal" | "vertical";
  /** Theme variant for dark/light mode */
  theme?: StepProgressTheme;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StepIndicatorProps {
  step: Step;
  index: number;
  currentStep: number;
  isCompleted: boolean;
  isCurrent: boolean;
  onClick?: () => void;
  isClickable: boolean;
  variant: "default" | "minimal" | "dots";
  theme: StepProgressTheme;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  index,
  isCompleted,
  isCurrent,
  onClick,
  isClickable,
  variant,
  theme,
}) => {
  const isDark = theme === "dark";
  const baseClasses =
    "relative flex items-center justify-center rounded-full transition-all duration-300 font-semibold text-sm";

  const sizeClasses = variant === "dots" ? "w-3 h-3" : "w-10 h-10";

  const stateClasses = cn(
    isCompleted &&
      "bg-emerald-500 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/30",
    isCurrent &&
      !isCompleted &&
      (isDark
        ? "bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500 ring-4 ring-emerald-500/20"
        : "bg-emerald-50 text-emerald-600 border-2 border-emerald-500 ring-4 ring-emerald-100"),
    !isCompleted &&
      !isCurrent &&
      (isDark
        ? "bg-zinc-800/50 text-zinc-500 border-2 border-zinc-700"
        : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200")
  );

  const clickableClasses = isClickable
    ? "cursor-pointer hover:scale-110 active:scale-95"
    : "cursor-default";

  return (
    <motion.button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(baseClasses, sizeClasses, stateClasses, clickableClasses)}
      whileHover={isClickable ? { scale: 1.1 } : undefined}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
      aria-current={isCurrent ? "step" : undefined}
      aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
    >
      {variant !== "dots" && (
        <>
          {isCompleted ? (
            <Check className="w-5 h-5" strokeWidth={3} />
          ) : step.icon ? (
            step.icon
          ) : (
            <span>{index + 1}</span>
          )}
        </>
      )}
    </motion.button>
  );
};

interface StepConnectorProps {
  isCompleted: boolean;
  orientation: "horizontal" | "vertical";
  theme: StepProgressTheme;
}

const StepConnector: React.FC<StepConnectorProps> = ({
  isCompleted,
  orientation,
  theme,
}) => {
  const isDark = theme === "dark";
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isHorizontal ? "flex-1 h-0.5 mx-2" : "w-0.5 h-8 my-2 mx-auto"
      )}
    >
      {/* Background track */}
      <div
        className={cn(
          "absolute inset-0",
          isDark ? "bg-zinc-800" : "bg-zinc-200"
        )}
      />

      {/* Animated fill */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-400"
        initial={{ [isHorizontal ? "scaleX" : "scaleY"]: 0 }}
        animate={{
          [isHorizontal ? "scaleX" : "scaleY"]: isCompleted ? 1 : 0,
        }}
        style={{ originX: 0, originY: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StepProgress({
  steps,
  currentStep,
  onStepClick,
  className,
  allowClickOnCompleted = true,
  variant = "default",
  orientation = "horizontal",
  theme = "dark",
}: StepProgressProps) {
  const isHorizontal = orientation === "horizontal";
  const isDark = theme === "dark";

  return (
    <nav
      aria-label="Progress"
      className={cn("w-full", isHorizontal ? "px-4" : "py-4", className)}
    >
      <ol
        className={cn(
          "flex",
          isHorizontal ? "items-center justify-between" : "flex-col items-start"
        )}
      >
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable =
            allowClickOnCompleted && isCompleted && !!onStepClick;

          return (
            <li
              key={step.id}
              className={cn(
                "flex",
                isHorizontal
                  ? "items-center flex-1 last:flex-none"
                  : "flex-col w-full"
              )}
            >
              <div
                className={cn(
                  "flex",
                  isHorizontal
                    ? "flex-col items-center"
                    : "items-center gap-4 w-full"
                )}
              >
                <StepIndicator
                  step={step}
                  index={index}
                  currentStep={currentStep}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  onClick={() => onStepClick?.(index)}
                  isClickable={isClickable}
                  variant={variant}
                  theme={theme}
                />

                {/* Labels - only for non-dots variant */}
                {variant !== "dots" && (
                  <div
                    className={cn(
                      "text-center",
                      isHorizontal ? "mt-2" : "flex-1"
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-medium transition-colors",
                        isCompleted && "text-emerald-400",
                        isCurrent && (isDark ? "text-white" : "text-zinc-900"),
                        !isCompleted && !isCurrent && "text-zinc-500"
                      )}
                    >
                      {step.label}
                      {step.optional && (
                        <span
                          className={
                            isDark ? "text-zinc-600 ml-1" : "text-zinc-400 ml-1"
                          }
                        >
                          (optional)
                        </span>
                      )}
                    </p>
                    {step.description && isHorizontal && (
                      <p
                        className={cn(
                          "text-[10px] mt-0.5 max-w-[100px] mx-auto hidden sm:block",
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        )}
                      >
                        {step.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connector to next step */}
              {index < steps.length - 1 && (
                <StepConnector
                  isCompleted={index < currentStep}
                  orientation={orientation}
                  theme={theme}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================================================
// COMPACT VARIANT - For use in tight spaces
// ============================================================================

export interface CompactStepProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
  /** Theme variant for dark/light mode */
  variant?: StepProgressTheme;
}

export function CompactStepProgress({
  currentStep,
  totalSteps,
  className,
  variant = "dark",
}: CompactStepProgressProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isDark = variant === "dark";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn("text-xs", isDark ? "text-zinc-400" : "text-zinc-500")}
        >
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span
          className={cn(
            "text-xs font-medium",
            isDark ? "text-emerald-400" : "text-emerald-600"
          )}
        >
          {Math.round(progress)}%
        </span>
      </div>
      <div
        className={cn(
          "h-1.5 rounded-full overflow-hidden",
          isDark ? "bg-zinc-800" : "bg-zinc-200"
        )}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// DOT VARIANT - Minimal dots for mobile
// ============================================================================

export interface DotStepProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function DotStepProgress({
  currentStep,
  totalSteps,
  className,
}: DotStepProgressProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <motion.div
            key={index}
            className={cn(
              "rounded-full transition-all duration-300",
              isCurrent && "w-6 h-2 bg-emerald-500",
              isCompleted && !isCurrent && "w-2 h-2 bg-emerald-500/60",
              !isCompleted && !isCurrent && "w-2 h-2 bg-zinc-700"
            )}
            layout
          />
        );
      })}
    </div>
  );
}

export default StepProgress;
