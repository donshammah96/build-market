export function createAdminIdempotencyKey(
  action: string,
  target?: string,
): string {
  const nonce =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return [action, target ?? "global", nonce].join(":");
}
