import { z } from "zod";

// -------------------------------------------------------------------------
// UserRole
// -------------------------------------------------------------------------

export const USER_ROLES = ["CLIENT", "PROFESSIONAL", "ADMIN"] as const;

export const UserRole = {
  CLIENT: "CLIENT",
  PROFESSIONAL: "PROFESSIONAL",
  ADMIN: "ADMIN",
} as const;

export type UserRole = (typeof USER_ROLES)[number];

export const UserRoleSchema = z.enum(USER_ROLES);

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: "Client",
  PROFESSIONAL: "Professional",
  ADMIN: "Admin",
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
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

export const ClientType = {
  HOMEOWNER: "HOMEOWNER",
  CORPORATE_DEVELOPER: "CORPORATE_DEVELOPER",
  INTERIOR_DESIGN_FIRM: "INTERIOR_DESIGN_FIRM",
  GOVERNMENT_ENTITY: "GOVERNMENT_ENTITY",
  OTHER: "OTHER",
} as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const ClientTypeSchema = z.enum(CLIENT_TYPES);

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

export const UserStatus = {
  ONBOARDING: "ONBOARDING",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
  DEACTIVATED: "DEACTIVATED",
  ARCHIVED: "ARCHIVED",
} as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const UserStatusSchema = z.enum(USER_STATUSES);

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
// AdminRole
// -------------------------------------------------------------------------

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "OPS_ADMIN",
  "VERIFICATION_ADMIN",
  "CONTENT_MODERATOR",
  "SUPPORT_AGENT",
  "FINANCE_MANAGER",
  "AUDITOR",
] as const;

export const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OPS_ADMIN: "OPS_ADMIN",
  VERIFICATION_ADMIN: "VERIFICATION_ADMIN",
  CONTENT_MODERATOR: "CONTENT_MODERATOR",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  AUDITOR: "AUDITOR",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_ADMIN: "Operations Admin",
  VERIFICATION_ADMIN: "Verification Admin",
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
