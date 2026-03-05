/**
 * Professionals Client
 *
 * Client-side facade for the public professionals subsystem.
 * Provides a resilient, type-safe API that interacts directly with
 * browser-safe REST APIs.
 *
 * Features:
 * - Bulkhead (concurrency limiter)
 * - Normalized ApiResponse format
 * - Safe for browser and client-side bundlers (No Server Actions)
 */
import type { ApiResponse } from "@build/types";
import { PROFESSIONALS_CLIENT_CONFIG } from "@/lib/config/professional.config";
import { isValidId } from "@/lib/utils/validators";
import type { z } from "zod";
import { ProfessionalQuerySchema } from "@/lib/validation/professionals-validation";

const { BULKHEAD_CONCURRENCY } = PROFESSIONALS_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type ProfessionalQueryInput = z.infer<typeof ProfessionalQuerySchema>;

// ─── Helper API Fetcher ─────────────────────────────────────────────────────

async function apiFetch<T>(
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
          `API Error: ${res.statusText}`,
      };
    }

    return { success: true, data: json?.data !== undefined ? json.data : json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Concurrency Limiter (Bulkhead Pattern) ─────────────────────────────────

class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

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

// ─── Professionals Client ───────────────────────────────────────────────────

class ProfessionalsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getProfessionals(
    filters?: Partial<ProfessionalQueryInput>,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<any>(`/api/professionals?${searchParams.toString()}`);
    });
  }

  async getProfessional(userId: string): Promise<ApiResponse<any>> {
    if (!isValidId(userId)) {
      return { success: false, error: "Invalid professional ID" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/professionals/${userId}`),
    );
  }
}

export const professionalsClient = new ProfessionalsClient();
export default professionalsClient;
