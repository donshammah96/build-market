export function checkUserRole(
  session: { user?: { role?: string | null } | null } | null | undefined,
  allowedRoles: ReadonlyArray<string>,
): boolean {
  if (!session?.user) return false;
  const role = session.user.role ?? null;
  if (!role) return false;
  return allowedRoles.includes(role);
}
