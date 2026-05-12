import type { InquiryDetailResult } from "./contracts";

export function toInquiryDto<T>(value: T): T {
  return serializeDto(value) as T;
}

function serializeDto(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDto);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeDto(nested)]),
  );
}

type InquiryDetailRaw = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  preferredViewingDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  property: {
    id: string;
    title: string;
    slug: string;
    price: number | { toNumber?: () => number };
    currency: string;
    type: string;
    category: string;
    location: string;
    status: string;
  };
};

function toIsoString(value: Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNumber(value: number | { toNumber?: () => number }): number {
  if (typeof value === "number") return value;
  return typeof value?.toNumber === "function"
    ? value.toNumber()
    : Number(value);
}

export function toInquiryDetailDto(raw: InquiryDetailRaw): InquiryDetailResult {
  const clientName = raw.sender
    ? `${raw.sender.firstName ?? ""} ${raw.sender.lastName ?? ""}`.trim() ||
      raw.name ||
      "Unknown"
    : raw.name || "Unknown";

  return {
    id: raw.id,
    clientName,
    clientEmail: raw.email ?? raw.sender?.email ?? null,
    clientPhone: raw.phone ?? raw.sender?.phone ?? null,
    message: raw.message,
    status: raw.status,
    notes: raw.notes,
    preferredViewingDate: toIsoString(raw.preferredViewingDate),
    createdAt: toIsoString(raw.createdAt) ?? "",
    updatedAt: toIsoString(raw.updatedAt) ?? "",
    sender: raw.sender,
    property: {
      id: raw.property.id,
      title: raw.property.title,
      slug: raw.property.slug,
      price: toNumber(raw.property.price),
      currency: raw.property.currency,
      type: raw.property.type,
      category: raw.property.category,
      location: raw.property.location,
      status: raw.property.status,
    },
  };
}
