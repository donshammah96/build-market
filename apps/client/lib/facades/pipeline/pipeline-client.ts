/**
 * Pipeline Client (browser-safe)
 *
 * Client-side facade for the professional-portal pipeline summary endpoint.
 * Uses REST fetch() via apiFetch.
 */
import type { ApiResponse } from "@build/types";
import {
  apiFetch,
  ConcurrencyLimiter,
  unwrapApiResponse,
} from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/links";

// ─── Pipeline Types ─────────────────────────────────────────────────────────

export interface PipelineStageData {
  id: string;
  count: number;
  value: number;
}

export interface PipelineSummary {
  stages: PipelineStageData[];
  totalValue: number;
}

// ─── Pipeline Client ────────────────────────────────────────────────────────

class PipelineClient {
  private readonly bulkhead = new ConcurrencyLimiter(3);

  async getPipelineSummary(): Promise<ApiResponse<PipelineSummary>> {
    return this.bulkhead.run(() =>
      apiFetch<PipelineSummary>(API_ROUTES.professionalPortalPipeline),
    );
  }
}

export const pipelineClient = new PipelineClient();
export default pipelineClient;
export { unwrapApiResponse };
