export function toUploadDto<T>(value: T): T {
  return serializeDto(value) as T;
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}

function serializeDto(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDto);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeDto(nested)]),
  );
}
