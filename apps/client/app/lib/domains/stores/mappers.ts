import type {
  MyStoreWithStats,
  StoreAssetDto,
  StoreDetail,
  StoreDocumentItem,
  StoreImageDto,
  StoreListItem,
  StoreProfessionalDto,
} from "@/app/lib/domains/stores/contracts";

type DecimalLike = {
  toNumber?: () => number;
  toString?: () => string;
};

export function toStoreDto<T>(value: T): T {
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

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNullableIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIsoString(value);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object") {
    const decimal = value as DecimalLike;
    if (typeof decimal.toNumber === "function") return decimal.toNumber();
    if (typeof decimal.toString === "function")
      return Number(decimal.toString());
  }
  return Number(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toStoreAssetDto(value: unknown): StoreAssetDto | null {
  if (!value || typeof value !== "object") return null;
  const asset = value as Record<string, unknown>;
  return {
    id: String(asset.id),
    cdnUrl: typeof asset.cdnUrl === "string" ? asset.cdnUrl : null,
    thumbnailUrl:
      typeof asset.thumbnailUrl === "string" ? asset.thumbnailUrl : null,
    blurHash: typeof asset.blurHash === "string" ? asset.blurHash : null,
    width: toNumber(asset.width),
    height: toNumber(asset.height),
    originalName:
      typeof asset.originalName === "string" ? asset.originalName : null,
    mimeType: typeof asset.mimeType === "string" ? asset.mimeType : null,
    size: toNumber(asset.size),
  };
}

function toStoreImageDto(value: unknown): StoreImageDto {
  const image = value as Record<string, unknown>;
  return {
    id: String(image.id),
    category: String(image.category),
    caption: typeof image.caption === "string" ? image.caption : null,
    isMain: Boolean(image.isMain),
    sortOrder: Number(image.sortOrder ?? 0),
    asset: toStoreAssetDto(image.asset),
  };
}

function toStoreProfessionalDto(value: unknown): StoreProfessionalDto | null {
  if (!value || typeof value !== "object") return null;
  const professional = value as Record<string, unknown>;
  const user =
    professional.user && typeof professional.user === "object"
      ? (professional.user as Record<string, unknown>)
      : null;

  return {
    userId: String(professional.userId),
    companyName:
      typeof professional.companyName === "string"
        ? professional.companyName
        : null,
    profession:
      typeof professional.profession === "string"
        ? professional.profession
        : null,
    website:
      typeof professional.website === "string" ? professional.website : null,
    user: user
      ? {
          firstName: typeof user.firstName === "string" ? user.firstName : null,
          lastName: typeof user.lastName === "string" ? user.lastName : null,
          avatar: typeof user.avatar === "string" ? user.avatar : null,
          email: typeof user.email === "string" ? user.email : null,
          phone: typeof user.phone === "string" ? user.phone : null,
          status: typeof user.status === "string" ? user.status : null,
        }
      : null,
  };
}

export function toStoreListItemDto(value: unknown): StoreListItem {
  const store = value as Record<string, unknown>;
  const count = (store._count ?? {}) as Record<string, unknown>;

  return {
    id: String(store.id),
    name: String(store.name),
    slug: String(store.slug),
    description:
      typeof store.description === "string" ? store.description : null,
    logoUrl: typeof store.logoUrl === "string" ? store.logoUrl : null,
    address: typeof store.address === "string" ? store.address : null,
    city: typeof store.city === "string" ? store.city : null,
    county: typeof store.county === "string" ? store.county : null,
    zipCode: typeof store.zipCode === "string" ? store.zipCode : null,
    latitude: toNumber(store.latitude),
    longitude: toNumber(store.longitude),
    categories: toStringArray(store.categories),
    storeType: String(store.storeType),
    verified: Boolean(store.verified),
    verificationStatus:
      typeof store.verificationStatus === "string"
        ? store.verificationStatus
        : null,
    featured: Boolean(store.featured),
    rating: toNumber(store.rating),
    reviewCount: Number(store.reviewCount ?? 0),
    isOpen: typeof store.isOpen === "boolean" ? store.isOpen : null,
    deliveryRadiusKm: toNumber(store.deliveryRadiusKm),
    images: Array.isArray(store.images)
      ? store.images.map(toStoreImageDto)
      : [],
    createdAt: toIsoString(store.createdAt),
    updatedAt: toIsoString(store.updatedAt),
    professional: toStoreProfessionalDto(store.professional),
    _count: {
      products: Number(count.products ?? 0),
      reviews: Number(count.reviews ?? 0),
      orders: Number(count.orders ?? 0),
    },
  };
}

export function toStoreDetailDto(value: unknown): StoreDetail {
  const store = value as Record<string, unknown>;
  return {
    ...toStoreListItemDto(store),
    bannerUrl: typeof store.bannerUrl === "string" ? store.bannerUrl : null,
    contactPhone:
      typeof store.contactPhone === "string" ? store.contactPhone : null,
    whatsappNumber:
      typeof store.whatsappNumber === "string" ? store.whatsappNumber : null,
    email: typeof store.email === "string" ? store.email : null,
    website: typeof store.website === "string" ? store.website : null,
    mpesaTillNumber:
      typeof store.mpesaTillNumber === "string" ? store.mpesaTillNumber : null,
    acceptsCard: Boolean(store.acceptsCard),
    acceptsCash: Boolean(store.acceptsCash),
    neighborhood:
      typeof store.neighborhood === "string" ? store.neighborhood : null,
    baseDeliveryFee: toNumber(store.baseDeliveryFee),
    minOrderValue: toNumber(store.minOrderValue),
    operatingHours: store.operatingHours ?? null,
    businessRegNo:
      typeof store.businessRegNo === "string" ? store.businessRegNo : null,
    kraPin: typeof store.kraPin === "string" ? store.kraPin : null,
    verificationNotes:
      typeof store.verificationNotes === "string"
        ? store.verificationNotes
        : null,
    verifiedAt: toNullableIsoString(store.verifiedAt),
    rejectionReason:
      typeof store.rejectionReason === "string" ? store.rejectionReason : null,
    deletedAt: toNullableIsoString(store.deletedAt),
    version:
      store.version === null || store.version === undefined
        ? undefined
        : Number(store.version),
  };
}

export function toMyStoreWithStatsDto(
  value: unknown,
  stats: {
    pendingOrders: number;
    totalRevenue: number;
  },
): MyStoreWithStats {
  const store = value as Record<string, unknown>;
  const count = (store._count ?? {}) as Record<string, unknown>;
  const products = Array.isArray(store.products) ? store.products : [];

  return {
    id: String(store.id),
    name: String(store.name),
    slug: String(store.slug),
    description:
      typeof store.description === "string" ? store.description : null,
    logoUrl: typeof store.logoUrl === "string" ? store.logoUrl : null,
    verified: Boolean(store.verified),
    verificationStatus:
      typeof store.verificationStatus === "string"
        ? store.verificationStatus
        : null,
    rejectionReason:
      typeof store.rejectionReason === "string" ? store.rejectionReason : null,
    rating: toNumber(store.rating),
    reviewCount: Number(store.reviewCount ?? 0),
    isOpen: typeof store.isOpen === "boolean" ? store.isOpen : null,
    featured: Boolean(store.featured),
    version: Number(store.version ?? 0),
    createdAt: toIsoString(store.createdAt),
    updatedAt: toIsoString(store.updatedAt),
    totalProducts: Number(count.products ?? 0),
    totalOrders: Number(count.orders ?? 0),
    totalReviews: Number(count.reviews ?? 0),
    pendingOrders: stats.pendingOrders,
    totalRevenue: stats.totalRevenue,
    recentProducts: products.map((product) => {
      const item = product as Record<string, unknown>;
      return {
        id: String(item.id),
        name: String(item.name),
        price: toNumber(item.price),
      };
    }),
    views: 0,
  };
}

export function toStoreDocumentItemDto(value: unknown): StoreDocumentItem {
  const document = value as Record<string, unknown>;
  return {
    id: String(document.id),
    storeId: String(document.storeId),
    assetId: typeof document.assetId === "string" ? document.assetId : null,
    uploadedById: String(document.uploadedById),
    type: document.type as StoreDocumentItem["type"],
    notes: typeof document.notes === "string" ? document.notes : null,
    status: String(document.status),
    rejectionReason:
      typeof document.rejectionReason === "string"
        ? document.rejectionReason
        : null,
    createdAt: toIsoString(document.createdAt),
    updatedAt: toIsoString(document.updatedAt),
    deletedAt: toNullableIsoString(document.deletedAt),
    asset: toStoreAssetDto(document.asset),
  };
}
