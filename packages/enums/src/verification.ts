/**
 * Verification domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// VerificationStatus
// -------------------------------------------------------------------------

export const VERIFICATION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  IN_REVIEW: "In Review",
  VERIFIED: "Verified",
  NEEDS_CORRECTION: "Needs Correction",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

export function isVerificationStatus(
  value: unknown,
): value is VerificationStatus {
  return (
    typeof value === "string" &&
    (VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AvailabilityStatus
// -------------------------------------------------------------------------

export const AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "BUSY",
  "UNAVAILABLE",
] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  UNAVAILABLE: "Unavailable",
};

export function isAvailabilityStatus(
  value: unknown,
): value is AvailabilityStatus {
  return (
    typeof value === "string" &&
    (AVAILABILITY_STATUSES as readonly string[]).includes(value)
  );
}
