import { env } from "@/app/lib/infrastructure/env";

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

export async function resolveSystemSettings(
  baseUrl: string,
): Promise<SystemSettingsResult> {
  const internalSecret = env.services.internalApiSecret;
  if (!internalSecret) {
    return {
      state: "fallback",
      settings: DEFAULT_SETTINGS,
      source: "fallback",
      reason: "internal_secret_missing",
      cacheStrategy: "shared_service_or_metadata",
    };
  }

  try {
    const url = new URL("/api/internal/system-settings", baseUrl);
    const response = await fetch(url.toString(), {
      headers: { "x-internal-secret": internalSecret },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        state: "fallback",
        settings: DEFAULT_SETTINGS,
        source: "fallback",
        reason: "internal_api_non_ok",
        cacheStrategy: "shared_service_or_metadata",
      };
    }

    const data = await response.json();
    return {
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
  } catch {
    return {
      state: "fallback",
      settings: DEFAULT_SETTINGS,
      source: "fallback",
      reason: "internal_api_error",
      cacheStrategy: "shared_service_or_metadata",
    };
  }
}
