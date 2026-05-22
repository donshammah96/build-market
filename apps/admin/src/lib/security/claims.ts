export type SessionMetadata = {
  role?: string;
  isOnboarded?: boolean;
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

  return {
    role: roleValue,
    isOnboarded: onboardedValue,
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
