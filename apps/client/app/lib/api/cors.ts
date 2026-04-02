import { NextResponse } from "next/server";
import { getEnvConfig } from "@/app/lib/infrastructure/env";

const ALLOWED_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With";
const PREFLIGHT_MAX_AGE_SECONDS = "3600";
const DEFAULT_VARY_HEADER =
  "Origin, Access-Control-Request-Method, Access-Control-Request-Headers";

/**
 * Allowed origins for CORS
 */
const getAllowedOrigins = (): string[] => {
  const env = getEnvConfig();
  const origins = new Set<string>();

  for (const value of [env.appUrl, env.apiUrl]) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed env values here; env validation owns fail-fast behavior.
    }
  }

  for (const origin of env.cors.allowedOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  if (env.isDev) {
    for (const origin of env.cors.devAllowedOrigins) {
      const normalized = normalizeOrigin(origin);
      if (normalized) {
        origins.add(normalized);
      }
    }
  }

  return Array.from(origins);
};

/**
 * Generate CORS headers for a given origin
 */
export function corsHeaders(
  requestOrigin?: string | null,
): Partial<Record<string, string>> {
  const normalizedOrigin = normalizeOrigin(requestOrigin);
  const headers: Partial<Record<string, string>> = {
    Vary: DEFAULT_VARY_HEADER,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": PREFLIGHT_MAX_AGE_SECONDS,
  };

  if (!normalizedOrigin || !isAllowedOrigin(normalizedOrigin)) {
    return headers;
  }

  return {
    ...headers,
    "Access-Control-Allow-Origin": normalizedOrigin,
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * True when the request origin is trusted for credentialed cross-origin access.
 */
export function isCorsOriginAllowed(origin?: string | null): boolean {
  return isAllowedOrigin(origin);
}

/**
 * Apply CORS headers to a NextResponse
 */
export function withCors(
  response: NextResponse,
  requestOrigin?: string | null,
): NextResponse {
  const headers = corsHeaders(requestOrigin);

  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  return response;
}

/**
 * Shared preflight handler factory for routes that intentionally expose CORS.
 */
export function createCorsPreflightHandler() {
  return function OPTIONS(request: Request): NextResponse {
    return handleCorsPreFlight(request.headers.get("origin"));
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreFlight(
  requestOrigin?: string | null,
): NextResponse {
  const response = new NextResponse(null, {
    status: isAllowedOrigin(requestOrigin) ? 204 : 403,
  });
  return withCors(response, requestOrigin);
}

const normalizeOrigin = (origin?: string | null): string | null => {
  if (!origin || origin === "null") {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
};

const isAllowedOrigin = (origin?: string | null): origin is string => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getAllowedOrigins().includes(normalizedOrigin);
};
