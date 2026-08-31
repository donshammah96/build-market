import React from "react";

export type TrustTierType =
  | "UNVERIFIED"
  | "ID_VERIFIED"
  | "SKILLS_VERIFIED"
  | "LICENSE_VERIFIED"
  | "ELITE";

export interface TrustSealBadgeProps {
  tier: TrustTierType;
  authority?: string | null | undefined;
  licenseNumber?: string | null | undefined;
  verifiedAt?: string | Date | null | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
}

/**
 * TrustSealBadge implements the "Site Plan" trust visual language.
 *
 * MUST-FIX GUARDRAIL:
 * - Only LICENSE_VERIFIED and ELITE receive the circular engraved seal with arced authority name.
 * - ID_VERIFIED and SKILLS_VERIFIED receive a simple, lightweight checkmark chip (non-regulator).
 * - UNVERIFIED receives plain text ("Not yet verified") with NO stamp shape.
 */
export const TrustSealBadge: React.FC<TrustSealBadgeProps> = ({
  tier,
  authority,
  licenseNumber,
  verifiedAt,
  size = "md",
  className = "",
}) => {
  const formattedDate = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString("en-KE", {
        month: "short",
        year: "numeric",
      })
    : null;

  // 1. UNVERIFIED: Plain text with no stamp shape
  if (tier === "UNVERIFIED" || !tier) {
    return (
      <span
        className={`inline-flex items-center text-xs font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded ${className}`}
        aria-label="Professional status: Not yet verified"
      >
        Not yet verified
      </span>
    );
  }

  // 2. ID_VERIFIED & SKILLS_VERIFIED: Simple checkmark chip (deliberately less formal, no circular seal)
  if (tier === "ID_VERIFIED" || tier === "SKILLS_VERIFIED") {
    const isSkills = tier === "SKILLS_VERIFIED";
    const label = isSkills ? "Skills Verified" : "ID Verified";
    const subtext = isSkills
      ? "Portfolio & references vetted"
      : "National ID / Passport checked";
    const ariaText = `${label} (${subtext})`;

    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs gap-1",
      md: "px-2.5 py-1 text-xs gap-1.5",
      lg: "px-3 py-1.5 text-sm gap-2",
    }[size];

    return (
      <div
        className={`inline-flex items-center font-medium rounded border ${
          isSkills
            ? "bg-[#F4F8F5] text-[#2F523C] border-[#B7D8C0]"
            : "bg-[#F3F5F8] text-[#1E2E4A] border-[#CCD5E2]"
        } ${sizeClasses} ${className}`}
        aria-label={ariaText}
        title={subtext}
      >
        <svg
          className={size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="font-semibold tracking-tight">{label}</span>
      </div>
    );
  }

  // 3. LICENSE_VERIFIED & ELITE: Official circular engraved seal with arced authority name
  const isElite = tier === "ELITE";
  const displayAuthority = (authority || "REGULATOR VERIFIED").toUpperCase();
  const titleText = isElite
    ? `Elite Pro • ${displayAuthority} ${licenseNumber ? `(#${licenseNumber})` : ""} ${formattedDate ? `• Verified ${formattedDate}` : ""}`
    : `Licensed Pro • ${displayAuthority} ${licenseNumber ? `(#${licenseNumber})` : ""} ${formattedDate ? `• Verified ${formattedDate}` : ""}`;

  const ariaLabel = isElite
    ? `Elite Verified Professional, licensed with ${displayAuthority} ${licenseNumber ? `number ${licenseNumber}` : ""}`
    : `Regulator Licensed Professional, verified with ${displayAuthority} ${licenseNumber ? `number ${licenseNumber}` : ""}`;

  const dimensions = {
    sm: {
      width: 56,
      height: 56,
      cx: 28,
      cy: 28,
      r: 24,
      fontSize: 5.5,
      textR: 19,
    },
    md: {
      width: 76,
      height: 76,
      cx: 38,
      cy: 38,
      r: 34,
      fontSize: 7,
      textR: 27,
    },
    lg: {
      width: 96,
      height: 96,
      cx: 48,
      cy: 48,
      r: 44,
      fontSize: 8.5,
      textR: 35,
    },
  }[size];

  const primaryColor = isElite ? "#A8452B" : "#3F6B4E"; // Brick accent for Elite, Survey Green for License
  const secondaryColor = "#16233B"; // Blueprint navy
  const pathId = `seal-arc-${tier}-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label={ariaLabel}
      title={titleText}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="transition-transform duration-200 hover:scale-105"
        role="img"
        aria-hidden="true"
      >
        <defs>
          {/* Circular path for top curved text */}
          <path
            id={pathId}
            d={`M ${dimensions.cx - dimensions.textR} ${dimensions.cy} A ${dimensions.textR} ${dimensions.textR} 0 1 1 ${dimensions.cx + dimensions.textR} ${dimensions.cy}`}
            fill="none"
          />
        </defs>

        {/* Outer Hairline Ring */}
        <circle
          cx={dimensions.cx}
          cy={dimensions.cy}
          r={dimensions.r}
          fill="#FAF9F5"
          stroke={primaryColor}
          strokeWidth={isElite ? "2" : "1.5"}
          strokeDasharray={isElite ? "none" : "none"}
        />

        {/* Inner Decorative Hairline */}
        <circle
          cx={dimensions.cx}
          cy={dimensions.cy}
          r={dimensions.r - 4}
          fill="none"
          stroke={secondaryColor}
          strokeWidth="0.75"
          strokeOpacity="0.4"
        />

        {/* Arced Authority Text */}
        <text
          fontSize={dimensions.fontSize}
          fontWeight="700"
          letterSpacing="0.12em"
          fill={secondaryColor}
          textAnchor="middle"
        >
          <textPath href={`#${pathId}`} startOffset="50%">
            {displayAuthority}
          </textPath>
        </text>

        {/* Center Emblem / Star / Checkmark */}
        <g
          transform={`translate(${dimensions.cx}, ${dimensions.cy + (size === "sm" ? 3 : 5)})`}
        >
          {isElite ? (
            // Elite Crown/Star glyph
            <path
              d="M0 -7 L2 -2 L7 -2 L3 1 L5 6 L0 3 L-5 6 L-3 1 L-7 -2 L-2 -2 Z"
              fill={primaryColor}
            />
          ) : (
            // Official Approved Stamp Shield/Check
            <path
              d="M-4.5 -4 L0 -6 L4.5 -4 L4.5 1 C4.5 4 0 6 0 6 C0 6 -4.5 4 -4.5 1 Z"
              fill="none"
              stroke={primaryColor}
              strokeWidth="1.5"
            />
          )}
        </g>

        {/* Bottom Tier Label Text */}
        <text
          x={dimensions.cx}
          y={dimensions.cy + dimensions.r - (size === "sm" ? 6 : 8)}
          fontSize={dimensions.fontSize - 0.5}
          fontWeight="800"
          letterSpacing="0.08em"
          fill={primaryColor}
          textAnchor="middle"
        >
          {isElite ? "ELITE SEAL" : "LICENSED"}
        </text>
      </svg>

      {/* Accompanying text info when rendered in prominent spots */}
      <div className="flex flex-col text-left leading-tight">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: primaryColor }}
        >
          {isElite ? "Elite Professional" : "Regulator Licensed"}
        </span>
        <span className="text-[11px] font-medium text-neutral-600 truncate max-w-[200px]">
          {displayAuthority} {licenseNumber ? `• #${licenseNumber}` : ""}
        </span>
      </div>
    </div>
  );
};
