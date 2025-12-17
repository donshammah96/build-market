// Type definitions for Property model
// Aligned with Prisma schema

import { PropertyType, PropertyCategory, PropertyStatus } from '@prisma/client';

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
}

// Filters for property listing API
export interface PropertyFilters {
  type?: PropertyType;
  category?: PropertyCategory;
  status?: PropertyStatus;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  featured?: boolean;
  agentId?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
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
  type: PropertyType;
  category: PropertyCategory;
  status: PropertyStatus;
  beds?: number;
  baths?: number;
  area?: number;
  image: string;
  featured: boolean;
  agent?: {
    name: string;
    image?: string;
  };
}

// Full property details for single property page
export interface PropertyDetailData {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  currency: string;
  type: PropertyType;
  category: PropertyCategory;
  status: PropertyStatus;
  
  // Location
  location: string;
  address?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  
  // Details
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqFt?: number | null;
  lotSize?: number | null;
  
  // Media
  images: string[];
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
  hasMore: boolean;
}
