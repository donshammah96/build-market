import type {
  CreateStoreInput,
  UpdateStoreInput,
  StoreQueryInput,
  MyStoreWithStats,
} from "@/app/lib/domains/stores";

const MIGRATION_ERROR =
  "Stores legacy service path is deprecated. Use '@/app/lib/domains/stores' (storesService) instead.";

function throwForward(): never {
  throw new Error(MIGRATION_ERROR);
}

export type {
  CreateStoreInput,
  UpdateStoreInput,
  StoreQueryInput,
  MyStoreWithStats,
};

export async function getStores() {
  return throwForward();
}

export async function getStoreById() {
  return throwForward();
}

export async function getMyStores() {
  return throwForward();
}

export async function ensureUserCanCreateStores() {
  return throwForward();
}

export async function createStore() {
  return throwForward();
}

export async function createStoresBatch() {
  return throwForward();
}

export async function updateStore() {
  return throwForward();
}

export async function deleteStore() {
  return throwForward();
}

export async function getStoreDocuments() {
  return throwForward();
}

export async function addStoreDocument() {
  return throwForward();
}

export async function removeStoreDocument() {
  return throwForward();
}
