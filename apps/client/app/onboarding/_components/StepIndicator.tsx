import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Props for StepIndicator component */
interface StepIndicatorProps {
  current: number;
  stepNumber: number;
  label: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  current,
  stepNumber,
  label,
}) => {
  const isComplete = current > stepNumber;
  const isCurrent = current === stepNumber;

  return (
    // aria-current="step" signals the active step to screen readers (WCAG 2.4.8).
    <div
      className="flex flex-col items-center gap-2"
      aria-current={isCurrent ? "step" : undefined}
    >
      {/* Step circle */}
      <div
        aria-hidden="true"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
          isComplete && [
            "bg-emerald-500 text-zinc-950 font-bold border-2 border-emerald-400",
            "shadow-[0_0_16px_rgba(16,185,129,0.35)]",
          ],
          isCurrent && [
            "bg-zinc-900 text-emerald-400 border-2 border-emerald-500",
            "shadow-[0_0_20px_rgba(16,185,129,0.25),0_0_0_4px_rgba(16,185,129,0.12)]",
          ],
          !isComplete &&
            !isCurrent && [
              "bg-zinc-900/80 text-zinc-500 border border-zinc-800",
            ],
        )}
      >
        {isComplete ? (
          <Check size={16} strokeWidth={3} />
        ) : (
          <span className="font-['Outfit'] text-sm font-semibold">
            {stepNumber}
          </span>
        )}

        {/* Subtle breathing glow ring on the active step */}
        {isCurrent && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-500"
            style={{ animationDuration: "3s" }}
          />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-xs font-medium tracking-wide transition-colors duration-300",
          isCurrent && "text-emerald-400 font-semibold",
          isComplete && "text-zinc-300 font-medium",
          !isComplete && !isCurrent && "text-zinc-500",
        )}
      >
        <span aria-hidden="true">{label}</span>
        <span className="sr-only">
          {label}
          {isComplete && " (completed)"}
          {isCurrent && " (current step)"}
        </span>
      </span>
    </div>
  );
};
