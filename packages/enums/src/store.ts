/**
 * Store and Commerce domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// StoreCategory
// -------------------------------------------------------------------------

export const STORE_CATEGORIES = [
  "HARDWARE",
  "BUILDING_MATERIALS",
  "TILES_AND_CERAMICS",
  "ELECTRICAL",
  "PLUMBING",
  "PAINTS_AND_FINISHES",
  "ROOFING",
  "TIMBER_AND_WOOD",
  "GLASS_AND_ALUMINUM",
  "KITCHEN_AND_BATH",
  "LANDSCAPING",
  "STEEL_AND_METALS",
  "SAFETY_AND_TOOLS",
  "HVAC",
  "SOLAR_AND_ENERGY",
  "WATER_STORAGE",
  "SECURITY_SYSTEMS",
  "DECOR_AND_LIGHTING",
  "HEAVY_MACHINERY",
  "WINDOWS_AND_DOORS",
  "AUTOMOTIVE",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  HARDWARE: "Hardware",
  BUILDING_MATERIALS: "Building Materials",
  TILES_AND_CERAMICS: "Tiles & Ceramics",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  PAINTS_AND_FINISHES: "Paints & Finishes",
  ROOFING: "Roofing",
  TIMBER_AND_WOOD: "Timber & Wood",
  GLASS_AND_ALUMINUM: "Glass & Aluminum",
  KITCHEN_AND_BATH: "Kitchen & Bath",
  LANDSCAPING: "Landscaping",
  STEEL_AND_METALS: "Steel & Metals",
  SAFETY_AND_TOOLS: "Safety & Tools",
  HVAC: "HVAC",
  SOLAR_AND_ENERGY: "Solar & Energy",
  WATER_STORAGE: "Water Storage",
  SECURITY_SYSTEMS: "Security Systems",
  DECOR_AND_LIGHTING: "Decor & Lighting",
  HEAVY_MACHINERY: "Heavy Machinery",
  WINDOWS_AND_DOORS: "Windows & Doors",
  AUTOMOTIVE: "Automotive",
};

export function isStoreCategory(value: unknown): value is StoreCategory {
  return (
    typeof value === "string" &&
    (STORE_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// StoreType
// -------------------------------------------------------------------------

export const STORE_TYPES = [
  "RETAIL",
  "WHOLESALE",
  "MANUFACTURER",
  "DISTRIBUTOR",
  "ONLINE_ONLY",
] as const;

export type StoreType = (typeof STORE_TYPES)[number];

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
  ONLINE_ONLY: "Online Only",
};

export function isStoreType(value: unknown): value is StoreType {
  return (
    typeof value === "string" &&
    (STORE_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// DeliveryOption
// -------------------------------------------------------------------------

export const DELIVERY_OPTIONS = [
  "PICKUP_ONLY",
  "DELIVERY_AVAILABLE",
  "THIRD_PARTY_LOGISTICS",
  "DIGITAL_DELIVERY",
] as const;

export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

export const DELIVERY_OPTION_LABELS: Record<DeliveryOption, string> = {
  PICKUP_ONLY: "Pickup Only",
  DELIVERY_AVAILABLE: "Delivery Available",
  THIRD_PARTY_LOGISTICS: "Third Party Logistics",
  DIGITAL_DELIVERY: "Digital Delivery",
};

export function isDeliveryOption(value: unknown): value is DeliveryOption {
  return (
    typeof value === "string" &&
    (DELIVERY_OPTIONS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// StoreDocumentType
// -------------------------------------------------------------------------

export const STORE_DOCUMENT_TYPES = [
  "BUSINESS_PERMIT",
  "BUSINESS_REGISTRATION",
  "KRA_TAX_COMPLIANCE",
  "KRA_PIN_CERTIFICATE",
  "CR12",
  "DISTRIBUTOR_LICENSE",
  "KEBS_CERTIFICATE",
  "ID_OR_PASSPORT",
  "LEASE_OR_OWNERSHIP",
  "TRADING_LICENSE",
] as const;

export type StoreDocumentType = (typeof STORE_DOCUMENT_TYPES)[number];

export const STORE_DOCUMENT_TYPE_LABELS: Record<StoreDocumentType, string> = {
  BUSINESS_PERMIT: "Business Permit",
  BUSINESS_REGISTRATION: "Business Registration",
  KRA_TAX_COMPLIANCE: "KRA Tax Compliance",
  KRA_PIN_CERTIFICATE: "KRA PIN Certificate",
  CR12: "CR12",
  DISTRIBUTOR_LICENSE: "Distributor License",
  KEBS_CERTIFICATE: "KEBS Certificate",
  ID_OR_PASSPORT: "ID or Passport",
  LEASE_OR_OWNERSHIP: "Lease or Ownership",
  TRADING_LICENSE: "Trading License",
};

export function isStoreDocumentType(
  value: unknown,
): value is StoreDocumentType {
  return (
    typeof value === "string" &&
    (STORE_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// OrderStatus
// -------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// StoreImageCategory
// -------------------------------------------------------------------------

export const STORE_IMAGE_CATEGORIES = [
  "LOGO",
  "STOREFRONT",
  "INTERIOR",
  "WAREHOUSE",
  "TEAM",
] as const;

export type StoreImageCategory = (typeof STORE_IMAGE_CATEGORIES)[number];

export const STORE_IMAGE_CATEGORY_LABELS: Record<StoreImageCategory, string> = {
  LOGO: "Logo",
  STOREFRONT: "Storefront",
  INTERIOR: "Interior",
  WAREHOUSE: "Warehouse",
  TEAM: "Team",
};

export function isStoreImageCategory(
  value: unknown,
): value is StoreImageCategory {
  return (
    typeof value === "string" &&
    (STORE_IMAGE_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// StoreEventType
// -------------------------------------------------------------------------

export const STORE_EVENT_TYPES = [
  "STORE_CREATED",
  "STORE_UPDATED",
  "STORE_DELETED",
  "STORE_RESTORED",
  "IMAGES_UPDATED",
  "OWNERSHIP_TRANSFERRED",
] as const;

export type StoreEventType = (typeof STORE_EVENT_TYPES)[number];

export const STORE_EVENT_TYPE_LABELS: Record<StoreEventType, string> = {
  STORE_CREATED: "Store Created",
  STORE_UPDATED: "Store Updated",
  STORE_DELETED: "Store Deleted",
  STORE_RESTORED: "Store Restored",
  IMAGES_UPDATED: "Images Updated",
  OWNERSHIP_TRANSFERRED: "Ownership Transferred",
};

export function isStoreEventType(value: unknown): value is StoreEventType {
  return (
    typeof value === "string" &&
    (STORE_EVENT_TYPES as readonly string[]).includes(value)
  );
}
