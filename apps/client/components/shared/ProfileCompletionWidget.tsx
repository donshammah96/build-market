"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleAlert,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "profile-completion-widget-dismissed",
] as const;

// ============================================================================
// TYPES
// ============================================================================

interface ProfileCompletionWidgetProps {
  /** Completion percentage (0-100) */
  percentage: number;
  /** Whether the profile is complete */
  isComplete: boolean;
  /** List of missing required fields */
  missingItems?: string[];
  /** Optional custom class */
  className?: string;
}

// ============================================================================
// STORAGE KEY
// ============================================================================

const WIDGET_STORAGE_KEY = "profile-completion-widget-state";

type WidgetState = "expanded" | "minimized" | "dismissed";

// ============================================================================
// CIRCULAR PROGRESS COMPONENT
// ============================================================================

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function CircularProgress({
  percentage,
  size = 48,
  strokeWidth = 4,
  className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = () => {
    if (percentage >= 80) return "var(--color-success)";
    if (percentage >= 50) return "var(--color-warning)";
    return "var(--color-error)";
  };

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-foreground">{percentage}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN WIDGET COMPONENT
// ============================================================================

export function ProfileCompletionWidget({
  percentage,
  isComplete,
  missingItems = [],
  className,
}: ProfileCompletionWidgetProps) {
  const [state, setState] = useState<WidgetState>("expanded");
  const [isHovered, setIsHovered] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive profile widget UI state.
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            state: WidgetState;
            dismissedAt?: string;
          };

          // If dismissed, check if it's been more than 24 hours
          if (parsed.state === "dismissed" && parsed.dismissedAt) {
            const dismissedTime = new Date(parsed.dismissedAt).getTime();
            const now = Date.now();
            const hoursSinceDismissed =
              (now - dismissedTime) / (1000 * 60 * 60);

            // Re-show after 24 hours
            if (hoursSinceDismissed > 24) {
              setState("minimized");
            } else {
              setState("dismissed");
            }
          } else {
            setState(parsed.state);
          }
        } catch {
          // Invalid saved data
        }
      }
    }
  }, []);

  // Save state to localStorage
  const saveState = useCallback((newState: WidgetState) => {
    setState(newState);
    if (typeof window !== "undefined") {
      // SECURITY_PERSISTENCE_ALLOWLIST: Persists non-sensitive profile widget UI state.
      localStorage.setItem(
        WIDGET_STORAGE_KEY,
        JSON.stringify({
          state: newState,
          dismissedAt:
            newState === "dismissed" ? new Date().toISOString() : undefined,
        }),
      );
    }
  }, []);

  // Enable pulse animation when percentage is below 50
  useEffect(() => {
    setShouldPulse(percentage < 50 && state === "minimized");
  }, [percentage, state]);

  // Don't render if profile is complete
  if (isComplete) {
    return null;
  }

  // Don't render if dismissed (temporarily)
  if (state === "dismissed") {
    return null;
  }

  const completeProfileRoute = "/professional-portal/settings/complete-profile";

  return (
    <AnimatePresence mode="wait">
      {state === "minimized" ? (
        // Minimized state - just the circular progress
        <motion.div
          key="minimized"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn("fixed bottom-6 right-6 z-50", className)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <motion.div
            animate={shouldPulse && !isHovered ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Link
              href={completeProfileRoute}
              className={cn(
                "block p-3 bg-card rounded-full shadow-lg border border-border",
                "hover:shadow-xl hover:border-primary/40 transition-all duration-200",
                "group relative",
              )}
            >
              <CircularProgress
                percentage={percentage}
                size={40}
                strokeWidth={3}
              />

              {/* Expand button on hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveState("expanded");
                    }}
                    className="absolute -top-2 -left-2 min-h-11 min-w-11 p-2 bg-foreground rounded-full text-background hover:bg-foreground/90 transition-colors"
                    aria-label="Expand widget"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </motion.button>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        // Expanded state - full card
        <motion.div
          key="expanded"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={cn("fixed bottom-6 right-6 z-50 w-80", className)}
        >
          <div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <CircularProgress
                  percentage={percentage}
                  size={44}
                  strokeWidth={3}
                />
                <div>
                  <h4 className="font-semibold text-foreground text-sm">
                    Complete Your Profile
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {percentage < 50
                      ? "Get started to unlock features"
                      : percentage < 80
                        ? "You're making progress!"
                        : "Almost there!"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => saveState("minimized")}
                  className="min-h-11 min-w-11 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  aria-label="Minimize widget"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => saveState("dismissed")}
                  className="min-h-11 min-w-11 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  aria-label="Dismiss widget"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Missing items */}
            {missingItems.length > 0 && (
              <div className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Missing information
                </p>
                <ul className="space-y-1.5">
                  {missingItems.slice(0, 3).map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <CircleAlert className="h-3.5 w-3.5 text-warning shrink-0" />
                      <span className="truncate">{item}</span>
                    </li>
                  ))}
                  {missingItems.length > 3 && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-3.5" />
                      <span>+{missingItems.length - 3} more fields</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="p-4 pt-0">
              <Link
                href={completeProfileRoute}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg",
                  "bg-primary text-primary-foreground font-medium text-sm",
                  "hover:bg-primary/90 transition-colors group",
                )}
              >
                Complete Profile
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Completion indicator */}
            {percentage >= 80 && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Just a few more details to go!</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ProfileCompletionWidget;
