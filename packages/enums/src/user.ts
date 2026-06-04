/**
 * User domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// UserRole
// -------------------------------------------------------------------------

export const USER_ROLES = ["CLIENT", "PROFESSIONAL", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: "Client (Homeowner)",
  PROFESSIONAL: "Professional / Business",
  ADMIN: "Administrator",
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// UserStatus
// -------------------------------------------------------------------------

export const USER_STATUSES = [
  "ONBOARDING",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DEACTIVATED",
  "ARCHIVED",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ONBOARDING: "Onboarding",
  PENDING_VERIFICATION: "Pending Verification",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
  DEACTIVATED: "Deactivated",
  ARCHIVED: "Archived",
};

export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === "string" &&
    (USER_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ClientType
// -------------------------------------------------------------------------

export const CLIENT_TYPES = [
  "HOMEOWNER",
  "CORPORATE_DEVELOPER",
  "INTERIOR_DESIGN_FIRM",
  "GOVERNMENT_ENTITY",
  "OTHER",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  HOMEOWNER: "Homeowner",
  CORPORATE_DEVELOPER: "Corporate Developer",
  INTERIOR_DESIGN_FIRM: "Interior Design Firm",
  GOVERNMENT_ENTITY: "Government Entity",
  OTHER: "Other",
};

export function isClientType(value: unknown): value is ClientType {
  return (
    typeof value === "string" &&
    (CLIENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AdminRole
// -------------------------------------------------------------------------

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "CONTENT_MODERATOR",
  "SUPPORT_AGENT",
  "FINANCE_MANAGER",
  "AUDITOR",
] as const;

export const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CONTENT_MODERATOR: "CONTENT_MODERATOR",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  AUDITOR: "AUDITOR",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CONTENT_MODERATOR: "Content Moderator",
  SUPPORT_AGENT: "Support Agent",
  FINANCE_MANAGER: "Finance Manager",
  AUDITOR: "Auditor",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  );
}
