// Type definitions aligned with Store schema
import { z } from "zod";

// ============================================================================
// ENUMS - Store & Vendor Categories (from Prisma schema)
// ============================================================================

// Store category enum - matches Prisma StoreCategory
export type StoreCategory =
  | "hardware"
  | "building_materials"
  | "tiles_and_ceramics"
  | "electrical"
  | "plumbing"
  | "paints_and_finishes"
  | "roofing"
  | "timber_and_wood"
  | "glass_and_aluminum"
  | "kitchen_and_bath"
  | "landscaping"
  | "steel_and_metals"
  | "safety_and_tools"
  | "hvac"
  | "cement_and_aggregates"
  | "stone_and_masonry"
  | "doors_and_windows"
  | "lighting_and_fixtures"
  | "ceilings_and_drywall"
  | "flooring"
  | "solar_and_energy"
  | "security_and_automation"
  | "water_storage_and_pumps"
  | "water_treatment_and_filtration"
  | "water_distribution_and_piping"
  | "interior_design"
  | "outdoor_living"
  | "pool_and_spa"
  | "fireplaces_and_chimneys"
  | "barbecue_and_outdoor_kitchens"
  | "garden_and_landscaping"
  | "patio_and_outdoor_furniture"
  | "outdoor_lighting"
  | "outdoor_audio"
  | "smart_home_and_automation"
  | "security_and_surveillance"
  | "energy_efficient_solutions"
  | "green_building_materials"
  | "outdoor_security";

// Store type enum - matches Prisma StoreType
export type StoreType =
  "retail" | "wholesale" | "manufacturer" | "distributor" | "online_only";

// County enum - matches Prisma County
export type County =
  | "MOMBASA"
  | "KWALE"
  | "KILIFI"
  | "TANA_RIVER"
  | "LAMU"
  | "TAITA_TAVETA"
  | "GARISSA"
  | "WAJIR"
  | "MANDERA"
  | "MARSABIT"
  | "ISIOLO"
  | "MERU"
  | "THARAKA_NITHI"
  | "EMBU"
  | "KITUI"
  | "MACHAKOS"
  | "MAKUENI"
  | "NYANDARUA"
  | "NYERI"
  | "KIRINYAGA"
  | "MURANGA"
  | "KIAMBU"
  | "TURKANA"
  | "WEST_POKOT"
  | "SAMBURU"
  | "TRANS_NZOIA"
  | "UASIN_GISHU"
  | "ELGEYO_MARAKWET"
  | "NANDI"
  | "BARINGO"
  | "LAIKIPIA"
  | "NAKURU"
  | "NAROK"
  | "KAJIADO"
  | "KERICHO"
  | "BOMET"
  | "KAKAMEGA"
  | "VIHIGA"
  | "BUNGOMA"
  | "BUSIA"
  | "SIAYA"
  | "KISUMU"
  | "HOMA_BAY"
  | "MIGORI"
  | "KISII"
  | "NYAMIRA"
  | "NAIROBI";

// ============================================================================
// LABELS - Human-readable labels
// ============================================================================

// Human-readable labels for categories
export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  hardware: "Hardware",
  building_materials: "Building Materials",
  tiles_and_ceramics: "Tiles & Ceramics",
  electrical: "Electrical",
  plumbing: "Plumbing",
  paints_and_finishes: "Paints & Finishes",
  roofing: "Roofing",
  timber_and_wood: "Timber & Wood",
  glass_and_aluminum: "Glass & Aluminum",
  kitchen_and_bath: "Kitchen & Bath",
  landscaping: "Landscaping",
  steel_and_metals: "Steel & Metals",
  safety_and_tools: "Safety & Tools",
  hvac: "HVAC",
  cement_and_aggregates: "Cement & Aggregates",
  stone_and_masonry: "Stone & Masonry",
  doors_and_windows: "Doors & Windows",
  lighting_and_fixtures: "Lighting & Fixtures",
  ceilings_and_drywall: "Ceilings & Drywall",
  flooring: "Flooring",
  solar_and_energy: "Solar & Energy",
  security_and_automation: "Security & CCTV",
  water_storage_and_pumps: "Water Tanks & Pumps",
  outdoor_living: "Outdoor Living & BBQ",
  water_treatment_and_filtration: "Water Treatment & Filtration",
  water_distribution_and_piping: "Water Distribution & Piping",
  interior_design: "Interior Design",
  pool_and_spa: "Pool & Spa",
  fireplaces_and_chimneys: "Fireplaces & Chimneys",
  barbecue_and_outdoor_kitchens: "Barbecue & Outdoor Kitchens",
  garden_and_landscaping: "Garden & Landscaping",
  patio_and_outdoor_furniture: "Patio & Outdoor Furniture",
  outdoor_lighting: "Outdoor Lighting",
  outdoor_audio: "Outdoor Audio",
  outdoor_security: "Outdoor Security",
  smart_home_and_automation: "Smart Home & Automation",
  security_and_surveillance: "Security & Surveillance",
  energy_efficient_solutions: "Energy Efficient Solutions",
  green_building_materials: "Green Building Materials",
};

// Human-readable labels for store types
export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  online_only: "Online Only",
};

// Human-readable labels for counties
export const COUNTY_LABELS: Record<County, string> = {
  MOMBASA: "Mombasa",
  KWALE: "Kwale",
  KILIFI: "Kilifi",
  TANA_RIVER: "Tana River",
  LAMU: "Lamu",
  TAITA_TAVETA: "Taita Taveta",
  GARISSA: "Garissa",
  WAJIR: "Wajir",
  MANDERA: "Mandera",
  MARSABIT: "Marsabit",
  ISIOLO: "Isiolo",
  MERU: "Meru",
  THARAKA_NITHI: "Tharaka Nithi",
  EMBU: "Embu",
  KITUI: "Kitui",
  MACHAKOS: "Machakos",
  MAKUENI: "Makueni",
  NYANDARUA: "Nyandarua",
  NYERI: "Nyeri",
  KIRINYAGA: "Kirinyaga",
  MURANGA: "Murang'a",
  KIAMBU: "Kiambu",
  TURKANA: "Turkana",
  WEST_POKOT: "West Pokot",
  SAMBURU: "Samburu",
  TRANS_NZOIA: "Trans Nzoia",
  UASIN_GISHU: "Uasin Gishu",
  ELGEYO_MARAKWET: "Elgeyo Marakwet",
  NANDI: "Nandi",
  BARINGO: "Baringo",
  LAIKIPIA: "Laikipia",
  NAKURU: "Nakuru",
  NAROK: "Narok",
  KAJIADO: "Kajiado",
  KERICHO: "Kericho",
  BOMET: "Bomet",
  KAKAMEGA: "Kakamega",
  VIHIGA: "Vihiga",
  BUNGOMA: "Bungoma",
  BUSIA: "Busia",
  SIAYA: "Siaya",
  KISUMU: "Kisumu",
  HOMA_BAY: "Homa Bay",
  MIGORI: "Migori",
  KISII: "Kisii",
  NYAMIRA: "Nyamira",
  NAIROBI: "Nairobi",
};

// ============================================================================
// INTERFACES - Store Images (matches Prisma StoreImage model)
// ============================================================================

export interface StoreImage {
  id: string;
  storeId: string;
  url: string;
  key?: string | null;
  caption?: string | null;
  isMain: boolean;
  isLogo: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

// ============================================================================
// INTERFACES - Product (matches Prisma Product model)
// ============================================================================

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  key?: string | null;
  caption?: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  slug: string;
  price: number; // Decimal converted to number
  category: string;
  sku?: string | null;
  inStock: boolean;
  stockCount?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  images?: ProductImage[];
}

// ============================================================================
// INTERFACES - Store Review (matches Prisma Review model for stores)
// ============================================================================

export interface StoreReview {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  type: "store";
  rating: number;
  comment?: string | null;
  approved: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Store (matches Prisma Store model)
// ============================================================================

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
  slug: string;
  address: string;
  city: string;
  county: County;
  zipCode?: string | null;
  categories: StoreCategory[];
  storeType: StoreType;
  verified: boolean;
  featured: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  images?: StoreImage[];
  products?: Product[];
  reviews?: StoreReview[];
  _count?: {
    products: number;
    orders: number;
    reviews: number;
  };
}

// ============================================================================
// INTERFACES - Display Types
// ============================================================================

// For display purposes in cards/lists
export interface StoreCardData {
  id: string;
  name: string;
  description?: string;
  slug: string;
  address: string;
  city: string;
  county: County;
  location: string; // Formatted: "City, County"
  image?: string; // Primary image URL
  logoImage?: string; // Logo image URL
  images: StoreImage[];
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
  county?: County;
  verified?: boolean;
  featured?: boolean;
  search?: string;
}

// Store Category options
export interface StoreCategoryOption {
  value: StoreCategory;
  label: string;
}

export const STORE_CATEGORY_OPTIONS: Record<
  StoreCategory,
  StoreCategoryOption
> = Object.fromEntries(
  Object.entries(STORE_CATEGORY_LABELS).map(([value, label]) => [
    value as StoreCategory,
    {
      value: value as StoreCategory,
      label,
    },
  ]),
) as Record<StoreCategory, StoreCategoryOption>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to get main image from StoreImage array
function getMainImage(images?: StoreImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  const mainImage = images.find((img) => img.isMain);
  return mainImage?.url ?? images[0]?.url;
}

// Helper function to get logo image from StoreImage array
function getLogoImage(images?: StoreImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  return images.find((img) => img.isLogo)?.url;
}

// Helper function to convert Store to StoreCardData
export function toStoreCardData(store: Store): StoreCardData {
  const ownerName = store.professional?.user
    ? `${store.professional.user.firstName || ""} ${store.professional.user.lastName || ""}`.trim()
    : undefined;

  return {
    id: store.id,
    name: store.name,
    description: store.description ?? undefined,
    slug: store.slug,
    address: store.address,
    city: store.city,
    county: store.county,
    location: `${store.city}, ${COUNTY_LABELS[store.county] || store.county}`,
    image: getMainImage(store.images),
    logoImage: getLogoImage(store.images),
    images: store.images ?? [],
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

// ============================================================================
// ZOD SCHEMAS - For form validation
// ============================================================================

/** Zod enum for County validation */
export const CountyEnum = z.enum([
  "MOMBASA",
  "KWALE",
  "KILIFI",
  "TANA_RIVER",
  "LAMU",
  "TAITA_TAVETA",
  "GARISSA",
  "WAJIR",
  "MANDERA",
  "MARSABIT",
  "ISIOLO",
  "MERU",
  "THARAKA_NITHI",
  "EMBU",
  "KITUI",
  "MACHAKOS",
  "MAKUENI",
  "NYANDARUA",
  "NYERI",
  "KIRINYAGA",
  "MURANGA",
  "KIAMBU",
  "TURKANA",
  "WEST_POKOT",
  "SAMBURU",
  "TRANS_NZOIA",
  "UASIN_GISHU",
  "ELGEYO_MARAKWET",
  "NANDI",
  "BARINGO",
  "LAIKIPIA",
  "NAKURU",
  "NAROK",
  "KAJIADO",
  "KERICHO",
  "BOMET",
  "KAKAMEGA",
  "VIHIGA",
  "BUNGOMA",
  "BUSIA",
  "SIAYA",
  "KISUMU",
  "HOMA_BAY",
  "MIGORI",
  "KISII",
  "NYAMIRA",
  "NAIROBI",
] as const);

/** Zod enum for StoreCategory validation */
export const StoreCategoryEnum = z.enum([
  "hardware",
  "building_materials",
  "tiles_and_ceramics",
  "electrical",
  "plumbing",
  "paints_and_finishes",
  "roofing",
  "timber_and_wood",
  "glass_and_aluminum",
  "kitchen_and_bath",
  "landscaping",
  "steel_and_metals",
  "safety_and_tools",
  "hvac",
  "cement_and_aggregates",
  "stone_and_masonry",
  "doors_and_windows",
  "lighting_and_fixtures",
  "ceilings_and_drywall",
  "flooring",
  "solar_and_energy",
  "security_and_automation",
  "water_storage_and_pumps",
  "water_treatment_and_filtration",
  "water_distribution_and_piping",
  "interior_design",
  "outdoor_living",
  "pool_and_spa",
  "fireplaces_and_chimneys",
  "barbecue_and_outdoor_kitchens",
  "garden_and_landscaping",
  "patio_and_outdoor_furniture",
  "outdoor_lighting",
  "outdoor_audio",
  "smart_home_and_automation",
  "security_and_surveillance",
  "energy_efficient_solutions",
  "green_building_materials",
  "outdoor_security",
] as const);

/** Zod enum for StoreType validation */
export const StoreTypeEnum = z.enum([
  "retail",
  "wholesale",
  "manufacturer",
  "distributor",
  "online_only",
] as const);
