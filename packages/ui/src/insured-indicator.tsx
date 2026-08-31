import React from "react";

export interface InsuredIndicatorProps {
  isInsured: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * InsuredIndicator renders professional indemnity/liability insurance status.
 * Stored as a boolean on ProfessionalProfile (not a BadgeType row).
 */
export const InsuredIndicator: React.FC<InsuredIndicatorProps> = ({
  isInsured,
  size = "md",
  className = "",
}) => {
  if (!isInsured) {
    return null;
  }

  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-medium rounded border bg-[#F0F7F4] text-[#28573E] border-[#B9DEC9] select-none ${sizeClasses} ${className}`}
      aria-label="Verified Insurance Coverage Active"
      title="This professional maintains verified liability or professional indemnity insurance"
    >
      <svg
        className="w-3.5 h-3.5 text-[#3F6B4E]"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span className="font-semibold tracking-tight">Insured</span>
    </div>
  );
};
