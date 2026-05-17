import { AdminRole } from "@build/db";
import type { AdminActor } from "./admin-actor";

export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

export type AdminAccessRole = "admin" | "verification_admin";

export type AdminRoutePolicyKey =
  | "dashboard"
  | "verification"
  | "defaultProtected";

export type AdminActionRisk = "low" | "high";

export enum AdminCapability {
  MANAGE_USERS = "MANAGE_USERS",
  VIEW_FINANCIALS = "VIEW_FINANCIALS",
  PROCESS_PAYOUTS = "PROCESS_PAYOUTS",
  MANAGE_VERIFICATION = "MANAGE_VERIFICATION",
  EXPORT_DATA = "EXPORT_DATA",
  MANAGE_CONTENT = "MANAGE_CONTENT",
  SYSTEM_ADMIN_ONLY = "SYSTEM_ADMIN_ONLY",
}

export type AdminPolicyErrorCode =
  | "ADMIN_POLICY_DENIED"
  | "ADMIN_POLICY_UNKNOWN_CAPABILITY";

export type AdminPolicyError = {
  code: AdminPolicyErrorCode;
  message: string;
  capability: AdminCapability;
};

export type AdminActionPolicy = {
  allowedRoles: readonly AdminRole[];
  capabilities: readonly AdminCapability[];
  risk: AdminActionRisk;
  recentAuth?: { maxAgeSeconds: number };
  rateLimit?: { namespace: string; limit: number; windowMs: number };
};

export const ADMIN_ROUTE_POLICY_MAP: Record<
  AdminRoutePolicyKey,
  readonly AdminAccessRole[]
> = {
  dashboard: ["admin"],
  verification: ["admin", "verification_admin"],
  defaultProtected: ["admin", "verification_admin"],
};

export const ADMIN_CAPABILITY_ROLE_MAP: Record<
  AdminCapability,
  readonly AdminRole[]
> = {
  [AdminCapability.MANAGE_USERS]: [AdminRole.SUPER_ADMIN],
  [AdminCapability.VIEW_FINANCIALS]: [
    AdminRole.SUPER_ADMIN,
    AdminRole.FINANCE_MANAGER,
    AdminRole.AUDITOR,
  ],
  [AdminCapability.PROCESS_PAYOUTS]: [
    AdminRole.SUPER_ADMIN,
    AdminRole.FINANCE_MANAGER,
  ],
  [AdminCapability.MANAGE_VERIFICATION]: [
    AdminRole.SUPER_ADMIN,
    AdminRole.CONTENT_MODERATOR,
  ],
  [AdminCapability.EXPORT_DATA]: [AdminRole.SUPER_ADMIN, AdminRole.AUDITOR],
  [AdminCapability.MANAGE_CONTENT]: [
    AdminRole.SUPER_ADMIN,
    AdminRole.CONTENT_MODERATOR,
  ],
  [AdminCapability.SYSTEM_ADMIN_ONLY]: [AdminRole.SUPER_ADMIN],
};

const strictMutationPolicy = (
  capability: AdminCapability,
  namespace: string,
): AdminActionPolicy => ({
  allowedRoles: ADMIN_CAPABILITY_ROLE_MAP[capability],
  capabilities: [capability],
  risk: "high",
  recentAuth: { maxAgeSeconds: 180 },
  rateLimit: { namespace, limit: 10, windowMs: 60_000 },
});

export const ADMIN_ACTION_POLICY_MAP = {
  deleteUser: strictMutationPolicy(AdminCapability.MANAGE_USERS, "users"),
  deleteUsersBulk: strictMutationPolicy(AdminCapability.MANAGE_USERS, "users"),
  inviteUser: strictMutationPolicy(AdminCapability.MANAGE_USERS, "users"),
  resetUserCredentials: strictMutationPolicy(
    AdminCapability.MANAGE_USERS,
    "users",
  ),
  assignUserRole: strictMutationPolicy(AdminCapability.MANAGE_USERS, "users"),
  verifyEntity: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  verifyDocument: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  batchVerifyDocuments: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  batchVerifyEntities: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  updateStore: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "content"),
  toggleStoreFeatured: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "content",
  ),
  verifyStore: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  rejectStore: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  deleteStore: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "content"),
  exportLeads: strictMutationPolicy(AdminCapability.EXPORT_DATA, "exports"),
  exportAuditLogs: strictMutationPolicy(AdminCapability.EXPORT_DATA, "exports"),
  onboardingReconcile: strictMutationPolicy(
    AdminCapability.SYSTEM_ADMIN_ONLY,
    "onboarding",
  ),
  onboardingClerkSync: strictMutationPolicy(
    AdminCapability.SYSTEM_ADMIN_ONLY,
    "onboarding",
  ),
  onboardingIdempotencyReconcile: strictMutationPolicy(
    AdminCapability.SYSTEM_ADMIN_ONLY,
    "onboarding",
  ),
} as const satisfies Record<string, AdminActionPolicy>;

const DEFAULT_ADMIN_ACTION_POLICY: AdminActionPolicy = {
  allowedRoles: [
    AdminRole.SUPER_ADMIN,
    AdminRole.CONTENT_MODERATOR,
    AdminRole.SUPPORT_AGENT,
    AdminRole.FINANCE_MANAGER,
    AdminRole.AUDITOR,
  ],
  capabilities: [],
  risk: "low",
};

export function getAdminActionPolicy(actionName: string): AdminActionPolicy {
  const policyMap: Record<string, AdminActionPolicy> = ADMIN_ACTION_POLICY_MAP;
  return policyMap[actionName] ?? DEFAULT_ADMIN_ACTION_POLICY;
}

export function requireAdminCapability(
  actor: AdminActor,
  capability: AdminCapability,
): Result<true, AdminPolicyError> {
  if (actor.adminRole === AdminRole.SUPER_ADMIN) {
    return { success: true, data: true };
  }

  const allowedRoles = ADMIN_CAPABILITY_ROLE_MAP[capability];

  if (!allowedRoles) {
    return {
      success: false,
      error: {
        code: "ADMIN_POLICY_UNKNOWN_CAPABILITY",
        message: "Unknown admin capability",
        capability,
      },
    };
  }

  if (!allowedRoles.includes(actor.adminRole)) {
    return {
      success: false,
      error: {
        code: "ADMIN_POLICY_DENIED",
        message: "Admin capability denied",
        capability,
      },
    };
  }

  return { success: true, data: true };
}
