import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";

/** Props for RoleCard component */
interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
  highlight?: boolean;
  prefersReducedMotion?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  isSelected?: boolean;
  isError?: boolean;
  helperText?: string;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  icon,
  title,
  description,
  onClick,
  delay,
  highlight,
  prefersReducedMotion = false,
  disabled = false,
  isLoading = false,
  isSelected = false,
  isError = false,
  helperText,
}) => {
  const helperId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-helper`;

  return (
    <motion.button
      type="button"
      aria-label={`${title}. ${description}`}
      aria-pressed={isSelected ? "true" : "false"}
      aria-invalid={isError ? "true" : undefined}
      aria-describedby={helperText ? helperId : undefined}
      disabled={disabled || isLoading}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: prefersReducedMotion ? 0.1 : 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={
        prefersReducedMotion || disabled || isLoading
          ? undefined
          : {
              y: -4,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      whileTap={
        prefersReducedMotion || disabled || isLoading
          ? undefined
          : { scale: 0.985, transition: { duration: 0.1 } }
      }
      onClick={onClick}
      className={cn(
        // Base geometry and layout
        "group relative flex min-h-60 w-full flex-col justify-between gap-5",
        "rounded-2xl border p-6 text-left sm:p-7",
        "transition-all duration-300 backdrop-blur-xl",
        "focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",

        // State styles
        isError && [
          "border-red-500/40 bg-red-950/10 shadow-[0_0_24px_rgba(239,68,68,0.15)]",
        ],
        !isError &&
          isSelected && [
            "border-emerald-500 bg-emerald-950/20",
            "ring-2 ring-emerald-500/30 shadow-[0_12px_36px_rgba(16,185,129,0.18)]",
          ],
        !isError &&
          !isSelected && [
            "border-zinc-800 bg-zinc-900/80 shadow-[0_8px_30px_rgb(0,0,0,0.35)]",
            "hover:border-zinc-700 hover:bg-zinc-900/95 hover:shadow-[0_12px_40px_rgb(0,0,0,0.5)]",
            highlight && "hover:border-emerald-500/40",
          ],
      )}
    >
      {/* Top accent glow line */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] rounded-t-2xl transition-opacity duration-300",
          isSelected
            ? "opacity-100 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
            : "opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent",
        )}
      />

      {/* Header with Icon & Selection Pill */}
      <div className="flex items-start justify-between gap-4 w-full">
        <div
          className={cn(
            "flex h-13 w-13 items-center justify-center rounded-xl transition-all duration-300",
            isError && "bg-red-500/15 text-red-400",
            isSelected &&
              "bg-emerald-500/20 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.25)]",
            !isError &&
              !isSelected &&
              "bg-zinc-800 text-zinc-300 group-hover:bg-emerald-500/15 group-hover:text-emerald-400",
          )}
        >
          {icon}
        </div>

        {/* Radio-style status indicator */}
        <div
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
            isSelected
              ? "border-emerald-500 bg-emerald-500 text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              : "border-zinc-700 bg-zinc-800/60 group-hover:border-zinc-500 text-transparent",
          )}
        >
          {isSelected && <Check size={14} strokeWidth={3} />}
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-2 w-full">
        <h3
          className={cn(
            "text-lg sm:text-xl font-bold tracking-tight text-white transition-colors duration-200",
            "group-hover:text-emerald-400",
          )}
        >
          {title}
        </h3>

        <p className="text-sm leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors duration-200">
          {description}
        </p>
      </div>

      {/* Helper / status row */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="w-full pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs"
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2 font-medium text-emerald-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading selection...
          </span>
        ) : isError ? (
          <span
            id={helperId}
            className="inline-flex items-center gap-1.5 font-medium text-red-400"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {helperText ?? "This selection is currently unavailable."}
          </span>
        ) : isSelected ? (
          <span
            id={helperId}
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Selected & Ready
          </span>
        ) : helperText ? (
          <span
            id={helperId}
            className="text-zinc-500 group-hover:text-zinc-400 transition-colors flex items-center justify-between w-full"
          >
            <span>{helperText}</span>
            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-emerald-400 shrink-0 ml-2" />
          </span>
        ) : (
          <span className="text-zinc-500 group-hover:text-emerald-400 transition-colors flex items-center justify-end w-full">
            <span>Continue</span>
            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-emerald-400 shrink-0 ml-1" />
          </span>
        )}
      </div>
    </motion.button>
  );
};
