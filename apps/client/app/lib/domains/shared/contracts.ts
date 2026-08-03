/**
 * Shared Portal Domain Contracts & DTOs
 *
 * Provides canonical, standardized types for pagination, filtering, sorting,
 * and data export across all professional portal bounded domains (ADR-002).
 */

export type SortOrder = "asc" | "desc";

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalPages: number;
};

export type FilterOperator =
  "equals" | "contains" | "in" | "between" | "greater_than" | "less_than";

export type FilterCriterion = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

export type QueryFilterParams = {
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: FilterCriterion[];
  pagination?: PaginationParams;
};

export type ExportFormat = "csv" | "json" | "pdf";

export type ExportRequestParams = QueryFilterParams & {
  format: ExportFormat;
  exportScope?: "all" | "selected" | "page";
  selectedIds?: string[];
};

export type ExportJobResult = {
  jobId: string;
  downloadUrl?: string;
  status: "completed" | "processing" | "failed";
  recordCount: number;
};
