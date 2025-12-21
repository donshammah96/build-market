// Type definitions aligned with Store schema

// Store category enum - matches Prisma StoreCategory
export type StoreCategory =
  | 'hardware'
  | 'building_materials'
  | 'tiles_and_ceramics'
  | 'electrical'
  | 'plumbing'
  | 'paints_and_finishes'
  | 'roofing'
  | 'timber_and_wood'
  | 'glass_and_aluminum'
  | 'kitchen_and_bath'
  | 'landscaping'
  | 'steel_and_metals'
  | 'safety_and_tools'
  | 'hvac';

// Store type enum - matches Prisma StoreType
export type StoreType =
  | 'retail'
  | 'wholesale'
  | 'manufacturer'
  | 'distributor'
  | 'online_only';

// Human-readable labels for categories
export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  hardware: 'Hardware',
  building_materials: 'Building Materials',
  tiles_and_ceramics: 'Tiles & Ceramics',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  paints_and_finishes: 'Paints & Finishes',
  roofing: 'Roofing',
  timber_and_wood: 'Timber & Wood',
  glass_and_aluminum: 'Glass & Aluminum',
  kitchen_and_bath: 'Kitchen & Bath',
  landscaping: 'Landscaping',
  steel_and_metals: 'Steel & Metals',
  safety_and_tools: 'Safety & Tools',
  hvac: 'HVAC',
};

// Human-readable labels for store types
export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  retail: 'Retail',
  wholesale: 'Wholesale',
  manufacturer: 'Manufacturer',
  distributor: 'Distributor',
  online_only: 'Online Only',
};

// Product interface - matches Prisma Product model
export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  price: number; // Decimal converted to number
  imageUrl?: string | null;
  category: string;
  inStock: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Review interface for stores
export interface StoreReview {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  rating: number;
  comment?: string | null;
  approved: boolean;
  createdAt: Date | string;
}

// Full store interface - matches Prisma Store model
export interface Store {
  id: string;
  professionalId: string;
  professional?: {
    userId: string;
    companyName: string;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      phone?: string | null;
    };
  };
  name: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  images: string[];
  categories: StoreCategory[];
  storeType: StoreType;
  verified: boolean;
  featured: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  products?: Product[];
  reviews?: StoreReview[];
  _count?: {
    products: number;
    orders: number;
    reviews: number;
  };
}

// For display purposes in cards/lists
export interface StoreCardData {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  location: string; // Formatted: "City, State"
  image?: string; // Primary image from images[]
  images: string[];
  categories: StoreCategory[];
  categoryLabels: string[]; // Human-readable category names
  storeType: StoreType;
  storeTypeLabel: string; // Human-readable store type
  verified: boolean;
  featured: boolean;
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  ownerName?: string; // Professional's name
  companyName?: string;
}

// Store list/search response
export interface StoreListResponse {
  stores: Store[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Store filter options
export interface StoreFilters {
  categories?: StoreCategory[];
  storeType?: StoreType;
  city?: string;
  state?: string;
  verified?: boolean;
  featured?: boolean;
  search?: string;
}

// Helper function to convert Store to StoreCardData
export function toStoreCardData(store: Store): StoreCardData {
  const ownerName = store.professional?.user
    ? `${store.professional.user.firstName || ''} ${store.professional.user.lastName || ''}`.trim()
    : undefined;

  return {
    id: store.id,
    name: store.name,
    description: store.description ?? undefined,
    address: store.address,
    city: store.city,
    state: store.state,
    location: `${store.city}, ${store.state}`,
    image: store.images[0],
    images: store.images,
    categories: store.categories,
    categoryLabels: store.categories.map((cat) => STORE_CATEGORY_LABELS[cat]),
    storeType: store.storeType,
    storeTypeLabel: STORE_TYPE_LABELS[store.storeType],
    verified: store.verified,
    featured: store.featured,
    rating: undefined, // Calculate from reviews if needed
    reviewCount: store._count?.reviews,
    productCount: store._count?.products,
    ownerName,
    companyName: store.professional?.companyName,
  };
}
