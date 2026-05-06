/**
 * Public Leads Client
 *
 * Client-side facade for the public leads API. Used by contact forms
 * on professional profiles. No authentication required.
 *
 *   publicLeadsClient (this file)
 *     └── API Routes (/api/leads)
 *           └── Domain Layer (app/lib/domains/leads/service.ts)
 *                 └── Prisma (Lead)
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type { z } from "zod";
import { CreatePublicLeadSchema } from "@/app/lib/validation/leads-validation";

// ─── Input Types (derived from validation schema) ─────────────────────────

export type CreatePublicLeadInput = z.infer<typeof CreatePublicLeadSchema>;

// ─── Response Types (aligned with API) ────────────────────────────────────

export interface PublicLeadCreateResult {
  message: string;
  lead: {
    id: string;
    projectType: string;
    status: string;
    createdAt: string;
  };
}

export interface PublicLeadStatusResult {
  id: string;
  title: string;
  projectType: string;
  location: string | null;
  status: string;
  statusLabel: string;
  professionalName: string;
  submittedAt: string;
  lastUpdated: string;
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const publicLeadsClient = {
  /** Submit a new lead inquiry to a professional. No auth required. */
  async submit(
    input: CreatePublicLeadInput,
  ): Promise<ApiResponse<PublicLeadCreateResult>> {
    return apiFetch<PublicLeadCreateResult>(API_ROUTES.leads, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Get the status of a previously submitted lead by ID. */
  async getStatus(id: string): Promise<ApiResponse<PublicLeadStatusResult>> {
    return apiFetch<PublicLeadStatusResult>(API_ROUTES.leadDetail(id));
  },
};
