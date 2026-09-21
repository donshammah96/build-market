export type HighRiskAdminAction = {
  actionName: string;
  category:
    | "user-deletion"
    | "role-mutation"
    | "data-export"
    | "payment-processing"
    | "verification-override"
    | "content-moderation";
  maxAgeSeconds: number;
  rateLimitNamespace: string;
};

export const HIGH_RISK_ADMIN_ACTIONS = [
  {
    actionName: "deleteUser",
    category: "user-deletion",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
  {
    actionName: "deleteUsersBulk",
    category: "user-deletion",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
  {
    actionName: "assignUserRole",
    category: "role-mutation",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
  {
    actionName: "exportLeads",
    category: "data-export",
    maxAgeSeconds: 180,
    rateLimitNamespace: "exports",
  },
  {
    actionName: "exportAuditLogs",
    category: "data-export",
    maxAgeSeconds: 180,
    rateLimitNamespace: "exports",
  },
  {
    actionName: "processManualPayout",
    category: "payment-processing",
    maxAgeSeconds: 180,
    rateLimitNamespace: "finance",
  },
  {
    actionName: "verifyEntity",
    category: "verification-override",
    maxAgeSeconds: 180,
    rateLimitNamespace: "verification",
  },
  {
    actionName: "verifyDocument",
    category: "verification-override",
    maxAgeSeconds: 180,
    rateLimitNamespace: "verification",
  },
  {
    actionName: "batchVerifyEntities",
    category: "verification-override",
    maxAgeSeconds: 180,
    rateLimitNamespace: "verification",
  },
  {
    actionName: "batchVerifyDocuments",
    category: "verification-override",
    maxAgeSeconds: 180,
    rateLimitNamespace: "verification",
  },
  {
    actionName: "toggleStoreFeatured",
    category: "content-moderation",
    maxAgeSeconds: 180,
    rateLimitNamespace: "content",
  },
  {
    actionName: "deleteStore",
    category: "content-moderation",
    maxAgeSeconds: 180,
    rateLimitNamespace: "content",
  },
  {
    actionName: "suspendUser",
    category: "role-mutation",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
  {
    actionName: "unsuspendUser",
    category: "role-mutation",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
  {
    actionName: "anonymizeUser",
    category: "user-deletion",
    maxAgeSeconds: 180,
    rateLimitNamespace: "users",
  },
] as const satisfies readonly HighRiskAdminAction[];

export type HighRiskAdminActionName =
  (typeof HIGH_RISK_ADMIN_ACTIONS)[number]["actionName"];

export function getHighRiskAdminAction(
  actionName: string,
): HighRiskAdminAction | undefined {
  return HIGH_RISK_ADMIN_ACTIONS.find(
    (action) => action.actionName === actionName,
  );
}
