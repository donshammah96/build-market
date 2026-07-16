/**
 * NOTE: this duplicates the Date/Decimal-safe serialization logic already
 * in the messaging domain's mappers.ts. Worth extracting both into a
 * shared `@/app/lib/api/dto-serialization.ts` in a follow-up so the two
 * domains (and any future one) share a single implementation — not done
 * here to keep this change scoped to the newsletter domain.
 */
type DecimalLike = { toNumber?: () => number; toString?: () => string };

function serializeDto(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDto);
  if (!value || typeof value !== "object") return value;

  const decimal = value as DecimalLike;
  if (typeof decimal.toNumber === "function") return decimal.toNumber();
  if (
    typeof decimal.toString === "function" &&
    value.constructor?.name === "Decimal"
  ) {
    return Number(decimal.toString());
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeDto(nested)]),
  );
}

export function toNewsletterDto<T>(value: T): T {
  return serializeDto(value) as T;
}

/**
 * The route should only ever return the tiny result shapes defined in
 * contracts.ts (e.g. `{ status: "pending_confirmation" }`). This mapper
 * exists as an explicit allow-list boundary so a future change to the
 * repository's select projection can never accidentally leak
 * confirmationTokenHash, unsubscribeTokenHash, or ESP sync internals into
 * a client-facing response by widening what gets spread into a DTO.
 */
export function toPublicSubscribeResult(status: string): { status: string } {
  return { status };
}
