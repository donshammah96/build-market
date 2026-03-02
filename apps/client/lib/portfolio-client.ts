/**
 * Portfolio Client (browser-safe)
 *
 * - No Server Action imports
 * - Uses REST fetch() via apiFetch against /api/professional-portal/portfolio
 * - Derives input types from Zod validation schemas
 * - Normalizes ApiResponse<T>
 */
import type { ApiResponse } from "@build/types";
import {
  apiFetch,
  ConcurrencyLimiter,
  unwrapApiResponse,
} from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/links";
import { isValidId } from "@/app/lib/utils/validators";
import type { z } from "zod";
import {
  PortfolioQuerySchema,
  CreatePortfolioSchema,
  UpdatePortfolioSchema,
  ProjectTypeSchema,
} from "@/app/lib/validation/portfolio-validation";

// ─── Input Types (Derived locally to avoid server imports) ────────────────────
//
// CreatePortfolioInput uses z.input<> (the PRE-transform type) so that fields
// with .default() — tags, currency, durationUnit, projectType — are optional
// for callers, matching what the API route actually accepts.

export type PortfolioQueryInput = z.infer<typeof PortfolioQuerySchema>;
export type CreatePortfolioInput = z.input<typeof CreatePortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof UpdatePortfolioSchema>;

/**
 * Page-safe ProjectType string union — no @prisma/client import needed.
 * Derived directly from the Zod schema that wraps the Prisma enum.
 */
export type ProjectTypeValue = z.infer<typeof ProjectTypeSchema>;

/** Enriched creation payload — images are resolved URLs from the upload step. */
export type CreatePortfolioClientInput = CreatePortfolioInput & {
  images?: string[];
  idempotencyKey?: string;
};

export type UpdatePortfolioClientInput = {
  portfolioId: string;
  data: UpdatePortfolioInput;
  idempotencyKey?: string;
};

export type DeletePortfolioClientInput = {
  portfolioId: string;
  idempotencyKey?: string;
};

/** Minimal PortfolioItem shape returned from list/detail endpoints. */
export interface PortfolioItem {
  id: string;
  title: string;
  description?: string | null;
  projectType: string;
  slug?: string | null;
  tags?: string[];
  location?: string | null;
  county?: string | null;
  budget?: number | null;
  currency?: string | null;
  isVerified?: boolean;
  clientTestimonial?: string | null;
  clientName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Images may be a JSON array string (legacy) or resolved image objects. */
  images: string[] | string | PortfolioImageItem[];
  _count?: { images: number };
}

export interface PortfolioImageItem {
  id: string;
  caption?: string | null;
  category?: string;
  isMain?: boolean;
  sortOrder?: number;
  asset?: {
    cdnUrl?: string | null;
    thumbnailUrl?: string | null;
  };
}

// ─── Portfolio Client ──────────────────────────────────────────────────────

class PortfolioClient {
  private readonly bulkhead = new ConcurrencyLimiter(5);

  async getPortfolios(
    filters?: Partial<PortfolioQueryInput>,
  ): Promise<ApiResponse<PortfolioItem[]>> {
    return this.bulkhead.run(async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.append(k, String(v));
        });
      }
      return apiFetch<PortfolioItem[]>(
        `${API_ROUTES.professionalPortalPortfolio}?${params.toString()}`,
      );
    });
  }

  async getPortfolio(portfolioId: string): Promise<ApiResponse<PortfolioItem>> {
    if (!isValidId(portfolioId)) {
      return { success: false, error: "Invalid portfolio ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<PortfolioItem>(
        API_ROUTES.professionalPortalPortfolioDetail(portfolioId),
      ),
    );
  }

  async createPortfolio(
    input: CreatePortfolioClientInput,
  ): Promise<ApiResponse<PortfolioItem>> {
    const { idempotencyKey, ...payload } = input;
    return this.bulkhead.run(() =>
      apiFetch<PortfolioItem>(API_ROUTES.professionalPortalPortfolio, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      }),
    );
  }

  async updatePortfolio(
    input: UpdatePortfolioClientInput,
  ): Promise<ApiResponse<PortfolioItem>> {
    if (!isValidId(input.portfolioId)) {
      return { success: false, error: "Invalid portfolio ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<PortfolioItem>(
        API_ROUTES.professionalPortalPortfolioDetail(input.portfolioId),
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

  async deletePortfolio(
    input: DeletePortfolioClientInput,
  ): Promise<ApiResponse<void>> {
    if (!isValidId(input.portfolioId)) {
      return { success: false, error: "Invalid portfolio ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<void>(
        API_ROUTES.professionalPortalPortfolioDetail(input.portfolioId),
        {
          method: "DELETE",
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      ),
    );
  }

  /** Upload image files and return CDN URLs. Uses the uploads API. */
  async uploadImages(files: File[], fieldName = "images"): Promise<string[]> {
    const form = new FormData();
    files.forEach((f) => form.append(fieldName, f));

    const res = await fetch(API_ROUTES.uploads, { method: "POST", body: form });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Upload failed with ${res.status}`);
    }
    const json = await res.json();
    return (
      json.data?.uploaded?.[fieldName]?.map((i: { url: string }) => i.url) || []
    );
  }
}

export const portfolioClient = new PortfolioClient();
export default portfolioClient;
export { unwrapApiResponse };
