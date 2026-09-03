export type AdminMvpCapability =
  | "materials_commerce"
  | "property_transactions"
  | "idea_books"
  | "cpd"
  | "wallets_escrow"
  | "platform_custody";

export function getAdminMvpCapabilityStatus(
  _capability: AdminMvpCapability,
): "dormant" | "live" {
  // Deferred MVP verticals are fail-closed until a reviewed rollout adds a
  // server-owned configuration source shared with the client/worker policy.
  return "dormant";
}

export function requireLiveAdminMvpCapability(
  capability: AdminMvpCapability,
): { ok: true } | { ok: false; code: "MVP_CAPABILITY_DORMANT" } {
  return getAdminMvpCapabilityStatus(capability) === "live"
    ? { ok: true }
    : { ok: false, code: "MVP_CAPABILITY_DORMANT" };
}

export function capabilityForVerificationEntity(
  entityType: string,
): AdminMvpCapability | null {
  if (entityType === "store") return "materials_commerce";
  if (entityType === "property") return "property_transactions";
  return null;
}
