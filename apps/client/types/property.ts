// Type definitions for Property model
// Aligned with Prisma schema

import { County, COUNTY_LABELS } from "./store";
import { VerificationStatus, VERIFICATION_STATUS_LABELS } from "./professional";
import { PropertyTenure } from "@build/enums";
// ============================================================================
// ENUMS - Property Types (from Prisma schema)
// ============================================================================

// Property listing type - matches Prisma PropertyType enum
export type PropertyType = "SALE" | "RENT" | "LEASE";

// Property classification - matches Prisma PropertyCategory enum
export type PropertyCategory =
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "LAND"
  | "INDUSTRIAL";

// Property availability status - matches Prisma PropertyStatus enum
export type PropertyStatus = "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";

// Attachment types for property documents - matches Prisma AttachmentType enum (subset)
export type PropertyAttachmentType =
  | "TITLE_DEED"
  | "OFFICIAL_SEARCH"
  | "MANDATE_LETTER";

// ============================================================================
// LABELS - Human-readable labels
// ============================================================================

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
};

export const PROPERTY_CATEGORY_LABELS: Record<PropertyCategory, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  LAND: "Land",
  INDUSTRIAL: "Industrial",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: "Available",
  SOLD: "Sold",
  RENTED: "Rented",
  UNDER_OFFER: "Under Offer",
};

export const PROPERTY_ATTACHMENT_TYPE_LABELS: Record<
  PropertyAttachmentType,
  string
> = {
  TITLE_DEED: "Title Deed",
  OFFICIAL_SEARCH: "Official Search",
  MANDATE_LETTER: "Mandate Letter",
};

// ============================================================================
// INTERFACES - Property Images & Attachments
// ============================================================================

// Matches Prisma PropertyImage model
export interface PropertyImage {
  id: string;
  propertyId: string;
  url: string;
  key?: string | null;
  caption?: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

// Matches Prisma PropertyAttachment model
export interface PropertyAttachment {
  id: string;
  propertyId: string;
  fileUrl: string;
  fileKey?: string | null;
  type: PropertyAttachmentType;
  uploadedBy: string;
  isVerified: boolean;
  verifiedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Agent Data
// ============================================================================

// Agent data for display (subset of ProfessionalProfile)
export interface PropertyAgentData {
  userId: string;
  companyName: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  verified: boolean;
  bio?: string | null;
  city?: string | null;
  county?: string | null;
  earbNumber?: string | null;
}

// ============================================================================
// INTERFACES - Property (matches Prisma Property model)
// ============================================================================

export interface Property {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  price: number; // Decimal converted to number
  currency: string;
  type: PropertyType;
  category: PropertyCategory;
  tenure: PropertyTenure;

  // Location details
  county: County;
  constituency?: string | null;
  neighbourhood?: string | null;
  location: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  // Property specifications
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqFt?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  parkingSpaces?: number | null;

  // Legal & verification
  lrNumber?: string | null; // Land Reference Number
  verificationStatus: VerificationStatus;

  // Media
  floorPlan?: string | null;
  videoUrl?: string | null;

  // Additional details
  features: string[];
  status: PropertyStatus;
  featured: boolean;

  // Agent relationship
  agentId: string;
  agent?: PropertyAgentData;

  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;

  // Media attachments
  images?: PropertyImage[];
  attachments?: PropertyAttachment[];
}

// ============================================================================
// INTERFACES - Display Types
// ============================================================================

// Filters for property listing API
export interface PropertyFilters {
  type?: PropertyType;
  category?: PropertyCategory;
  status?: PropertyStatus;
  county?: County;
  constituency?: string;
  neighbourhood?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minArea?: number;
  maxArea?: number;
  featured?: boolean;
  verified?: boolean;
  agentId?: string;
  sortBy?: "price_asc" | "price_desc" | "newest" | "oldest";
  limit?: number;
  offset?: number;
}

// Property card data for listings
export interface PropertyCardData {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  county: County;
  countyLabel: string;
  type: PropertyType;
  typeLabel: string;
  category: PropertyCategory;
  categoryLabel: string;
  status: PropertyStatus;
  statusLabel: string;
  beds?: number;
  baths?: number;
  area?: number;
  lotSize?: number;
  yearBuilt?: number;
  parkingSpaces?: number;
  image?: string;
  images?: PropertyImage[];
  featured: boolean;
  verified: boolean;
  agent?: {
    id: string;
    name: string;
    image?: string;
    companyName: string;
  };
  createdAt: Date | string;
}

// Full property details for single property page
export interface PropertyDetailData {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  currency: string;
  type: PropertyType;
  typeLabel: string;
  category: PropertyCategory;
  categoryLabel: string;
  status: PropertyStatus;
  statusLabel: string;

  // Location
  county: County;
  countyLabel: string;
  constituency?: string | null;
  neighbourhood?: string | null;
  location: string;
  address?: string | null;
  coordinates?: { lat: number; lng: number } | null;

  // Details
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqFt?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  parkingSpaces?: number | null;

  // Legal
  lrNumber?: string | null;
  verificationStatus: VerificationStatus;
  verificationStatusLabel: string;

  // Media
  images: PropertyImage[];
  floorPlan?: string | null;
  videoUrl?: string | null;

  // Features
  features: string[];
  featured: boolean;

  // Agent
  agent: PropertyAgentData;

  // Meta
  createdAt: Date | string;
  updatedAt: Date | string;

  // Computed
  propertyUrl: string;
}

// API response for property list
export interface PropertyListResponse {
  properties: PropertyCardData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to get main image from PropertyImage array
function getMainImage(images?: PropertyImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  const mainImage = images.find((img) => img.isMain);
  return mainImage?.url ?? images[0]?.url;
}

// Helper function to convert Property to PropertyCardData
export function toPropertyCardData(property: Property): PropertyCardData {
  const agentName = property.agent?.user
    ? `${property.agent.user.firstName || ""} ${property.agent.user.lastName || ""}`.trim()
    : property.agent?.companyName;

  return {
    id: property.id,
    title: property.title,
    price: property.price,
    currency: property.currency,
    location: property.location,
    county: property.county,
    countyLabel: COUNTY_LABELS[property.county] || property.county,
    type: property.type,
    typeLabel: PROPERTY_TYPE_LABELS[property.type],
    category: property.category,
    categoryLabel: PROPERTY_CATEGORY_LABELS[property.category],
    status: property.status,
    statusLabel: PROPERTY_STATUS_LABELS[property.status],
    beds: property.bedrooms ?? undefined,
    baths: property.bathrooms ?? undefined,
    area: property.areaSqFt ?? undefined,
    lotSize: property.lotSize ?? undefined,
    yearBuilt: property.yearBuilt ?? undefined,
    parkingSpaces: property.parkingSpaces ?? undefined,
    image: getMainImage(property.images),
    images: property.images,
    featured: property.featured,
    verified: property.verificationStatus === "VERIFIED",
    agent: property.agent
      ? {
          id: property.agent.userId,
          name: agentName || property.agent.companyName,
          image: property.agent.user?.avatar ?? undefined,
          companyName: property.agent.companyName,
        }
      : undefined,
    createdAt: property.createdAt,
  };
}

// Helper function to convert Property to PropertyDetailData
export function toPropertyDetailData(property: Property): PropertyDetailData {
  return {
    id: property.id,
    title: property.title,
    description: property.description,
    price: property.price,
    currency: property.currency,
    type: property.type,
    typeLabel: PROPERTY_TYPE_LABELS[property.type],
    category: property.category,
    categoryLabel: PROPERTY_CATEGORY_LABELS[property.category],
    status: property.status,
    statusLabel: PROPERTY_STATUS_LABELS[property.status],
    county: property.county,
    countyLabel: COUNTY_LABELS[property.county] || property.county,
    constituency: property.constituency,
    neighbourhood: property.neighbourhood,
    location: property.location,
    address: property.address,
    coordinates:
      property.latitude && property.longitude
        ? { lat: property.latitude, lng: property.longitude }
        : null,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqFt: property.areaSqFt,
    lotSize: property.lotSize,
    yearBuilt: property.yearBuilt,
    parkingSpaces: property.parkingSpaces,
    lrNumber: property.lrNumber,
    verificationStatus: property.verificationStatus,
    verificationStatusLabel:
      VERIFICATION_STATUS_LABELS[property.verificationStatus],
    images: property.images ?? [],
    floorPlan: property.floorPlan,
    videoUrl: property.videoUrl,
    features: property.features,
    featured: property.featured,
    agent: property.agent!,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    propertyUrl: `/properties/${property.id}`,
  };
}

// Re-export for convenience
export type {
  County,
  COUNTY_LABELS,
  VerificationStatus,
  VERIFICATION_STATUS_LABELS,
};
