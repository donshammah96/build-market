"use client";

import { useEffect, useState } from "react";
import { formatRetryAfterMessage } from "@/app/lib/auth/remediation-helpers";

interface RetryAfterBannerProps {
  initialSeconds: number;
  onTimerExpire?: () => void;
  message?: string;
  className?: string;
}

export function RetryAfterBanner({
  initialSeconds,
  onTimerExpire,
  message,
  className = "",
}: RetryAfterBannerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(1, Math.ceil(initialSeconds)),
  );

  useEffect(() => {
    setRemainingSeconds(Math.max(1, Math.ceil(initialSeconds)));
  }, [initialSeconds]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (onTimerExpire) {
        onTimerExpire();
      }
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onTimerExpire) {
            onTimerExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, onTimerExpire]);

  if (remainingSeconds <= 0) {
    return null;
  }

  const displayText = message ?? formatRetryAfterMessage(remainingSeconds);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-md bg-amber-50 p-4 border border-amber-200 text-amber-900 text-sm flex items-center gap-3 ${className}`}
    >
      <svg
        className="w-5 h-5 text-amber-600 shrink-0 animate-pulse"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="flex-1 font-medium">{displayText}</div>
    </div>
  );
}
