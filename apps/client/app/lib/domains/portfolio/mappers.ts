import type {
  PortfolioDetailDto,
  PortfolioImageDto,
  PortfolioListItemDto,
} from "./contracts";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toIsoString(value: Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapImage(raw: {
  id: string;
  caption: string | null;
  category: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: Date;
  asset?: {
    id?: string;
    cdnUrl?: string | null;
    thumbnailUrl?: string | null;
  } | null;
}): PortfolioImageDto {
  const asset = raw.asset ?? {};
  const url =
    typeof asset.cdnUrl === "string"
      ? asset.cdnUrl
      : typeof asset.thumbnailUrl === "string"
        ? asset.thumbnailUrl
        : "/placeholder.svg";
  const category = raw.category ?? "";
  return {
    id: raw.id,
    url,
    key: typeof asset.id === "string" ? asset.id : null,
    caption: raw.caption,
    isMain: raw.isMain,
    isBefore: category === "BEFORE",
    isAfter: category === "AFTER",
    sortOrder: raw.sortOrder,
    createdAt: toIsoString(raw.createdAt) ?? "",
  };
}

type PortfolioListRaw = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  projectType: string;
  tags: string[];
  location: string | null;
  county: string | null;
  budget: unknown;
  currency: string | null;
  completionDate: Date | null;
  clientTestimonial: string | null;
  clientName: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  images?: Array<{
    id: string;
    caption: string | null;
    category: string | null;
    isMain: boolean;
    sortOrder: number;
    createdAt: Date;
    asset?: {
      id?: string;
      cdnUrl?: string | null;
      thumbnailUrl?: string | null;
    } | null;
  }>;
  _count: { images: number };
};

export function toPortfolioListItemDto(
  raw: PortfolioListRaw,
): PortfolioListItemDto {
  const images = Array.isArray(raw.images) ? raw.images : [];

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    projectType: raw.projectType,
    slug: raw.slug,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : [],
    location: raw.location,
    county: raw.county,
    budget: toNumber(raw.budget),
    currency: raw.currency,
    isVerified: raw.isVerified,
    clientTestimonial: raw.clientTestimonial,
    clientName: raw.clientName,
    createdAt: toIsoString(raw.createdAt) ?? "",
    updatedAt: toIsoString(raw.updatedAt) ?? "",
    images: images.map((img) => mapImage(img)),
    _count: raw._count,
  };
}

type PortfolioDetailRaw = PortfolioListRaw & {
  completionDate: Date | null;
  professional?: {
    companyName: string;
    city: string | null;
    county: string | null;
    country: string | null;
  } | null;
};

export function toPortfolioDetailDto(
  raw: PortfolioDetailRaw,
): PortfolioDetailDto {
  const base = toPortfolioListItemDto(raw);
  return {
    ...base,
    completedAt: raw.completionDate ? toIsoString(raw.completionDate) : null,
    professional: raw.professional ?? undefined,
  };
}
