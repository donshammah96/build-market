import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES, withQueryParams, type QueryParams } from "@/lib/links";
import type { SellerTopProduct } from "@/app/lib/domains/seller-insights";

export type TopProduct = SellerTopProduct;

export type TopProductsQueryInput = {
  limit?: number | string;
};

class ProductsClient {
  private readonly bulkhead = new ConcurrencyLimiter(3);

  async getTopProducts(
    filters?: TopProductsQueryInput,
  ): Promise<ApiResponse<TopProduct[]>> {
    return this.bulkhead.run(async () => {
      const url = filters
        ? withQueryParams(
            API_ROUTES.professionalPortalTopProducts,
            filters as QueryParams,
          )
        : API_ROUTES.professionalPortalTopProducts;
      const response = await apiFetch<SellerTopProduct[]>(url);

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : [],
      };
    });
  }
}

export const productsClient = new ProductsClient();
export default productsClient;
