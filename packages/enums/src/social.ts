/**
 * Social and Portfolio domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// IdeaBookCategory
// -------------------------------------------------------------------------

export const IDEA_BOOK_CATEGORIES = [
  "LIVING_ROOM",
  "KITCHEN",
  "BATHROOM",
  "BEDROOM",
  "OUTDOOR_LANDSCAPING",
  "COMMERCIAL_OFFICE",
  "RETAIL_SHOP",
  "WHOLE_HOUSE",
] as const;

export type IdeaBookCategory = (typeof IDEA_BOOK_CATEGORIES)[number];

export const IDEA_BOOK_CATEGORY_LABELS: Record<IdeaBookCategory, string> = {
  LIVING_ROOM: "Living Room",
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  BEDROOM: "Bedroom",
  OUTDOOR_LANDSCAPING: "Outdoor / Landscaping",
  COMMERCIAL_OFFICE: "Commercial Office",
  RETAIL_SHOP: "Retail Shop",
  WHOLE_HOUSE: "Whole House",
};

export function isIdeaBookCategory(value: unknown): value is IdeaBookCategory {
  return (
    typeof value === "string" &&
    (IDEA_BOOK_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// IdeaBookPrivacy
// -------------------------------------------------------------------------

export const IDEA_BOOK_PRIVACIES = [
  "PUBLIC",
  "SHARED_LINK",
  "PRIVATE",
] as const;

export type IdeaBookPrivacy = (typeof IDEA_BOOK_PRIVACIES)[number];

export const IDEA_BOOK_PRIVACY_LABELS: Record<IdeaBookPrivacy, string> = {
  PUBLIC: "Public",
  SHARED_LINK: "Shared Link",
  PRIVATE: "Private",
};

export function isIdeaBookPrivacy(value: unknown): value is IdeaBookPrivacy {
  return (
    typeof value === "string" &&
    (IDEA_BOOK_PRIVACIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PortfolioImageCategory
// -------------------------------------------------------------------------

export const PORTFOLIO_IMAGE_CATEGORIES = [
  "FINISHED_WORK",
  "BEFORE_STATE",
  "WORK_IN_PROGRESS",
  "BLUEPRINT_OR_PLAN",
  "MATERIAL_BOARD",
] as const;

export type PortfolioImageCategory =
  (typeof PORTFOLIO_IMAGE_CATEGORIES)[number];

export const PORTFOLIO_IMAGE_CATEGORY_LABELS: Record<
  PortfolioImageCategory,
  string
> = {
  FINISHED_WORK: "Finished Work",
  BEFORE_STATE: "Before State",
  WORK_IN_PROGRESS: "Work in Progress",
  BLUEPRINT_OR_PLAN: "Blueprint or Plan",
  MATERIAL_BOARD: "Material Board",
};

export function isPortfolioImageCategory(
  value: unknown,
): value is PortfolioImageCategory {
  return (
    typeof value === "string" &&
    (PORTFOLIO_IMAGE_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// CertificateVerificationStatus
// -------------------------------------------------------------------------

export const CERTIFICATE_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type CertificateVerificationStatus =
  (typeof CERTIFICATE_VERIFICATION_STATUSES)[number];

export const CERTIFICATE_VERIFICATION_STATUS_LABELS: Record<
  CertificateVerificationStatus,
  string
> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function isCertificateVerificationStatus(
  value: unknown,
): value is CertificateVerificationStatus {
  return (
    typeof value === "string" &&
    (CERTIFICATE_VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}
