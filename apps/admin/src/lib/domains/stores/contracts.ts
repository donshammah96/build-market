import type { AdminRole } from "@build/db";

// ============================================================================
// Actor
// ============================================================================

export type StoresActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// Error types
// ============================================================================

export type StoresDomainErrorCode =
  | "STORES_NOT_FOUND"
  | "STORES_POLICY_DENIED"
  | "STORES_INVALID_FILTER"
  | "STORES_MUTATION_CONFLICT";

export type StoresDomainError = {
  code: StoresDomainErrorCode;
  message: string;
};

// ============================================================================
// Filter / Query types
// ============================================================================

export type StoreFilterInput = Partial<{
  page: number;
  limit: number;
  search: string;
  verified: boolean;
  featured: boolean;
  county: string;
  category: string;
  storeType: string;
  sortBy: "createdAt" | "name" | "updatedAt";
  sortOrder: "asc" | "desc";
}>;

export type StoreListQuery = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  verified?: boolean;
  featured?: boolean;
  county?: string;
  category?: string;
  storeType?: string;
  sortBy: "createdAt" | "name" | "updatedAt";
  sortOrder: "asc" | "desc";
};

// ============================================================================
// Result types
// ============================================================================

export type StoreListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  county: string | null;
  categories: string[];
  storeType: string;
  verified: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string;
  } | null;
  _count: {
    products: number;
    orders: number;
  };
};

export type StoreDetailResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  county: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categories: string[];
  storeType: string;
  verified: boolean;
  featured: boolean;
  verificationStatus: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    userId: string;
    companyName: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    };
  } | null;
  images: Array<{
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    price: number;
    status: string;
  }>;
  _count: {
    products: number;
    orders: number;
    reviews: number;
  };
};

export type StorePageResult = {
  stores: StoreListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: StoreListQuery;
};

export type StoreUpdateInput = Partial<{
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  zipCode: string;
  featured: boolean;
}>;

export type StoreStatsResult = {
  total: number;
  verified: number;
  pending: number;
  featured: number;
  byCategory: Array<{ categories: string[]; _count: { id: number } }>;
  byCounty: Array<{ county: string | null; _count: { id: number } }>;
  recent: Array<{
    id: string;
    name: string;
    verified: boolean;
    createdAt: Date;
  }>;
};
