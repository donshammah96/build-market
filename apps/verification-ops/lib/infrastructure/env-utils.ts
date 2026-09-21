/**
 * apps/verification-ops — Environment Variable Helpers
 * =======================================================
 * Small boolean-coercion helper, ported VERBATIM from apps/admin's
 * `lib/infrastructure/env-utils.ts`. Duplicated here for the same reason
 * `env.ts` duplicates the validation engine rather than importing across
 * apps — see the SCOPE NOTE at the top of `env.ts`.
 *
 * Needed because every `process.env` value is a raw string — a var set
 * to the literal string `"false"` is still truthy under a plain
 * `if (value)` check. Any boolean-flag env var (e.g.
 * NEXT_PUBLIC_CLERK_IS_SATELLITE) must be coerced through this rather
 * than checked directly.
 *
 * Signature is intentionally `unknown`, not `string | undefined | null`:
 * apps/admin's `middleware.ts` calls `toBool()` on
 * `adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE`, which by that point is
 * already a real `boolean` (its `env.ts` runs it through a zod
 * `booleanString` transform first) — so `toBool` has to tolerate being
 * handed a boolean it then just passes through, not only a raw string.
 * An earlier version of this file in this app was typed
 * `string | undefined | null` only; if a boolean ever reached it, calling
 * `.trim()` on a boolean would throw. Widened to `unknown` with an
 * explicit boolean pass-through to close that gap and match admin
 * exactly, even though today's `env.ts` in this app happens to always
 * hand it a string before conversion.
 *
 * Truthiness is intentionally narrow: only the literal string `"true"`
 * (case-insensitive, trimmed) is truthy — NOT `"1"` or `"yes"`. This
 * matches admin's zod schema (`z.enum(["true", "false"])`) exactly, so
 * the same env var (e.g. NEXT_PUBLIC_CLERK_IS_SATELLITE, which callers
 * may reasonably expect to behave identically across apps/admin and
 * apps/verification-ops) can't silently mean "true" in one app and
 * "false" in the other for the same raw value.
 */
export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}
