import type { DomainError, Result } from "@/app/lib/errors/result";

export type PortfolioDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "limit_exceeded"
  | "project_not_found"
  | "asset_not_found"
  | "asset_forbidden"
  | "image_not_found";

export type PortfolioDomainError = DomainError<PortfolioDomainErrorCode>;
export type PortfolioResult<T> = Result<T, PortfolioDomainError>;

export type PortfolioImageDto = {
  id: string;
  url: string;
  key: string | null;
  caption: string | null;
  isMain: boolean;
  isBefore: boolean;
  isAfter: boolean;
  sortOrder: number;
  createdAt: string;
};

export type PortfolioListItemDto = {
  id: string;
  title: string;
  description: string | null;
  projectType: string;
  slug: string | null;
  tags: string[];
  location: string | null;
  county: string | null;
  budget: number | null;
  currency: string | null;
  isVerified: boolean;
  clientTestimonial: string | null;
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
  images: PortfolioImageDto[];
  _count: { images: number };
};

export type PortfolioDetailDto = PortfolioListItemDto & {
  completedAt: string | null;
  professional?: {
    companyName: string;
    city: string | null;
    county: string | null;
    country: string | null;
  } | null;
};

export type PortfolioListResultDto = {
  portfolios: PortfolioListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
