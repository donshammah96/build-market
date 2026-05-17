/* global process */

const HIGH_RISK_ADMIN_ACTIONS = [
  ["deleteUser", "user-deletion", 180, "users"],
  ["deleteUsersBulk", "user-deletion", 180, "users"],
  ["assignUserRole", "role-mutation", 180, "users"],
  ["exportLeads", "data-export", 180, "exports"],
  ["exportAuditLogs", "data-export", 180, "exports"],
  ["processManualPayout", "payment-processing", 180, "finance"],
  ["verifyEntity", "verification-override", 180, "verification"],
  ["verifyDocument", "verification-override", 180, "verification"],
  ["batchVerifyEntities", "verification-override", 180, "verification"],
  ["batchVerifyDocuments", "verification-override", 180, "verification"],
  ["toggleStoreFeatured", "content-moderation", 180, "content"],
  ["deleteStore", "content-moderation", 180, "content"],
].map(([actionName, category, maxAgeSeconds, rateLimitNamespace]) => ({
  actionName,
  category,
  maxAgeSeconds,
  rateLimitNamespace,
}));

export { HIGH_RISK_ADMIN_ACTIONS };

if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(HIGH_RISK_ADMIN_ACTIONS, null, 2));
}
