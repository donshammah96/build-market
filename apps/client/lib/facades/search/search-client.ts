/**
 * Search Client
 *
 * Client-side facade for the public search API.
 */
import { API_ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type { SearchProfessionalResultDto } from "@/domains/search/contracts";

export const searchClient = {
  async searchProfessionals(
    query: string,
  ): Promise<ApiResponse<SearchProfessionalResultDto[]>> {
    const url = `${API_ROUTES.searchProfessionals}?q=${encodeURIComponent(query)}`;
    return apiFetch<SearchProfessionalResultDto[]>(url);
  },
};
