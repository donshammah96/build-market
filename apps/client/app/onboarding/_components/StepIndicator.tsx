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
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2",
          isActive
            ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            : "bg-transparent border-zinc-700 text-zinc-500",
        )}
      >
        {isActive ? <CheckCircle2 size={14} /> : stepNumber}
      </div>
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider",
          isActive ? "text-emerald-400" : "text-zinc-600",
        )}
      >
        {label}
      </span>
    </div>
  );
};
