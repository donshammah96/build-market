type DecimalLike = { toNumber?: () => number; toString?: () => string };

export function toFinanceDto<T>(value: T): T {
  return serializeDto(value) as T;
}

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
