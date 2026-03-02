/**
 * Property domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// PropertyType
// -------------------------------------------------------------------------

export const PROPERTY_TYPES = ["SALE", "RENT", "LEASE"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
};

export function isPropertyType(value: unknown): value is PropertyType {
  return (
    typeof value === "string" &&
    (PROPERTY_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PropertyCategory
// -------------------------------------------------------------------------

export const PROPERTY_CATEGORIES = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "LAND",
  "INDUSTRIAL",
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const PROPERTY_CATEGORY_LABELS: Record<PropertyCategory, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  LAND: "Land",
  INDUSTRIAL: "Industrial",
};

export function isPropertyCategory(value: unknown): value is PropertyCategory {
  return (
    typeof value === "string" &&
    (PROPERTY_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PropertyTenure
// -------------------------------------------------------------------------

export const PROPERTY_TENURES = [
  "FREEHOLD",
  "LEASEHOLD",
  "SECTIONAL_TITLE",
  "SUB_LEASE",
] as const;

export type PropertyTenure = (typeof PROPERTY_TENURES)[number];

export const PROPERTY_TENURE_LABELS: Record<PropertyTenure, string> = {
  FREEHOLD: "Freehold",
  LEASEHOLD: "Leasehold",
  SECTIONAL_TITLE: "Sectional Title",
  SUB_LEASE: "Sub-lease",
};

export function isPropertyTenure(value: unknown): value is PropertyTenure {
  return (
    typeof value === "string" &&
    (PROPERTY_TENURES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// FurnishingStatus
// -------------------------------------------------------------------------

export const FURNISHING_STATUSES = [
  "UNFURNISHED",
  "SEMI_FURNISHED",
  "FURNISHED",
  "SERVICED",
] as const;

export type FurnishingStatus = (typeof FURNISHING_STATUSES)[number];

export const FURNISHING_STATUS_LABELS: Record<FurnishingStatus, string> = {
  UNFURNISHED: "Unfurnished",
  SEMI_FURNISHED: "Semi-furnished",
  FURNISHED: "Furnished",
  SERVICED: "Serviced",
};

export function isFurnishingStatus(value: unknown): value is FurnishingStatus {
  return (
    typeof value === "string" &&
    (FURNISHING_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// CompletionStatus
// -------------------------------------------------------------------------

export const COMPLETION_STATUSES = [
  "READY_TO_MOVE",
  "UNDER_CONSTRUCTION",
  "OFF_PLAN",
] as const;

export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const COMPLETION_STATUS_LABELS: Record<CompletionStatus, string> = {
  READY_TO_MOVE: "Ready to Move",
  UNDER_CONSTRUCTION: "Under Construction",
  OFF_PLAN: "Off Plan",
};

export function isCompletionStatus(value: unknown): value is CompletionStatus {
  return (
    typeof value === "string" &&
    (COMPLETION_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AreaUnit
// -------------------------------------------------------------------------

export const AREA_UNITS = [
  "SQ_METERS",
  "SQ_FEET",
  "ACRES",
  "HECTARES",
] as const;

export type AreaUnit = (typeof AREA_UNITS)[number];

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  SQ_METERS: "Square Meters (sqm)",
  SQ_FEET: "Square Feet (sqft)",
  ACRES: "Acres",
  HECTARES: "Hectares",
};

export function isAreaUnit(value: unknown): value is AreaUnit {
  return (
    typeof value === "string" &&
    (AREA_UNITS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PropertyDocumentType
// -------------------------------------------------------------------------

export const PROPERTY_DOCUMENT_TYPES = [
  "TITLE_DEED",
  "OFFICIAL_SEARCH",
  "LAND_RATES_CLEARANCE",
  "LAND_RATES_COMPLIANCE",
  "LAND_RENT_CLEARANCE",
  "ID_COPY",
  "ID_OR_PASSPORT",
  "KRA_PIN",
  "AUTHORITY_TO_SELL",
  "MANDATE_LETTER",
  "SALE_AGREEMENT",
  "MUTATION_FORM",
  "SECTIONAL_PROPERTIES_ACT_DOC",
  "OTHER",
] as const;

export type PropertyDocumentType = (typeof PROPERTY_DOCUMENT_TYPES)[number];

export const PROPERTY_DOCUMENT_TYPE_LABELS: Record<
  PropertyDocumentType,
  string
> = {
  TITLE_DEED: "Title Deed",
  OFFICIAL_SEARCH: "Official Search",
  LAND_RATES_CLEARANCE: "Land Rates Clearance",
  LAND_RATES_COMPLIANCE: "Land Rates Compliance",
  LAND_RENT_CLEARANCE: "Land Rent Clearance",
  ID_COPY: "ID Copy",
  ID_OR_PASSPORT: "ID or Passport",
  KRA_PIN: "KRA PIN",
  AUTHORITY_TO_SELL: "Authority to Sell",
  MANDATE_LETTER: "Mandate Letter",
  SALE_AGREEMENT: "Sale Agreement",
  MUTATION_FORM: "Mutation Form",
  SECTIONAL_PROPERTIES_ACT_DOC: "Sectional Properties Act Document",
  OTHER: "Other",
};

export function isPropertyDocumentType(
  value: unknown,
): value is PropertyDocumentType {
  return (
    typeof value === "string" &&
    (PROPERTY_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PropertyStatus
// -------------------------------------------------------------------------

export const PROPERTY_STATUSES = [
  "AVAILABLE",
  "SOLD",
  "RENTED",
  "UNDER_OFFER",
  "OFF_MARKET",
] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: "Available",
  SOLD: "Sold",
  RENTED: "Rented",
  UNDER_OFFER: "Under Offer",
  OFF_MARKET: "Off Market",
};

export function isPropertyStatus(value: unknown): value is PropertyStatus {
  return (
    typeof value === "string" &&
    (PROPERTY_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// DocumentStatus
// -------------------------------------------------------------------------

export const DOCUMENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function isDocumentStatus(value: unknown): value is DocumentStatus {
  return (
    typeof value === "string" &&
    (DOCUMENT_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// AttachmentType
// -------------------------------------------------------------------------

export const ATTACHMENT_TYPES = [
  "FLOOR_PLAN",
  "BROCHURE",
  "ENERGY_CERTIFICATE",
  "SITE_MAP",
  "SALE_AGREEMENT_DRAFT",
  "BUILDING_PERMIT",
  "OTHER",
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  FLOOR_PLAN: "Floor Plan",
  BROCHURE: "Brochure",
  ENERGY_CERTIFICATE: "Energy Certificate",
  SITE_MAP: "Site Map",
  SALE_AGREEMENT_DRAFT: "Sale Agreement Draft",
  BUILDING_PERMIT: "Building Permit",
  OTHER: "Other",
};

export function isAttachmentType(value: unknown): value is AttachmentType {
  return (
    typeof value === "string" &&
    (ATTACHMENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ImageCategory
// -------------------------------------------------------------------------

export const IMAGE_CATEGORIES = [
  "EXTERIOR",
  "LIVING_ROOM",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "AERIAL_VIEW",
  "AMENITIES",
  "PLAN",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  EXTERIOR: "Exterior",
  LIVING_ROOM: "Living Room",
  KITCHEN: "Kitchen",
  BEDROOM: "Bedroom",
  BATHROOM: "Bathroom",
  AERIAL_VIEW: "Aerial View",
  AMENITIES: "Amenities",
  PLAN: "Plan",
};

export function isImageCategory(value: unknown): value is ImageCategory {
  return (
    typeof value === "string" &&
    (IMAGE_CATEGORIES as readonly string[]).includes(value)
  );
}
