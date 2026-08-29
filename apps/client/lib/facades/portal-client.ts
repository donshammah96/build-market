/**
 * Professional Portal Client Facade (ADR-002 / ADR-005)
 *
 * Client-side facade for the professional portal subsystem.
 * Interacts with browser-safe API endpoints with concurrency management,
 * structured API response envelopes, and optimistic state reconciliation.
 */

import type { ApiResponse } from "@build/types";
import type { ProfessionalCapabilityContext } from "@/app/lib/domains/professionals/capability.service";
import type {
  PaginatedResult,
  QueryFilterParams,
} from "@/app/lib/domains/shared/contracts";

class PortalConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number = 6) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      next?.();
    }
  }
}

async function portalApiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `HTTP Error: ${res.status}`,
      };
    }

    return {
      success: true,
      data: json?.data !== undefined ? json.data : json,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export class ProfessionalPortalClient {
  private readonly limiter = new PortalConcurrencyLimiter(6);

  /**
   * Fetch current capability context for the authenticated professional.
   */
  async getCapabilityContext(): Promise<
    ApiResponse<ProfessionalCapabilityContext>
  > {
    return this.limiter.run(() =>
      portalApiFetch<ProfessionalCapabilityContext>(
        "/api/professional-portal/capabilities",
      ),
    );
  }

  /**
   * Generic paginated portal module data fetcher.
   */
  async getModuleData<T>(
    moduleName: string,
    params?: QueryFilterParams,
  ): Promise<ApiResponse<PaginatedResult<T>>> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params?.pagination?.page)
      searchParams.set("page", String(params.pagination.page));
    if (params?.pagination?.pageSize)
      searchParams.set("pageSize", String(params.pagination.pageSize));

    const url = `/api/professional-portal/${moduleName}?${searchParams.toString()}`;
    return this.limiter.run(() => portalApiFetch<PaginatedResult<T>>(url));
  }

  /**
   * Submit module mutation with optimistic updates.
   */
  async mutateModuleData<TData, TResult = TData>(
    moduleName: string,
    action: string,
    payload: TData,
  ): Promise<ApiResponse<TResult>> {
    const url = `/api/professional-portal/${moduleName}/${action}`;
    return this.limiter.run(() =>
      portalApiFetch<TResult>(url, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  }
}

export const professionalPortalClient = new ProfessionalPortalClient();
