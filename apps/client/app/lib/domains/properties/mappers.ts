import type {
  MyPropertyListing,
  PropertyAssetDto,
  PropertyAttachmentDto,
  PropertyCreateResultDto,
  PropertyCoordinates,
  PropertyDetail,
  PropertyDocumentDto,
  PropertyListAgentDto,
  PropertyListImageDto,
  PropertyListItem,
} from "@/app/lib/domains/properties/contracts";

type DecimalLike = number | { toNumber?: () => number } | null | undefined;
type DateLike = Date | string | null | undefined;

function toNumber(value: DecimalLike): number {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }
  return value == null ? 0 : Number(value);
}

function toIsoString(value: DateLike): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeCoordinates(value: unknown): PropertyCoordinates {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.lat === "number" && typeof record.lng === "number") {
    return { lat: record.lat, lng: record.lng };
  }

  if (
    typeof record.latitude === "number" &&
    typeof record.longitude === "number"
  ) {
    return {
      latitude: record.latitude,
      longitude: record.longitude,
    };
  }

  if (
    record.type === "Point" &&
    Array.isArray(record.coordinates) &&
    record.coordinates.length === 2 &&
    typeof record.coordinates[0] === "number" &&
    typeof record.coordinates[1] === "number"
  ) {
    return {
      type: "Point",
      coordinates: [record.coordinates[0], record.coordinates[1]],
    };
  }

  return null;
}

function mapAsset(
  raw?: {
    id: string;
    cdnUrl?: string | null;
    thumbnailUrl?: string | null;
    blurHash?: string | null;
    width?: number | null;
    height?: number | null;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null,
): PropertyAssetDto | null {
  if (!raw) return null;
  return {
    id: raw.id,
    cdnUrl: raw.cdnUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    blurHash: raw.blurHash ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    originalName: raw.originalName ?? null,
    mimeType: raw.mimeType ?? null,
    size: raw.size ?? null,
  };
}

function mapListImage(raw: {
  id: string;
  caption: string | null;
  category: string;
  isMain: boolean;
  sortOrder: number;
  url: string | null;
  asset?: {
    id: string;
    cdnUrl?: string | null;
    thumbnailUrl?: string | null;
    blurHash?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
}): PropertyListImageDto {
  return {
    id: raw.id,
    caption: raw.caption ?? null,
    category: raw.category,
    isMain: raw.isMain,
    sortOrder: raw.sortOrder,
    url: raw.url ?? null,
    asset: mapAsset(raw.asset),
  };
}

function mapAgent(
  raw?: {
    userId: string;
    companyName: string | null;
    user?: {
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    } | null;
  } | null,
): PropertyListAgentDto | null {
  if (!raw) return null;
  return {
    userId: raw.userId,
    companyName: raw.companyName ?? null,
    user: raw.user
      ? {
          firstName: raw.user.firstName ?? null,
          lastName: raw.user.lastName ?? null,
          avatar: raw.user.avatar ?? null,
        }
      : null,
  };
}

export function toPropertyListItemDto(raw: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: string;
  category: string;
  price: DecimalLike;
  currency: string;
  priceNegotiable: boolean;
  location: string;
  address: string | null;
  county: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  buildingSize: number | null;
  plotSize: number | null;
  areaUnit: string | null;
  status: string;
  featured: boolean;
  verified: boolean;
  verificationStatus: string | null;
  viewCount: number;
  inquiryCount: number;
  images: Array<{
    id: string;
    caption: string | null;
    category: string;
    isMain: boolean;
    sortOrder: number;
    url: string | null;
    asset?: {
      id: string;
      cdnUrl?: string | null;
      thumbnailUrl?: string | null;
      blurHash?: string | null;
      width?: number | null;
      height?: number | null;
    } | null;
  }>;
  createdAt: DateLike;
  updatedAt: DateLike;
  agent?: {
    userId: string;
    companyName: string | null;
    user?: {
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    } | null;
  } | null;
  _count?: {
    inquiries: number;
  } | null;
}): PropertyListItem {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    description: raw.description ?? null,
    type: raw.type,
    category: raw.category,
    price: toNumber(raw.price),
    currency: raw.currency,
    priceNegotiable: raw.priceNegotiable,
    location: raw.location,
    address: raw.address ?? null,
    county: raw.county ?? null,
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null,
    parkingSpaces: raw.parkingSpaces ?? null,
    buildingSize: raw.buildingSize ?? null,
    plotSize: raw.plotSize ?? null,
    areaUnit: raw.areaUnit ?? null,
    status: raw.status,
    featured: raw.featured,
    verified: raw.verified,
    verificationStatus: raw.verificationStatus ?? null,
    viewCount: raw.viewCount,
    inquiryCount: raw.inquiryCount,
    images: raw.images.map(mapListImage),
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
    agent: mapAgent(raw.agent),
    _count: {
      inquiries: raw._count?.inquiries ?? 0,
    },
  };
}

export function toPropertyDetailDto(raw: {
  id: string;
  title: string;
  slug: string;
  version: number | null;
  description: string | null;
  type: string;
  category: string;
  price: DecimalLike;
  currency: string;
  priceNegotiable: boolean;
  serviceCharge: DecimalLike;
  depositRequired: string | null;
  paymentTerms: string | null;
  tenure: string | null;
  leaseYearsRemaining: number | null;
  titleDeedNumber: string | null;
  titleDeedReady: boolean | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  buildingSize: number | null;
  plotSize: number | null;
  areaUnit: string | null;
  yearBuilt: number | null;
  furnishing: string | null;
  completionStatus: string | null;
  location: string;
  address: string | null;
  county: string | null;
  constituency: string | null;
  neighbourhood: string | null;
  coordinates: unknown;
  latitude: number | null;
  longitude: number | null;
  nearbyLandmarks: unknown;
  hasBorehole: boolean | null;
  hasBackupGenerator: boolean | null;
  hasElevator: boolean | null;
  hasCCTV: boolean | null;
  isGatedCommunity: boolean | null;
  features: string[] | null;
  status: string;
  featured: boolean;
  verified: boolean;
  verificationStatus: string | null;
  verificationNotes: string | null;
  verifiedAt: DateLike;
  rejectionReason: string | null;
  viewCount: number;
  inquiryCount: number;
  floorPlanUrl: string | null;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  createdAt: DateLike;
  updatedAt: DateLike;
  deletedAt: DateLike;
  images: Array<{
    id: string;
    caption: string | null;
    category: string;
    tags: string[] | null;
    isMain: boolean;
    sortOrder: number;
    url: string | null;
    asset?: {
      id: string;
      cdnUrl?: string | null;
      thumbnailUrl?: string | null;
      blurHash?: string | null;
      width?: number | null;
      height?: number | null;
      mimeType?: string | null;
      size?: number | null;
    } | null;
  }>;
  attachments: Array<{
    id: string;
    title: string;
    type: string;
    fileUrl: string | null;
    asset?: {
      id: string;
      cdnUrl?: string | null;
    } | null;
  }>;
  documents: Array<{
    id: string;
    type: string;
    status: string;
    issueDate: DateLike;
    expiryDate: DateLike;
    isPrivate: boolean;
    asset?: {
      id: string;
      cdnUrl?: string | null;
    } | null;
  }>;
  agent?: {
    userId: string;
    companyName: string | null;
    profession: string | null;
    bio: string | null;
    city: string | null;
    county: string | null;
    verified: boolean;
    user?: {
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
      email: string | null;
      phone: string | null;
      status: string;
    } | null;
  } | null;
  _count?: {
    inquiries: number;
  } | null;
}): PropertyDetail {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    version: raw.version ?? 0,
    description: raw.description ?? null,
    type: raw.type,
    category: raw.category,
    price: toNumber(raw.price),
    currency: raw.currency,
    priceNegotiable: raw.priceNegotiable,
    serviceCharge:
      raw.serviceCharge == null ? null : toNumber(raw.serviceCharge),
    depositRequired: raw.depositRequired ?? null,
    paymentTerms: raw.paymentTerms ?? null,
    tenure: raw.tenure ?? null,
    leaseYearsRemaining: raw.leaseYearsRemaining ?? null,
    titleDeedNumber: raw.titleDeedNumber ?? null,
    titleDeedReady: raw.titleDeedReady ?? false,
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null,
    parkingSpaces: raw.parkingSpaces ?? null,
    buildingSize: raw.buildingSize ?? null,
    plotSize: raw.plotSize ?? null,
    areaUnit: raw.areaUnit ?? null,
    yearBuilt: raw.yearBuilt ?? null,
    furnishing: raw.furnishing ?? null,
    completionStatus: raw.completionStatus ?? null,
    location: raw.location,
    address: raw.address ?? null,
    county: raw.county ?? null,
    constituency: raw.constituency ?? null,
    neighbourhood: raw.neighbourhood ?? null,
    coordinates: normalizeCoordinates(raw.coordinates),
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    nearbyLandmarks: toStringArray(raw.nearbyLandmarks),
    hasBorehole: raw.hasBorehole ?? false,
    hasBackupGenerator: raw.hasBackupGenerator ?? false,
    hasElevator: raw.hasElevator ?? false,
    hasCCTV: raw.hasCCTV ?? false,
    isGatedCommunity: raw.isGatedCommunity ?? false,
    features: raw.features ?? [],
    status: raw.status,
    featured: raw.featured,
    verified: raw.verified,
    verificationStatus: raw.verificationStatus ?? null,
    verificationNotes: raw.verificationNotes ?? null,
    verifiedAt: toIsoString(raw.verifiedAt),
    rejectionReason: raw.rejectionReason ?? null,
    viewCount: raw.viewCount,
    inquiryCount: raw.inquiryCount,
    floorPlanUrl: raw.floorPlanUrl ?? null,
    videoUrl: raw.videoUrl ?? null,
    virtualTourUrl: raw.virtualTourUrl ?? null,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: toIsoString(raw.deletedAt),
    images: raw.images.map((image) => ({
      ...mapListImage(image),
      tags: image.tags ?? [],
      asset: mapAsset(image.asset),
    })),
    attachments: raw.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      type: attachment.type,
      fileUrl: attachment.fileUrl ?? null,
      asset: attachment.asset
        ? {
            id: attachment.asset.id,
            cdnUrl: attachment.asset.cdnUrl ?? "",
          }
        : null,
    })),
    documents: raw.documents.map((document) => ({
      id: document.id,
      type: document.type,
      status: document.status,
      issueDate: toIsoString(document.issueDate),
      expiryDate: toIsoString(document.expiryDate),
      isPrivate: document.isPrivate,
      asset: document.asset
        ? {
            id: document.asset.id,
            cdnUrl: document.asset.cdnUrl ?? "",
          }
        : null,
    })),
    agent: raw.agent
      ? {
          userId: raw.agent.userId,
          companyName: raw.agent.companyName ?? null,
          profession: raw.agent.profession ?? null,
          bio: raw.agent.bio ?? null,
          city: raw.agent.city ?? null,
          county: raw.agent.county ?? null,
          verified: raw.agent.verified,
          user: raw.agent.user
            ? {
                firstName: raw.agent.user.firstName ?? null,
                lastName: raw.agent.user.lastName ?? null,
                avatar: raw.agent.user.avatar ?? null,
                email: raw.agent.user.email ?? null,
                phone: raw.agent.user.phone ?? null,
                status: raw.agent.user.status,
              }
            : null,
        }
      : null,
    _count: {
      inquiries: raw._count?.inquiries ?? 0,
    },
  };
}

export function toMyPropertyListingDto(raw: {
  id: string;
  title: string;
  slug: string;
  price: DecimalLike;
  currency: string;
  location: string | null;
  county: string | null;
  type: string;
  category: string;
  status: { toLowerCase(): string } | string;
  verificationStatus: string | null;
  rejectionReason: string | null;
  viewCount: number;
  _count: { inquiries: number };
  images: Array<{
    url: string | null;
    asset?: { cdnUrl: string | null; thumbnailUrl: string | null } | null;
  }>;
  version: number | null;
  createdAt: DateLike;
  updatedAt: DateLike;
}): MyPropertyListing {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    price: toNumber(raw.price),
    currency: raw.currency,
    location: raw.location ?? "Unknown",
    county: raw.county ?? null,
    type: raw.type,
    category: raw.category,
    status: raw.status.toLowerCase(),
    verificationStatus: raw.verificationStatus ?? null,
    rejectionReason: raw.rejectionReason ?? null,
    views: raw.viewCount,
    inquiries: raw._count.inquiries,
    images: raw.images.map(
      (image) =>
        image.asset?.cdnUrl ??
        image.asset?.thumbnailUrl ??
        image.url ??
        "/placeholder-property.jpg",
    ),
    version: raw.version ?? 0,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function toPropertyDocumentDto(raw: {
  id: string;
  type: string;
  assetId: string | null;
  notes: string | null;
  status: string;
  createdAt: DateLike;
  updatedAt: DateLike;
  asset?: {
    id: string;
    cdnUrl: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null;
}): PropertyDocumentDto {
  return {
    id: raw.id,
    type: raw.type,
    assetId: raw.assetId,
    notes: raw.notes,
    status: raw.status,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
    asset: raw.asset
      ? {
          id: raw.asset.id,
          cdnUrl: raw.asset.cdnUrl ?? "",
          originalName: raw.asset.originalName ?? null,
          mimeType: raw.asset.mimeType ?? null,
          size: raw.asset.size ?? null,
        }
      : null,
  };
}

export function toPropertyAttachmentDto(raw: {
  id: string;
  title: string;
  type: string;
  assetId: string | null;
  notes: string | null;
  downloadCount?: number | null;
  createdAt: DateLike;
  updatedAt: DateLike;
  asset?: {
    id: string;
    cdnUrl: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null;
}): PropertyAttachmentDto {
  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    assetId: raw.assetId,
    notes: raw.notes,
    downloadCount: raw.downloadCount ?? 0,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
    asset: raw.asset
      ? {
          id: raw.asset.id,
          cdnUrl: raw.asset.cdnUrl ?? "",
          originalName: raw.asset.originalName ?? null,
          mimeType: raw.asset.mimeType ?? null,
          size: raw.asset.size ?? null,
        }
      : null,
  };
}

export function toPropertyCreateResultDto(raw: {
  id: string;
  title: string;
  slug: string;
  type: string;
  category: string;
  price: DecimalLike;
  location: string;
  status: string;
  version: number | null;
  createdAt: DateLike;
}): PropertyCreateResultDto {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    type: raw.type,
    category: raw.category,
    price: toNumber(raw.price),
    location: raw.location,
    status: raw.status,
    version: raw.version ?? 0,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
  };
}
