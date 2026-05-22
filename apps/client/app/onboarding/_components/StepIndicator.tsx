import React from "react";
import { CheckCircle2 } from "lucide-react";
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
  const isActive = current >= stepNumber;
  const isCurrent = current === stepNumber;
  const isComplete = current > stepNumber;

  return (
    // aria-current="step" signals the active step to screen readers (WCAG 2.4.8).
    <div
      className="flex min-w-12 flex-col items-center gap-1.5"
      aria-current={isCurrent ? "step" : undefined}
    >
      {/* Step circle — glow on active via box-shadow */}
      <div
        aria-hidden="true"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full",
          "border-2 text-xs font-bold transition-all duration-500",
          isActive
            ? [
                "border-(--color-onboarding-primary)",
                "bg-(--color-onboarding-primary)",
                "text-[oklch(0.08_0.016_222)]",
                // Emerald glow ring — only when active
                "shadow-[0_0_0_4px_oklch(0.70_0.21_162/0.18),0_0_20px_oklch(0.70_0.21_162/0.25)]",
              ].join(" ")
            : ["border-white/20 bg-white/4", "text-onboarding-ink/35"].join(
                " ",
              ),
        )}
      >
        {isActive ? (
          <CheckCircle2 size={15} strokeWidth={2.5} />
        ) : (
          <span className="font-['Outfit']">{stepNumber}</span>
        )}

        {/* Pulse ring — only on the actively-current step */}
        {isCurrent && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full animate-ping opacity-20 bg-(--color-onboarding-primary)"
            style={{ animationDuration: "2.5s" }}
          />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          // Syne for the step label — consistent with heading font
          "font-['Syne'] text-[9.5px] font-bold uppercase leading-none tracking-[0.12em] transition-colors duration-300",
          isActive
            ? "text-(--color-onboarding-primary)"
            : "text-onboarding-ink/35",
        )}
      >
        {/* Visible label */}
        <span aria-hidden="true">{label}</span>
        {/* Screen-reader-only context */}
        <span className="sr-only">
          {label}
          {isComplete && " (completed)"}
          {isCurrent && " (current step)"}
        </span>
      </span>
    </div>
  );
};
