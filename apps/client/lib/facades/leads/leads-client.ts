/**
 * Leads Client
 *
 * Client-side facade for the professional-portal leads subsystem.
 * Uses browser-safe REST APIs with client-side concurrency control.
 * Types aligned to domain DTOs.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { LEADS_CLIENT_CONFIG } from "@/config/lead.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  LeadQuerySchema,
  CreateLeadSchema,
  UpdateLeadSchema,
} from "@/validation/leads-validation";
import type {
  LeadDetailResult,
  LeadListResult,
  LeadListItem,
} from "@/domains/leads/contracts";

const { BULKHEAD_CONCURRENCY } = LEADS_CLIENT_CONFIG;

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

export type DeleteLeadResponse = {
  message: string;
  leadId: string;
};

export type { LeadListResult, LeadDetailResult, LeadListItem };

// ─── Leads Client ──────────────────────────────────────────────────────────

class LeadsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getLeads(
    filters?: Partial<LeadQueryInput>,
  ): Promise<ApiResponse<LeadListResult>> {
    return this.bulkhead.run(async () => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<LeadListResult>(
        `/api/professional-portal/leads?${searchParams.toString()}`,
      );
    });
  }

  async getLead(leadId: string): Promise<ApiResponse<LeadDetailResult>> {
    if (!isValidId(leadId)) {
      return { success: false, error: "Invalid lead ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<LeadDetailResult>(`/api/professional-portal/leads/${leadId}`),
    );
  }

  async createLead(
    data: CreateLeadClientInput,
  ): Promise<ApiResponse<LeadListItem>> {
    const { idempotencyKey, ...payload } = data;
    return this.bulkhead.run(() =>
      apiFetch<LeadListItem>("/api/professional-portal/leads", {
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
  ): Promise<ApiResponse<LeadDetailResult>> {
    if (!isValidId(input.leadId)) {
      return { success: false, error: "Invalid lead ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<LeadDetailResult>(
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
