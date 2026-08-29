/**
 * Coerce a value that is *supposed* to be a boolean env flag into an actual
 * boolean, defensively. Some env-loading layers pass raw strings through
 * (e.g. "false") which are truthy in JS and silently flip logic.
 * Never trust `Boolean(x)` for a flag that might be the literal string "false".
 */
export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}
