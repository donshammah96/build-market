import React from "react";

export interface SponsoredLabelProps {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * SponsoredLabel enforces the marketplace ranking transparency guardrail.
 * Any boosted placement renders with distinct visual treatment so clients
 * can immediately distinguish paid visibility from organic ranking.
 */
export const SponsoredLabel: React.FC<SponsoredLabelProps> = ({
  label = "Sponsored",
  size = "sm",
  className = "",
}) => {
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] tracking-wider"
      : "px-2.5 py-1 text-xs tracking-wide";

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold uppercase rounded border bg-[#FFF8E8] text-[#8C4600] border-[#F2D18B] shadow-xs select-none ${sizeClasses} ${className}`}
      aria-label="Promoted profile: Sponsored ranking"
      title="This listing is featured through a paid profile boost"
    >
      <svg
        className="w-3 h-3 text-[#A8452B]"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span>{label}</span>
    </span>
  );
};
