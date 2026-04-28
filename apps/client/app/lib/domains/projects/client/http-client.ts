import { z } from "zod";
import type { ApiResponse } from "@build/types";

export type ApiFetchSpec<T> = {
  endpoint: string;
  operation: string;
  schema: z.ZodType<T>;
  options?: RequestInit;
  normalize?: (payload: unknown) => unknown;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15000;

function summarizeZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function apiFetch<T>(
  spec: ApiFetchSpec<T>,
): Promise<ApiResponse<T>> {
  const { endpoint, operation, schema, options, normalize, timeoutMs } = spec;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `${operation} failed (${response.status})`,
      };
    }

    const payload = json?.data !== undefined ? json.data : json;
    let normalized: unknown = payload;
    if (normalize) {
      try {
        normalized = normalize(payload);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            error: `Contract normalization failed for ${operation} at ${endpoint}: ${summarizeZodIssues(error)}`,
          };
        }
        return {
          success: false,
          error: `Contract normalization failed for ${operation} at ${endpoint}`,
        };
      }
    }
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      return {
        success: false,
        error: `Contract validation failed for ${operation} at ${endpoint}: ${summarizeZodIssues(parsed.error)}`,
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        error: `${operation} timed out after ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
