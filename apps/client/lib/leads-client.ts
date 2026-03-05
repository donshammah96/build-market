/**
 * Leads Client
 *
 * Client-side facade for the professional-portal leads subsystem.
 * Uses browser-safe REST APIs with client-side concurrency control.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { LEADS_CLIENT_CONFIG } from "@/lib/config/lead.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import type { Lead, LeadList } from "@/lib/validation/leads-validation";
import {
  LeadQuerySchema,
  CreateLeadSchema,
  UpdateLeadSchema,
} from "@/lib/validation/leads-validation";

const { BULKHEAD_CONCURRENCY } = LEADS_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type LeadQueryInput = z.infer<typeof LeadQuerySchema>;
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

export type CreateLeadClientInput = CreateLeadInput & {
  idempotencyKey?: string;
};
export type UpdateLeadClientInput = {
  leadId: string;
  data: UpdateLeadInput;
  idempotencyKey?: string;
};
export type DeleteLeadClientInput = {
  leadId: string;
  idempotencyKey?: string;
};

export type LeadListResponse = {
  leads: LeadList[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DeleteLeadResponse = {
  message: string;
  leadId: string;
};

// ─── Leads Client ──────────────────────────────────────────────────────────

class LeadsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getLeads(
    filters?: Partial<LeadQueryInput>,
  ): Promise<ApiResponse<LeadListResponse>> {
    return this.bulkhead.run(async () => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<LeadListResponse>(
        `/api/professional-portal/leads?${searchParams.toString()}`,
      );
    });
  }

  async getLead(leadId: string): Promise<ApiResponse<Lead>> {
    if (!isValidId(leadId)) {
      return { success: false, error: "Invalid lead ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<Lead>(`/api/professional-portal/leads/${leadId}`),
    );
  }

  async createLead(
    data: CreateLeadClientInput,
  ): Promise<ApiResponse<LeadList>> {
    const { idempotencyKey, ...payload } = data;
    return this.bulkhead.run(() =>
      apiFetch<LeadList>("/api/professional-portal/leads", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateLead(
    input: UpdateLeadClientInput,
  ): Promise<ApiResponse<Lead>> {
    if (!isValidId(input.leadId)) {
      return { success: false, error: "Invalid lead ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<Lead>(
        `/api/professional-portal/leads/${input.leadId}`,
        {
          method: "PATCH",
          body: JSON.stringify(input.data),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      ),
    );
  }

  async deleteLead(
    input: DeleteLeadClientInput,
  ): Promise<ApiResponse<DeleteLeadResponse>> {
    if (!isValidId(input.leadId)) {
      return { success: false, error: "Invalid lead ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<DeleteLeadResponse>(
        `/api/professional-portal/leads/${input.leadId}`,
        {
          method: "DELETE",
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      ),
    );
  }
}

export const leadsClient = new LeadsClient();
export default leadsClient;
