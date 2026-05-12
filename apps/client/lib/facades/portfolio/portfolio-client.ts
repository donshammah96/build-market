/**
 * Portfolio Client (browser-safe)
 *
 * Uses REST fetch() via apiFetch against /api/professional-portal/portfolio.
 * Types aligned to domain DTOs; no DTO repair.
 */
import type { ApiResponse } from "@build/types";
import {
  apiFetch,
  ConcurrencyLimiter,
  unwrapApiResponse,
} from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/links";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import {
  PortfolioQuerySchema,
  CreatePortfolioSchema,
  UpdatePortfolioSchema,
  ProjectTypeSchema,
} from "@/validation/portfolio-validation";
import type {
  PortfolioDetailDto,
  PortfolioListItemDto,
  PortfolioListResultDto,
} from "@/domains/portfolio/contracts";

export type PortfolioQueryInput = z.infer<typeof PortfolioQuerySchema>;
export type CreatePortfolioInput = z.input<typeof CreatePortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof UpdatePortfolioSchema>;
export type ProjectTypeValue = z.infer<typeof ProjectTypeSchema>;

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

/** Alias for list items — compatible with PortfolioListItemDto */
export type PortfolioItem = PortfolioListItemDto;

/** Alias for detail — compatible with PortfolioDetailDto */
export type PortfolioDetail = PortfolioDetailDto;

type PortfolioDetailImageWire =
  | PortfolioDetailDto["images"][number]
  | {
      id?: string;
      category?: string | null;
      isMain?: boolean;
      sortOrder?: number;
      createdAt?: string;
      asset?: {
        cdnUrl?: string | null;
        thumbnailUrl?: string | null;
      } | null;
      url?: string;
      key?: string | null;
      caption?: string | null;
      isBefore?: boolean;
      isAfter?: boolean;
    };

type PortfolioDetailWire = Omit<
  PortfolioDetailDto,
  "images" | "completedAt"
> & {
  completedAt?: string | null;
  completionDate?: string | null;
  images?: PortfolioDetailImageWire[];
};

function toPortfolioDetailDto(detail: PortfolioDetailWire): PortfolioDetailDto {
  return {
    ...detail,
    completedAt: detail.completedAt ?? detail.completionDate ?? null,
    images: (detail.images ?? []).map((image, index) => {
      const assetCdnUrl =
        "asset" in image ? (image.asset?.cdnUrl ?? undefined) : undefined;
      const assetThumbnailUrl =
        "asset" in image ? (image.asset?.thumbnailUrl ?? undefined) : undefined;
      const normalizedUrl = image.url ?? assetCdnUrl ?? assetThumbnailUrl ?? "";
      const imageCategory =
        "category" in image && typeof image.category === "string"
          ? image.category.toUpperCase()
          : undefined;

      return {
        id: image.id ?? `image-${index}`,
        url: normalizedUrl,
        key: image.key ?? null,
        caption: image.caption ?? null,
        isMain: image.isMain ?? index === 0,
        isBefore: image.isBefore ?? imageCategory === "BEFORE",
        isAfter: image.isAfter ?? imageCategory === "AFTER",
        sortOrder: image.sortOrder ?? index,
        createdAt: image.createdAt ?? new Date(0).toISOString(),
      };
    }),
  };
}

class PortfolioClient {
  private readonly bulkhead = new ConcurrencyLimiter(5);

  async getPortfolios(
    filters?: Partial<PortfolioQueryInput>,
  ): Promise<ApiResponse<PortfolioListItemDto[]>> {
    return this.bulkhead.run(async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.append(k, String(v));
        });
      }
      const response = await apiFetch<PortfolioListResultDto>(
        `${API_ROUTES.professionalPortalPortfolio}?${params.toString()}`,
      );

      if (!response.success) {
        return { success: false, error: response.error };
      }

      return {
        success: true,
        data: response.data?.portfolios ?? [],
      };
    });
  }

  async getPortfolio(
    portfolioId: string,
  ): Promise<ApiResponse<PortfolioDetailDto>> {
    if (!isValidId(portfolioId)) {
      return { success: false, error: "Invalid portfolio ID" };
    }
    return this.bulkhead.run(async () => {
      const response = await apiFetch<PortfolioDetailWire>(
        API_ROUTES.professionalPortalPortfolioDetail(portfolioId),
      );

      if (!response.success) {
        return { success: false, error: response.error };
      }

      if (!response.data) {
        return { success: false, error: "Portfolio detail not found" };
      }

      return {
        success: true,
        data: toPortfolioDetailDto(response.data),
      };
    });
  }

  async getPortfolioDetail(
    portfolioId: string,
  ): Promise<ApiResponse<PortfolioDetailDto>> {
    return this.getPortfolio(portfolioId);
  }

  async createPortfolio(
    input: CreatePortfolioClientInput,
  ): Promise<ApiResponse<PortfolioListItemDto>> {
    const { idempotencyKey, ...payload } = input;
    return this.bulkhead.run(() =>
      apiFetch<PortfolioListItemDto>(API_ROUTES.professionalPortalPortfolio, {
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
  ): Promise<ApiResponse<PortfolioDetailDto>> {
    if (!isValidId(input.portfolioId)) {
      return { success: false, error: "Invalid portfolio ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<PortfolioDetailDto>(
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
