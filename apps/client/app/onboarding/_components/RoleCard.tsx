import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: prefersReducedMotion ? 0.1 : 0.45,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={
        prefersReducedMotion || disabled || isLoading
          ? undefined
          : {
              y: -6,
              scale: 1.015,
              transition: { duration: 0.22, ease: "easeOut" },
            }
      }
      whileTap={
        prefersReducedMotion || disabled || isLoading
          ? undefined
          : { scale: 0.975, transition: { duration: 0.1 } }
      }
      onClick={onClick}
      className={cn(
        // Base — geometry + layout
        "group relative flex min-h-40 w-full flex-col items-start justify-between gap-4",
        "rounded-2xl border px-4 py-4 text-left md:px-5 md:py-5",
        "transition-all duration-300",
        // Backdrop blur glass surface
        "backdrop-blur-md",
        // Focus ring
        "focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) focus-visible:outline-offset-2",
        // Disabled
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",

        // ── State-driven surface + border ──
        isError && [
          "border-error/50",
          "bg-error/[0.07]",
          "shadow-[0_0_0_1px_oklch(0.65_0.22_25/0.3)]",
        ],
        !isError &&
          isSelected && [
            "border-success/60",
            "bg-success/8",
            "shadow-[0_0_32px_oklch(0.70_0.21_162/0.20),0_0_0_1px_oklch(0.70_0.21_162/0.35)]",
          ],
        !isError &&
          !isSelected &&
          highlight && [
            "border-onboarding-primary/55",
            "bg-onboarding-primary/8",
            "shadow-[0_0_28px_oklch(0.70_0.21_162/0.18),0_0_0_1px_oklch(0.70_0.21_162/0.30)]",
            "hover:border-onboarding-accent/65",
            "hover:bg-onboarding-primary/10",
            "hover:shadow-[0_8px_32px_oklch(0.78_0.18_68/0.18)]",
          ],
        !isError &&
          !isSelected &&
          !highlight && [
            "border-onboarding-accent/35",
            "bg-white/4",
            "hover:border-onboarding-accent/50",
            "hover:bg-white/[0.07]",
            "hover:shadow-[0_8px_32px_oklch(0.78_0.18_68/0.14)]",
          ],
      )}
    >
      {/* ── Top accent line — appears on hover/selected via opacity ── */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 rounded-t-2xl transition-opacity duration-300",
          isSelected
            ? "opacity-100 bg-linear-to-r from-success/0 via-success to-success/0"
            : highlight
              ? "opacity-0 group-hover:opacity-80 bg-linear-to-r from-onboarding-accent/0 via-onboarding-accent to-onboarding-accent/0"
              : "opacity-0 group-hover:opacity-60 bg-linear-to-r from-onboarding-primary/0 via-onboarding-primary to-onboarding-primary/0",
        )}
      />

      {/* ── Icon + text ── */}
      <div className="w-full">
        <div
          className={cn(
            "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
            isError
              ? "bg-error/15 text-error"
              : isSelected
                ? "bg-success/15 text-success"
                : highlight
                  ? "bg-onboarding-primary/15 text-onboarding-primary group-hover:bg-onboarding-primary/22"
                  : "bg-onboarding-accent/15 text-onboarding-accent group-hover:bg-onboarding-accent/22",
          )}
        >
          {icon}
        </div>

        {/* Title — Syne font for personality */}
        <h3
          className={cn(
            "mb-2 font-['Syne'] text-[13px] font-extrabold leading-[1.3] tracking-[0.01em] md:text-[14px]",
            "text-white transition-colors duration-200",
          )}
        >
          {title}
        </h3>

        <p className="text-[10px] leading-normal text-white/60 group-hover:text-white/75 transition-colors duration-200">
          {description}
        </p>
      </div>

      {/* ── Helper / status row ── */}
      <div aria-live="polite" aria-atomic="true" className="w-full min-h-6">
        {isLoading ? (
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-(--color-onboarding-primary)">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading selection...
          </span>
        ) : isError ? (
          <span
            id={helperId}
            className="inline-flex items-center gap-2 text-[10px] font-semibold text-(--color-error)"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {helperText ?? "This selection is currently unavailable."}
          </span>
        ) : isSelected ? (
          <span
            id={helperId}
            className="inline-flex items-center gap-2 text-[10px] font-semibold text-(--color-success)"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {helperText ?? "Selection confirmed."}
          </span>
        ) : helperText ? (
          <span
            id={helperId}
            className="text-[10px] leading-[1.45] text-white/45 group-hover:text-white/60 transition-colors duration-200"
          >
            {helperText}
          </span>
        ) : null}
      </div>
    </motion.button>
  );
};
