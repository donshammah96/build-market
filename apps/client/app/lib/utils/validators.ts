/**
 * Client-safe validation utilities.
 *
 * Pure functions with no server dependencies. Use for client-side validation
 * before calling server actions. API routes use api-guards.ts for request validation.
 */

/**
 * Type guard: validate that an ID parameter is a non-empty string.
 * Mirrors isValidId from app/lib/api/api-guards.ts for client-side use.
 */
export function isValidId(id: string | undefined): id is string {
  return typeof id === "string" && id.length > 0;
}
