/**
 * Inquiries Client
 *
 * Client-side facade for professional-portal property inquiries.
 * Uses browser-safe REST APIs with client-side concurrency control.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES, withQueryParams, type QueryParams } from "@/lib/links";
import { INQUIRIES_CLIENT_CONFIG } from "@/lib/config/inquiry.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  InquiriesQuerySchema,
  UpdateInquirySchema,
  PropertyInquiry,
  PropertyInquiryList,
} from "@/lib/validation/inquiries-validation";

const { BULKHEAD_CONCURRENCY } = INQUIRIES_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type InquiriesQueryInput = z.infer<typeof InquiriesQuerySchema>;
export type UpdateInquiryInput = z.infer<typeof UpdateInquirySchema>;

export type { PropertyInquiry, PropertyInquiryList };

export type UpdateInquiryClientInput = {
  inquiryId: string;
  data: UpdateInquiryInput;
  idempotencyKey?: string;
};
export type DeleteInquiryClientInput = {
  inquiryId: string;
  idempotencyKey?: string;
};

// ─── Inquiries Client ──────────────────────────────────────────────────────

class InquiriesClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getInquiries(
    filters?: Partial<InquiriesQueryInput>,
  ): Promise<ApiResponse<PropertyInquiryList[]>> {
    return this.bulkhead.run(async () => {
      const url = filters
        ? withQueryParams(
            API_ROUTES.professionalPortalInquiries,
            filters as QueryParams,
          )
        : API_ROUTES.professionalPortalInquiries;

      return apiFetch<PropertyInquiryList[]>(url);
    });
  }

  async getInquiry(inquiryId: string): Promise<ApiResponse<PropertyInquiry>> {
    if (!isValidId(inquiryId)) {
      return {
        success: false,
        error: "Invalid inquiry ID",
      };
    }
    return this.bulkhead.run(() =>
      apiFetch<PropertyInquiry>(
        API_ROUTES.professionalPortalInquiryDetail(inquiryId),
      ),
    );
  }

  async updateInquiry(
    input: UpdateInquiryClientInput,
  ): Promise<ApiResponse<PropertyInquiry>> {
    const { inquiryId, data, idempotencyKey } = input;
    if (!isValidId(inquiryId)) {
      return {
        success: false,
        error: "Invalid inquiry ID",
      };
    }
    return this.bulkhead.run(() =>
      apiFetch<PropertyInquiry>(
        API_ROUTES.professionalPortalInquiryDetail(inquiryId),
        {
          method: "PATCH",
          body: JSON.stringify(data),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      ),
    );
  }

  async deleteInquiry(
    input: DeleteInquiryClientInput,
  ): Promise<ApiResponse<null>> {
    const { inquiryId, idempotencyKey } = input;
    if (!isValidId(inquiryId)) {
      return {
        success: false,
        error: "Invalid inquiry ID",
      };
    }
    return this.bulkhead.run(() =>
      apiFetch<null>(API_ROUTES.professionalPortalInquiryDetail(inquiryId), {
        method: "DELETE",
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      }),
    );
  }
}

export const inquiriesClient = new InquiriesClient();
export default inquiriesClient;
