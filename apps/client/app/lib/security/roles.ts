export const APP_ROLES = [
  "admin",
  "professional",
  "client",
  "support",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function normalizeRole(input: unknown): AppRole | undefined {
  if (typeof input !== "string") return undefined;
  const normalized = input.trim().toLowerCase();
  if ((APP_ROLES as readonly string[]).includes(normalized)) {
    return normalized as AppRole;
  }
  return undefined;
}
