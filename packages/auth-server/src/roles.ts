export const APP_ROLES = ["admin", "professional", "client"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function normalizeRole(role: unknown): AppRole | undefined {
  if (typeof role !== "string") return undefined;
  const normalized = role.toLowerCase();
  return APP_ROLES.find((value) => value === normalized);
}
