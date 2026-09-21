export type SessionMetadata = {
  role?: string;
  isOnboarded?: boolean;
  /** Mirrors the `status` field synced to Clerk `publicMetadata` by admin
   * suspend/unsuspend actions. Allows middleware to gate access without a
   * database call. */
  status?: string;
};

type SessionClaimsLike = {
  metadata?: unknown;
};

export function parseSessionMetadata(
  sessionClaims: unknown,
): SessionMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return undefined;
  }

  const metadata = (sessionClaims as SessionClaimsLike).metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const metadataRecord = metadata as Record<string, unknown>;

  const roleValue =
    typeof metadataRecord.role === "string" ? metadataRecord.role : undefined;

  const onboardedValue =
    typeof metadataRecord.isOnboarded === "boolean"
      ? metadataRecord.isOnboarded
      : undefined;

  const statusValue =
    typeof metadataRecord.status === "string"
      ? metadataRecord.status
      : undefined;

  return {
    ...(roleValue !== undefined ? { role: roleValue } : {}),
    ...(onboardedValue !== undefined ? { isOnboarded: onboardedValue } : {}),
    ...(statusValue !== undefined ? { status: statusValue } : {}),
  };
}

export function normalizeAdminAccessRole(
  role?: string,
): "admin" | "verification_admin" | undefined {
  if (!role) return undefined;

  const normalized = role.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "verification_admin") return "verification_admin";
  return undefined;
}
