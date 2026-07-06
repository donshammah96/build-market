import { normalizeRole, type AppRole } from "./roles.js";

export type MiddlewareSessionMetadata = {
  role?: AppRole;
  isOnboarded?: boolean;
  /** Mirrors the `status` field written to Clerk `publicMetadata` by the admin app.
   * Populated during session-claim sync so middleware can gate access without a
   * database round-trip. Typed as `string` to avoid coupling this package to
   * app-layer enums; callers should narrow using `isUserStatus` from `@build/enums`.
   */
  status?: string;
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
  const status = typeof record.status === "string" ? record.status : undefined;

  return { role, isOnboarded, status };
}
