import type { ApiResponse } from "@build/types";
import { apiFetch } from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/routes";

export type ConsentTypeValue =
  "ANALYTICS_COOKIES" | "MARKETING_EMAIL" | "MARKETING_SMS";

export type ConsentUpdate = {
  type: ConsentTypeValue;
  granted: boolean;
  documentVersion?: string;
};

export type BulkConsentUpdateInput = {
  consents: ConsentUpdate[];
};

export const consentClient = {
  async updateConsents(
    data: BulkConsentUpdateInput,
  ): Promise<ApiResponse<unknown>> {
    return apiFetch<unknown>(API_ROUTES.userConsent, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

export default consentClient;
