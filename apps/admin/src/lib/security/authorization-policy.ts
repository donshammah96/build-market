export type AdminAccessRole = "admin" | "verification_admin";

export type AdminRoutePolicyKey =
  | "dashboard"
  | "verification"
  | "defaultProtected";

export type AdminActionRisk = "low" | "high";

export type AdminActionPolicy = {
  allowedRoles: readonly AdminAccessRole[];
  risk: AdminActionRisk;
};

export const ADMIN_ROUTE_POLICY_MAP: Record<
  AdminRoutePolicyKey,
  readonly AdminAccessRole[]
> = {
  dashboard: ["admin"],
  verification: ["admin", "verification_admin"],
  defaultProtected: ["admin", "verification_admin"],
};

export const ADMIN_ACTION_POLICY_MAP: Record<string, AdminActionPolicy> = {
  getUsers: { allowedRoles: ["admin"], risk: "low" },
  getUserDetails: { allowedRoles: ["admin"], risk: "low" },
  deleteUser: { allowedRoles: ["admin"], risk: "high" },
  deleteUsersBulk: { allowedRoles: ["admin"], risk: "high" },
  inviteUser: { allowedRoles: ["admin"], risk: "high" },
  resetUserCredentials: { allowedRoles: ["admin"], risk: "high" },
  assignUserRole: { allowedRoles: ["admin"], risk: "high" },
  verifyEntity: {
    allowedRoles: ["admin", "verification_admin"],
    risk: "high",
  },
  verifyDocument: {
    allowedRoles: ["admin", "verification_admin"],
    risk: "high",
  },
  batchVerifyDocuments: {
    allowedRoles: ["admin", "verification_admin"],
    risk: "high",
  },
  batchVerifyEntities: {
    allowedRoles: ["admin", "verification_admin"],
    risk: "high",
  },
  updateStore: { allowedRoles: ["admin"], risk: "high" },
  toggleStoreFeatured: { allowedRoles: ["admin"], risk: "high" },
  verifyStore: { allowedRoles: ["admin", "verification_admin"], risk: "high" },
  rejectStore: { allowedRoles: ["admin", "verification_admin"], risk: "high" },
  deleteStore: { allowedRoles: ["admin"], risk: "high" },
};

const DEFAULT_ADMIN_ACTION_POLICY: AdminActionPolicy = {
  allowedRoles: ["admin"],
  risk: "low",
};

export function getAdminActionPolicy(actionName: string): AdminActionPolicy {
  return ADMIN_ACTION_POLICY_MAP[actionName] ?? DEFAULT_ADMIN_ACTION_POLICY;
}
