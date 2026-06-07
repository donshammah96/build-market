import type { UserRole } from "@build/db";

export const ASSIGNABLE_USER_ROLES = [
  "CLIENT",
  "PROFESSIONAL",
  "ADMIN",
] as const satisfies readonly UserRole[];

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export function isAssignableUserRole(role: string): role is AssignableUserRole {
  return ASSIGNABLE_USER_ROLES.includes(role as AssignableUserRole);
}

export function getAssignableUserRolesPromptText(): string {
  return ASSIGNABLE_USER_ROLES.join(" | ");
}
