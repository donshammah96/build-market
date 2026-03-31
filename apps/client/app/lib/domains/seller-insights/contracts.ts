import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type { OrdersQueryInput } from "@/app/lib/validation/orders-validation";

export type SellerInsightsActor = {
  userId: string;
  role?: AppRole | string | null;
};

export type SellerInsightsDomainErrorCode = "forbidden";

export type SellerInsightsDomainError =
  DomainError<SellerInsightsDomainErrorCode>;

export type SellerInsightsResult<T> = Result<T, SellerInsightsDomainError>;

export type SellerTopProductsQuery = {
  limit?: number;
};

export type SellerInventoryAlert = {
  id: string;
  productName: string;
  slug: string | null;
  sku: string | null;
  currentStock: number;
  threshold: number;
  status: "out_of_stock" | "low_stock";
  store: { id: string; name: string } | null;
};

export type SellerInventoryAlertsResult = {
  data: SellerInventoryAlert[];
  summary: { outOfStock: number; lowStock: number };
};

export type SellerOrderListResult = {
  data: Array<{
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: string | null;
    itemCount: number;
    client: { id: string; name: string };
    store: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SellerTopProduct = {
  id: string | null;
  name: string;
  imageUrl: string | null;
  price: number;
  soldCount: number;
  revenue: number;
};

export type { OrdersQueryInput };
