import React, { useEffect, useState } from "react";

export interface RenewalStatusProps {
  currentPeriodEnd: string | Date | null;
  gracePeriodEnd?: string | Date | null;
  status?:
    | "ACTIVE"
    | "TRIALING"
    | "GRACE_PERIOD"
    | "PAST_DUE"
    | "EXPIRED"
    | "CANCELED"
    | string;
  totalCycleDays?: number;
  onRenewClick?: () => void;
  className?: string;
}

/**
 * RenewalStatus renders subscription cycle progress and renewal countdown
 * with subtle hairline progress animation and grace-period alerts.
 */
export const RenewalStatus: React.FC<RenewalStatusProps> = ({
  currentPeriodEnd,
  gracePeriodEnd,
  status = "ACTIVE",
  totalCycleDays = 30,
  onRenewClick,
  className = "",
}) => {
  const [animatedPct, setAnimatedPct] = useState(0);

  const now = new Date();
  const endDate = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const isGrace = status === "GRACE_PERIOD";
  const isPastDue = status === "PAST_DUE" || status === "EXPIRED";

  const daysRemaining = endDate
    ? Math.max(
        0,
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const progressPct = endDate
    ? Math.min(
        100,
        Math.max(0, ((totalCycleDays - daysRemaining) / totalCycleDays) * 100),
      )
    : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPct(progressPct);
    }, 50);
    return () => clearTimeout(timer);
  }, [progressPct]);

  const formattedDate = endDate
    ? endDate.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No active cycle";

  return (
    <div
      className={`p-4 rounded-lg border border-[#DFDACB] bg-[#FAF9F5] flex flex-col gap-3 font-sans ${className}`}
      aria-label={`Subscription renewal status: ${daysRemaining} days remaining`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Subscription Cycle
          </span>
          <span className="text-sm font-bold text-[#16233B]">
            {isGrace
              ? "Grace Period Active"
              : isPastDue
                ? "Renewal Past Due"
                : `${daysRemaining} Days Remaining`}
          </span>
        </div>

        {onRenewClick && (
          <button
            type="button"
            onClick={onRenewClick}
            className="text-xs font-semibold text-[#A8452B] hover:text-[#8C3620] underline underline-offset-2 transition-colors cursor-pointer"
          >
            Renew with M-Pesa
          </button>
        )}
      </div>

      {/* Progress Bar with Hairline Framing */}
      <div className="w-full bg-[#EAE6DC] h-2 rounded-full overflow-hidden border border-[#DFDACB] relative">
        <div
          className={`h-full transition-all duration-700 ease-out rounded-full ${
            isGrace || isPastDue
              ? "bg-[#A8452B]"
              : daysRemaining <= 5
                ? "bg-[#D97706]"
                : "bg-[#3F6B4E]"
          }`}
          style={{ width: `${animatedPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
        <span>Renews on: {formattedDate}</span>
        <span>{Math.round(progressPct)}% cycle used</span>
      </div>

      {isGrace && gracePeriodEnd && (
        <div className="text-xs font-medium text-[#A8452B] bg-[#FDF2F0] p-2 rounded border border-[#F5C2BC] mt-1">
          ⚠️ Grace period expires on{" "}
          {new Date(gracePeriodEnd).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
          })}
          . Please complete renewal to maintain lead routing.
        </div>
      )}
    </div>
  );
};
