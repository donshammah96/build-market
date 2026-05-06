/**
 * Inquiries Client
 *
 * Client-side facade for professional-portal property inquiries.
 * Uses browser-safe REST APIs with client-side concurrency control.
 * Types aligned to domain DTOs; no DTO repair.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES, withQueryParams, type QueryParams } from "@/lib/links";
import { INQUIRIES_CLIENT_CONFIG } from "@/app/lib/config/inquiry.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  InquiriesQuerySchema,
  UpdateInquirySchema,
} from "@/app/lib/validation/inquiries-validation";
import type {
  InquiryDetailResult,
  InquiryListResult,
} from "@/app/lib/domains/inquiries/contracts";

const { BULKHEAD_CONCURRENCY } = INQUIRIES_CLIENT_CONFIG;

export type InquiriesQueryInput = z.infer<typeof InquiriesQuerySchema>;
export type UpdateInquiryInput = z.infer<typeof UpdateInquirySchema>;

export type UpdateInquiryClientInput = {
  inquiryId: string;
  data: UpdateInquiryInput;
  idempotencyKey?: string;
};

export type DeleteInquiryClientInput = {
  inquiryId: string;
  idempotencyKey?: string;
};

class InquiriesClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getInquiries(
    filters?: Partial<InquiriesQueryInput>,
  ): Promise<ApiResponse<InquiryListResult>> {
    return this.bulkhead.run(async () => {
      const url = filters
        ? withQueryParams(
            API_ROUTES.professionalPortalInquiries,
            filters as QueryParams,
          )
        : API_ROUTES.professionalPortalInquiries;

      const response = await apiFetch<InquiryListResult>(url);
      if (!response.success) {
        return { success: false, error: response.error };
      }
      return {
        success: true,
        data: response.data!,
      };
    });
  }

  async getInquiry(
    inquiryId: string,
  ): Promise<ApiResponse<InquiryDetailResult>> {
    if (!isValidId(inquiryId)) {
      return { success: false, error: "Invalid inquiry ID" };
    }
    return this.bulkhead.run(async () => {
      const response = await apiFetch<InquiryDetailResult>(
        API_ROUTES.professionalPortalInquiryDetail(inquiryId),
      );
      if (!response.success) {
        return { success: false, error: response.error };
      }
      return { success: true, data: response.data! };
    });
  }

  async updateInquiry(
    input: UpdateInquiryClientInput,
  ): Promise<ApiResponse<InquiryDetailResult>> {
    const { inquiryId, data, idempotencyKey } = input;
    if (!isValidId(inquiryId)) {
      return { success: false, error: "Invalid inquiry ID" };
    }
    return this.bulkhead.run(async () => {
      const response = await apiFetch<InquiryDetailResult>(
        API_ROUTES.professionalPortalInquiryDetail(inquiryId),
        {
          method: "PATCH",
          body: JSON.stringify({
            ...data,
            preferredViewingDate: data.preferredViewingDate ?? null,
          }),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      );
      if (!response.success) {
        return { success: false, error: response.error };
      }
      return { success: true, data: response.data! };
    });
  }

  async deleteInquiry(
    input: DeleteInquiryClientInput,
  ): Promise<ApiResponse<null>> {
    const { inquiryId, idempotencyKey } = input;
    if (!isValidId(inquiryId)) {
      return { success: false, error: "Invalid inquiry ID" };
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
