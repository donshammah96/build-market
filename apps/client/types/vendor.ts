// Vendor types - Re-exports from store.ts for backwards compatibility
// The Vendor concept is implemented as Store in the schema

export {
  type Store,
  type StoreCategory,
  type StoreType,
  type County,
  type StoreImage,
  type Product,
  type ProductImage,
  type StoreReview,
  type StoreCardData,
  type StoreListResponse,
  type StoreFilters,
  STORE_CATEGORY_LABELS,
  STORE_TYPE_LABELS,
  COUNTY_LABELS,
  toStoreCardData,
} from "./store";

// Alias for backwards compatibility
export type Vendor = import("./store").Store;
export type VendorCardData = import("./store").StoreCardData;
