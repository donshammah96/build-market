import React from "react";

export type RealBadgeType =
  | "FOUNDING_PRO"
  | "FAST_RESPONDER"
  | "RISING_TALENT"
  | "TOP_RATED"
  | "ELITE_PRO";

export interface EarnedBadgeInfo {
  type: RealBadgeType;
  awardedAt?: string | Date;
  metadata?: Record<string, unknown>;
}

export interface BadgeRowProps {
  earnedBadges: (RealBadgeType | EarnedBadgeInfo)[];
  showLocked?: boolean;
  size?: "sm" | "md";
  className?: string;
}

interface BadgeMetadata {
  label: string;
  description: string;
  icon: (color: string) => React.ReactNode;
}

const BADGE_DEFINITIONS: Record<RealBadgeType, BadgeMetadata> = {
  FOUNDING_PRO: {
    label: "Founding Pro",
    description:
      "Inaugural platform partner with lifetime verified privileges.",
    icon: (color) => (
      <svg className="w-4 h-4" fill={color} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
  },
  FAST_RESPONDER: {
    label: "Fast Responder",
    description:
      "Responds to inquiries in under 60 minutes with ≥90% response rate.",
    icon: (color) => (
      <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  RISING_TALENT: {
    label: "Rising Talent",
    description:
      "New standout pro with outstanding initial client feedback (≥4.8★).",
    icon: (color) => (
      <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
  TOP_RATED: {
    label: "Top Rated",
    description:
      "Maintains ≥4.85★ rating across 10+ reviews with zero disputes.",
    icon: (color) => (
      <svg className="w-4 h-4" fill={color} viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  ELITE_PRO: {
    label: "Elite Pro",
    description:
      "Demonstrated tier-4 excellence, comprehensive insurance, and verified track record.",
    icon: (color) => (
      <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
  },
};

const ALL_BADGE_TYPES: RealBadgeType[] = [
  "FOUNDING_PRO",
  "FAST_RESPONDER",
  "RISING_TALENT",
  "TOP_RATED",
  "ELITE_PRO",
];

/**
 * BadgeRow renders earned and locked credibility badges strictly from schema BadgeType enum.
 */
export const BadgeRow: React.FC<BadgeRowProps> = ({
  earnedBadges,
  showLocked = true,
  size = "md",
  className = "",
}) => {
  const earnedSet = new Set<RealBadgeType>();
  earnedBadges.forEach((b) => {
    if (typeof b === "string") {
      earnedSet.add(b);
    } else if (b?.type) {
      earnedSet.add(b.type);
    }
  });

  const badgesToDisplay = showLocked
    ? ALL_BADGE_TYPES
    : ALL_BADGE_TYPES.filter((type) => earnedSet.has(type));

  if (badgesToDisplay.length === 0) {
    return (
      <div className={`text-xs text-neutral-400 italic ${className}`}>
        No active badges yet
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {badgesToDisplay.map((type) => {
        const isEarned = earnedSet.has(type);
        const meta = BADGE_DEFINITIONS[type];
        if (!meta) return null;

        const baseStyles = isEarned
          ? "bg-[#FAF9F5] text-[#16233B] border-[#16233B] shadow-2xs hover:border-[#A8452B]"
          : "bg-neutral-50 text-neutral-400 border-neutral-200 opacity-60";

        const sizeStyles =
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
        const iconColor = isEarned ? "#A8452B" : "#9CA3AF";

        return (
          <div
            key={type}
            className={`inline-flex items-center gap-1.5 rounded border transition-colors cursor-help ${sizeStyles} ${baseStyles}`}
            title={`${meta.label}: ${meta.description} (${isEarned ? "Earned" : "Locked"})`}
            aria-label={`${meta.label} badge: ${isEarned ? "Earned" : "Locked"}`}
          >
            {meta.icon(iconColor)}
            <span className="font-semibold tracking-tight">{meta.label}</span>
            {!isEarned && (
              <span className="text-[9px] uppercase font-mono tracking-wider text-neutral-400">
                [Locked]
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
