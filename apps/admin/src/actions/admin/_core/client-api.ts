"use server";

import { adminEnvConfig } from "@/lib/infrastructure/env";

const CLIENT_API_BASE_URL =
  adminEnvConfig.CLIENT_APP_URL ?? "http://localhost:3500";

export interface ClientApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

const DEFAULT_CLIENT_API_TIMEOUT_MS = 30_000;
const MIN_CLIENT_API_TIMEOUT_MS = 1_000;
const MAX_CLIENT_API_TIMEOUT_MS = 60_000;

function normalizeClientApiTimeout(timeout: number | undefined): number {
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
    return DEFAULT_CLIENT_API_TIMEOUT_MS;
  }

  const normalizedTimeout = Math.trunc(timeout);

  if (normalizedTimeout < MIN_CLIENT_API_TIMEOUT_MS) {
    return MIN_CLIENT_API_TIMEOUT_MS;
  }

  if (normalizedTimeout > MAX_CLIENT_API_TIMEOUT_MS) {
    return MAX_CLIENT_API_TIMEOUT_MS;
  }

  return normalizedTimeout;
}

export async function callClientApi<T>(
  endpoint: string,
  options: ClientApiOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const requestTimeoutMs = normalizeClientApiTimeout(options.timeout);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const url = `${CLIENT_API_BASE_URL}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: undefined, message: undefined }));
      throw new Error(
        (errorData as { error?: string; message?: string }).error ||
          (errorData as { error?: string; message?: string }).message ||
          `API request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request to ${endpoint} timed out after ${requestTimeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
