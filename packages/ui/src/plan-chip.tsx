import React from "react";

export type SubscriptionPlanKey = "FREE" | "GROWTH" | "BUSINESS" | string;
export type SubscriptionStatusType =
  "ACTIVE" | "TRIALING" | "GRACE_PERIOD" | "PAST_DUE" | "EXPIRED" | "CANCELED";

export interface PlanChipProps {
  planKey?: SubscriptionPlanKey | undefined;
  planName?: string | null | undefined;
  status?: SubscriptionStatusType | undefined;
  isFoundingPro?: boolean | undefined;
  size?: "sm" | "md" | undefined;
  showStatus?: boolean | undefined;
  className?: string | undefined;
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  FREE: "Msingi (Free)",
  GROWTH: "Kuza (Growth)",
  BUSINESS: "Bora (Business)",
};

/**
 * PlanChip renders subscription tier pills with status badges and Founding Pro markers.
 */
export const PlanChip: React.FC<PlanChipProps> = ({
  planKey = "FREE",
  planName,
  status = "ACTIVE",
  isFoundingPro = false,
  size = "md",
  showStatus = true,
  className = "",
}) => {
  const normalizedKey = planKey.toUpperCase();
  const displayName = planName || PLAN_DISPLAY_NAMES[normalizedKey] || planKey;

  const isBusiness =
    normalizedKey === "BUSINESS" || normalizedKey.includes("BORA");
  const isGrowth = normalizedKey === "GROWTH" || normalizedKey.includes("KUZA");

  // Plan styling (Blueprint theme)
  const planColorStyles = isBusiness
    ? "bg-[#16233B] text-[#FAF9F5] border-[#16233B]"
    : isGrowth
      ? "bg-[#EAEFF8] text-[#16233B] border-[#CAD5E8]"
      : "bg-[#F5F4F0] text-[#4A4843] border-[#DFDACB]";

  const statusStyles: Record<
    SubscriptionStatusType,
    { label: string; style: string }
  > = {
    ACTIVE: {
      label: "Active",
      style: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
    },
    TRIALING: {
      label: "Trialing",
      style: "bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]",
    },
    GRACE_PERIOD: {
      label: "Grace Period",
      style: "bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]",
    },
    PAST_DUE: {
      label: "Past Due",
      style: "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]",
    },
    EXPIRED: {
      label: "Expired",
      style: "bg-neutral-100 text-neutral-600 border-neutral-200",
    },
    CANCELED: {
      label: "Canceled",
      style: "bg-neutral-100 text-neutral-600 border-neutral-200",
    },
  };

  const currentStatus = statusStyles[status] || {
    label: status,
    style: "bg-neutral-100 text-neutral-600",
  };
  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono select-none ${className}`}
    >
      {/* Plan Name Pill */}
      <span
        className={`inline-flex items-center font-semibold rounded border ${planColorStyles} ${sizeClasses}`}
      >
        {displayName}
      </span>

      {/* Founding Pro Badge */}
      {isFoundingPro && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border bg-[#FFF8E6] text-[#A8452B] border-[#F5D89D]"
          title="Founding Professional (Lifetime Benefit)"
        >
          Founding Pro
        </span>
      )}

      {/* Status Pill */}
      {showStatus && status !== "ACTIVE" && (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded border ${currentStatus.style}`}
        >
          {currentStatus.label}
        </span>
      )}
    </div>
  );
};
