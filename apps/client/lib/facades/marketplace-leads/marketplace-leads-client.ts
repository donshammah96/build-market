/**
 * Marketplace Leads Client Facade
 *
 * Client-side facade for homeowner marketplace leads and professional routing.
 * Uses browser-safe REST APIs with client-side concurrency control.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import type {
  ClientLeadStatusDTO,
  CreateMarketplaceLeadInput,
  DisclosedMarketplaceLeadDTO,
  MaskedMarketplaceLeadDTO,
  UpdateMarketplaceLeadQualificationInput,
  AttachMarketplaceLeadDocumentInput,
} from "@/app/lib/domains/marketplace-leads";

const BULKHEAD_CONCURRENCY = 6;

class MarketplaceLeadsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  // ─── Homeowner Client Endpoints ──────────────────────────────────────────

  async listClientLeads(): Promise<ApiResponse<ClientLeadStatusDTO[]>> {
    return this.bulkhead.run(async () => {
      return apiFetch<ClientLeadStatusDTO[]>("/api/leads/qualification");
    });
  }

  async getClientLead(
    leadId: string,
  ): Promise<ApiResponse<ClientLeadStatusDTO>> {
    return this.bulkhead.run(async () => {
      return apiFetch<ClientLeadStatusDTO>(
        `/api/leads/qualification/${leadId}`,
      );
    });
  }

  async createDraftLead(
    input: CreateMarketplaceLeadInput,
    idempotencyKey?: string,
  ): Promise<ApiResponse<ClientLeadStatusDTO>> {
    return this.bulkhead.run(async () => {
      return apiFetch<ClientLeadStatusDTO>("/api/leads/qualification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(input),
      });
    });
  }

  async updateQualification(
    leadId: string,
    input: UpdateMarketplaceLeadQualificationInput,
    idempotencyKey?: string,
  ): Promise<ApiResponse<ClientLeadStatusDTO>> {
    return this.bulkhead.run(async () => {
      return apiFetch<ClientLeadStatusDTO>(
        `/api/leads/qualification/${leadId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(input),
        },
      );
    });
  }

  async attachDocument(
    leadId: string,
    input: AttachMarketplaceLeadDocumentInput,
    idempotencyKey?: string,
  ): Promise<ApiResponse<{ documentId: string; scanStatus: string }>> {
    return this.bulkhead.run(async () => {
      return apiFetch<{ documentId: string; scanStatus: string }>(
        `/api/leads/qualification/${leadId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(input),
        },
      );
    });
  }

  async submitLead(
    leadId: string,
    idempotencyKey?: string,
  ): Promise<ApiResponse<ClientLeadStatusDTO>> {
    return this.bulkhead.run(async () => {
      return apiFetch<ClientLeadStatusDTO>(
        `/api/leads/qualification/${leadId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
        },
      );
    });
  }

  // ─── Professional Routing Endpoints ─────────────────────────────────────

  async listRoutedLeadsForProfessional(): Promise<
    ApiResponse<MaskedMarketplaceLeadDTO[]>
  > {
    return this.bulkhead.run(async () => {
      return apiFetch<MaskedMarketplaceLeadDTO[]>(
        "/api/leads/qualification/routing",
      );
    });
  }

  async acceptRoutedLead(
    routingEventId: string,
    idempotencyKey?: string,
  ): Promise<ApiResponse<DisclosedMarketplaceLeadDTO>> {
    return this.bulkhead.run(async () => {
      return apiFetch<DisclosedMarketplaceLeadDTO>(
        `/api/leads/qualification/routing/${routingEventId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
        },
      );
    });
  }

  async declineRoutedLead(
    routingEventId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return this.bulkhead.run(async () => {
      return apiFetch<{ success: true }>(
        `/api/leads/qualification/routing/${routingEventId}/decline`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });
  }
}

export const marketplaceLeadsClient = new MarketplaceLeadsClient();
