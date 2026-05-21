import type { AdminRole } from "@build/db";

// ============================================================================
// Actor
// ============================================================================

export type PropertiesActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// Error types
// ============================================================================

export type PropertiesDomainErrorCode =
  | "PROPERTIES_NOT_FOUND"
  | "PROPERTIES_POLICY_DENIED"
  | "PROPERTIES_INVALID_FILTER"
  | "PROPERTIES_MUTATION_CONFLICT";

export type PropertiesDomainError = {
  code: PropertiesDomainErrorCode;
  message: string;
};

// ============================================================================
// Filter / Query types
// ============================================================================

export type PropertyFilterInput = Partial<{
  page: number;
  limit: number;
  search: string;
  type: "SALE" | "RENT" | "LEASE";
  category: "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "INDUSTRIAL";
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verified: boolean;
  featured: boolean;
  county: string;
  status: "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";
  minPrice: number;
  maxPrice: number;
  sortBy: "createdAt" | "price" | "title" | "updatedAt";
  sortOrder: "asc" | "desc";
}>;

export type PropertyListQuery = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  type?: "SALE" | "RENT" | "LEASE";
  category?: "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "INDUSTRIAL";
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  verified?: boolean;
  featured?: boolean;
  county?: string;
  status?: "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";
  minPrice?: number;
  maxPrice?: number;
  sortBy: "createdAt" | "price" | "title" | "updatedAt";
  sortOrder: "asc" | "desc";
};

// ============================================================================
// Result types
// ============================================================================

export type PropertyListItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  type: string;
  category: string;
  status: string;
  location: string;
  county: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqFt: number | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  yearBuilt: number | null;
  verificationStatus: string | null;
  featured: boolean;
  createdAt: Date;
  agent: {
    id: string;
    companyName: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  mainImage: string | null;
};

export type PropertyDetailResult = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  type: string;
  category: string;
  status: string;
  location: string;
  address: string | null;
  county: string;
  constituency: string | null;
  neighbourhood: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqFt: number | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  yearBuilt: number | null;
  verified: boolean;
  featured: boolean;
  verificationStatus: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  agent: {
    userId: string;
    companyName: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    };
  };
  images: Array<{
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }>;
  attachments: Array<{
    id: string;
    fileUrl: string;
    type: string;
    isVerified: boolean;
  }>;
  _count: {
    images: number;
    attachments: number;
  };
};

export type PropertyPageResult = {
  properties: PropertyListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: PropertyListQuery;
};

export type PropertyUpdateInput = Partial<{
  title: string;
  description: string;
  price: number;
  type: "SALE" | "RENT" | "LEASE";
  category: "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "INDUSTRIAL";
  status: "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";
  location: string;
  address: string;
  county: string;
  featured: boolean;
}>;

export type PropertyStatusValue =
  | "AVAILABLE"
  | "SOLD"
  | "RENTED"
  | "UNDER_OFFER";

export type PropertyStatsResult = {
  total: number;
  verified: number;
  pending: number;
  featured: number;
  byType: Array<{ type: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byCounty: Array<{ county: string | null; _count: { id: number } }>;
  recent: Array<{ id: string; title: string; type: string; createdAt: Date }>;
  priceStats: { avg: number; min: number; max: number };
};
