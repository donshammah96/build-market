import { normalizeRole, type AppRole } from "./roles";

export type MiddlewareSessionMetadata = {
  role?: AppRole;
  isOnboarded?: boolean;
};

type ClaimsLike = {
  metadata?: unknown;
};

export function parseMiddlewareSessionMetadata(
  sessionClaims: unknown,
): MiddlewareSessionMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return undefined;
  }

  const metadata = (sessionClaims as ClaimsLike).metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  const role = normalizeRole(record.role);
  const isOnboarded =
    typeof record.isOnboarded === "boolean" ? record.isOnboarded : undefined;

  return { role, isOnboarded };
}
