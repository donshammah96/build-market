import type {
  LeadDetailResult,
  LeadListItem,
  PublicLeadCreateResult,
  PublicLeadStatusResult,
} from "./contracts";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const fn = (value as { toNumber?: () => number }).toNumber;
    return typeof fn === "function" ? fn.call(value) : null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toIsoString(value: Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

type LeadRaw = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientId: string | null;
  title: string;
  projectType: string;
  location: string | null;
  county: string | null;
  budget: unknown;
  budgetMin: unknown;
  budgetMax: unknown;
  currency: string;
  status: string;
  priority: string;
  source: string;
  lostReason: string | null;
  followUpDate: Date | null;
  lastContactedAt: Date | null;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toLeadListItemDto(raw: LeadRaw): LeadListItem {
  return {
    id: raw.id,
    clientName: raw.clientName,
    clientEmail: raw.clientEmail,
    clientPhone: raw.clientPhone,
    clientId: raw.clientId,
    title: raw.title,
    projectType: raw.projectType,
    location: raw.location,
    county: raw.county,
    budget: toNumber(raw.budget),
    budgetMin: toNumber(raw.budgetMin),
    budgetMax: toNumber(raw.budgetMax),
    currency: raw.currency,
    status: raw.status,
    priority: raw.priority,
    source: raw.source,
    lostReason: raw.lostReason,
    followUpDate: toIsoString(raw.followUpDate),
    lastContactedAt: toIsoString(raw.lastContactedAt),
    reminderSent: raw.reminderSent,
    createdAt: toIsoString(raw.createdAt) ?? "",
    updatedAt: toIsoString(raw.updatedAt) ?? "",
  };
}

type LeadDetailRaw = LeadRaw & {
  description: string | null;
  notes: string | null;
  wonAt: Date | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatar: string | null;
  } | null;
};

export function toLeadDetailDto(raw: LeadDetailRaw): LeadDetailResult {
  return {
    ...toLeadListItemDto(raw),
    description: raw.description,
    notes: raw.notes,
    wonAt: toIsoString(raw.wonAt),
    client: raw.client,
  };
}

export function toPublicLeadCreateDto(raw: {
  id: string;
  projectType: string;
  status: string;
  createdAt: Date;
}): PublicLeadCreateResult["lead"] {
  return {
    id: raw.id,
    projectType: raw.projectType,
    status: raw.status,
    createdAt: toIsoString(raw.createdAt) ?? "",
  };
}

export function toPublicLeadStatusDto(
  raw: {
    id: string;
    title: string;
    projectType: string;
    location: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    professional: {
      companyName: string | null;
      user: { firstName: string | null; lastName: string | null };
    };
  },
  statusLabel: string,
): PublicLeadStatusResult {
  const professionalName =
    raw.professional.companyName ||
    `${raw.professional.user.firstName ?? ""} ${raw.professional.user.lastName ?? ""}`.trim();
  return {
    id: raw.id,
    title: raw.title,
    projectType: raw.projectType,
    location: raw.location,
    status: raw.status,
    statusLabel,
    professionalName,
    submittedAt: toIsoString(raw.createdAt) ?? "",
    lastUpdated: toIsoString(raw.updatedAt) ?? "",
  };
}
