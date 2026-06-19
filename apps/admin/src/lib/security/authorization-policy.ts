import { AdminRole } from "@build/enums";
import type { AdminActor } from "./admin-actor";
import { err, ok, type Result } from "@/lib/result";

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
  VIEW_CONTENT = "VIEW_CONTENT",
  MANAGE_CONTENT = "MANAGE_CONTENT",
  SYSTEM_ADMIN_ONLY = "SYSTEM_ADMIN_ONLY",
}

export type AdminPolicyErrorCode =
  | "ADMIN_POLICY_DENIED"
  | "ADMIN_POLICY_UNKNOWN_CAPABILITY";

export type AdminPolicyError = {
  error: AdminPolicyErrorCode;
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
  [AdminCapability.VIEW_CONTENT]: [
    AdminRole.SUPER_ADMIN,
    AdminRole.CONTENT_MODERATOR,
    AdminRole.SUPPORT_AGENT,
  ],
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

const lowRiskReadPolicy = (capability: AdminCapability): AdminActionPolicy => ({
  allowedRoles: ADMIN_CAPABILITY_ROLE_MAP[capability],
  capabilities: [capability],
  risk: "low",
});

export const ADMIN_ACTION_POLICY_MAP = {
  // ---- Stores (v2 / snake_case) ----
  list_stores: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_store_detail: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_store_stats: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  update_store: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "content"),
  toggle_store_featured: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "content",
  ),
  verify_store: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  reject_store: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  delete_store: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "content"),

  // ---- Properties (v2 / snake_case) ----
  list_properties: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_property_detail: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_property_stats: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  update_property: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "content",
  ),
  toggle_property_featured: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "content",
  ),
  verify_property: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  reject_property: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  change_property_status: strictMutationPolicy(
    AdminCapability.MANAGE_VERIFICATION,
    "verification",
  ),
  delete_property: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "content",
  ),

  // ---- Finance & Analytics (v2 / snake_case) ----
  get_analytics: lowRiskReadPolicy(AdminCapability.VIEW_FINANCIALS),
  get_metric_timeseries: lowRiskReadPolicy(AdminCapability.VIEW_FINANCIALS),
  get_geo_distribution: lowRiskReadPolicy(AdminCapability.VIEW_FINANCIALS),
  get_top_professionals: lowRiskReadPolicy(AdminCapability.VIEW_FINANCIALS),

  // ---- Leads (v2 / snake_case) ----
  list_leads: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_lead_detail: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_lead_stats: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  update_lead: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "leads"),
  delete_lead: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "leads"),
  bulk_update_lead_status: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "leads",
  ),
  export_leads: strictMutationPolicy(AdminCapability.EXPORT_DATA, "exports"),

  // ---- Services (v2 / snake_case) ----
  list_services: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_service_detail: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_service_stats: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  create_service: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "services",
  ),
  update_service: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "services",
  ),
  toggle_service_active: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "services",
  ),
  delete_service: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "services",
  ),
  reorder_services: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "services",
  ),

  // ---- Professionals (v2 / snake_case) ----
  list_professionals: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  get_professional_detail: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  update_professional: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "professionals",
  ),
  delete_certificate: strictMutationPolicy(
    AdminCapability.MANAGE_CONTENT,
    "professionals",
  ),
  verify_professional: {
    allowedRoles:
      ADMIN_CAPABILITY_ROLE_MAP[AdminCapability.MANAGE_VERIFICATION],
    capabilities: [AdminCapability.MANAGE_VERIFICATION],
    risk: "high",
    recentAuth: { maxAgeSeconds: 300 },
    rateLimit: { namespace: "verification", limit: 10, windowMs: 60_000 },
  },
  reject_professional: {
    allowedRoles:
      ADMIN_CAPABILITY_ROLE_MAP[AdminCapability.MANAGE_VERIFICATION],
    capabilities: [AdminCapability.MANAGE_VERIFICATION],
    risk: "high",
    recentAuth: { maxAgeSeconds: 300 },
    rateLimit: { namespace: "verification", limit: 10, windowMs: 60_000 },
  },

  // ---- Compliance (v2 / snake_case) ----
  get_compliance_queue_status: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),

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
    return ok(true);
  }

  const allowedRoles = ADMIN_CAPABILITY_ROLE_MAP[capability];

  if (!allowedRoles) {
    return err({
      error: "ADMIN_POLICY_UNKNOWN_CAPABILITY",
      message: "Unknown admin capability",
      capability,
    });
  }

  if (!allowedRoles.includes(actor.adminRole)) {
    return err({
      error: "ADMIN_POLICY_DENIED",
      message: "Admin capability denied",
      capability,
    });
  }

  return ok(true);
}
