import { env } from "@/app/lib/infrastructure/env";
import { recordMiddlewareFallback } from "@/app/lib/auth/telemetry-metrics";

export type SystemSettingsSnapshot = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  publicSignup: boolean;
  allowProfessionalSignup: boolean;
  allowedIPs: string[];
};

export type SystemSettingsResult = {
  state: "resolved" | "fallback";
  settings: SystemSettingsSnapshot;
  source: "internal_api" | "fallback";
  reason:
    | "internal_secret_missing"
    | "internal_api_error"
    | "internal_api_non_ok"
    | "internal_api_resolved";
  cacheStrategy: "shared_service_or_metadata" | "none";
};

const DEFAULT_SETTINGS: SystemSettingsSnapshot = {
  maintenanceMode: false,
  maintenanceMessage: null,
  publicSignup: true,
  allowProfessionalSignup: true,
  allowedIPs: [],
};

let cachedResult: { result: SystemSettingsResult; expiresAt: number } | null =
  null;

/**
 * Clear the in-memory system settings cache (useful for testing).
 */
export function clearSystemSettingsCache(): void {
  cachedResult = null;
}

export async function resolveSystemSettings(
  baseUrl: string,
): Promise<SystemSettingsResult> {
  const now = Date.now();
  if (
    process.env.NODE_ENV !== "test" && // bootstrap:only use cached result for performance
    cachedResult &&
    now < cachedResult.expiresAt
  ) {
    return cachedResult.result;
  }

  const internalSecret = env.services.internalApiSecret;
  if (!internalSecret) {
    recordMiddlewareFallback(
      "/middleware/system-settings",
      "settings_fallback_secret_missing",
    );
    const result: SystemSettingsResult = {
      state: "fallback",
      settings: DEFAULT_SETTINGS,
      source: "fallback",
      reason: "internal_secret_missing",
      cacheStrategy: "shared_service_or_metadata",
    };
    cachedResult = { result, expiresAt: now + 5000 };
    return result;
  }

  try {
    // Normalize localhost to 127.0.0.1 to avoid IPv6 (::1) ECONNREFUSED when servers bind to IPv4
    const resolvedBase = baseUrl.replace("://localhost:", "://127.0.0.1:");
    const url = new URL("/api/internal/system-settings", resolvedBase);
    const response = await fetch(url.toString(), {
      headers: { "x-internal-secret": internalSecret },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });

    if (!response.ok) {
      recordMiddlewareFallback(
        "/middleware/system-settings",
        "settings_fallback_non_ok",
      );
      const result: SystemSettingsResult = {
        state: "fallback",
        settings: DEFAULT_SETTINGS,
        source: "fallback",
        reason: "internal_api_non_ok",
        cacheStrategy: "shared_service_or_metadata",
      };
      cachedResult = { result, expiresAt: now + 3000 };
      return result;
    }

    const data = await response.json();
    const result: SystemSettingsResult = {
      state: "resolved",
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
      settings: {
        maintenanceMode: data.maintenanceMode ?? false,
        maintenanceMessage: data.maintenanceMessage ?? null,
        publicSignup: data.publicSignup ?? true,
        allowProfessionalSignup: data.allowProfessionalSignup ?? true,
        allowedIPs: Array.isArray(data.allowedIPs) ? data.allowedIPs : [],
      },
    };
    cachedResult = { result, expiresAt: now + 10000 };
    return result;
  } catch {
    recordMiddlewareFallback(
      "/middleware/system-settings",
      "settings_fallback_error",
    );
    const result: SystemSettingsResult = {
      state: "fallback",
      settings: DEFAULT_SETTINGS,
      source: "fallback",
      reason: "internal_api_error",
      cacheStrategy: "shared_service_or_metadata",
    };
    cachedResult = { result, expiresAt: now + 3000 };
    return result;
  }
}
