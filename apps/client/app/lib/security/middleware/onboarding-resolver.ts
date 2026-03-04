import { normalizeRole, type AppRole } from "@/app/lib/security/roles";

export type OnboardingResolutionMode = "strict" | "lenient";

export type OnboardingStatus = {
  state: "resolved" | "indeterminate";
  isOnboarded: boolean;
  role?: AppRole;
  source: "metadata" | "internal_api" | "fallback";
  confidence: "high" | "medium" | "low";
  reason:
    | "metadata_present"
    | "internal_secret_missing"
    | "internal_api_error"
    | "internal_api_non_ok"
    | "internal_api_resolved";
};

export async function resolveOnboardingStatus(
  clerkId: string,
  metadata: { isOnboarded?: boolean; role?: string } | undefined,
  baseUrl: string,
  mode: OnboardingResolutionMode = "strict",
): Promise<OnboardingStatus> {
  const metadataRole = normalizeRole(metadata?.role);
  if (typeof metadata?.isOnboarded === "boolean") {
    return {
      state: "resolved",
      isOnboarded: metadata.isOnboarded,
      role: metadataRole,
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    };
  }

  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    return {
      state: mode === "strict" ? "resolved" : "indeterminate",
      isOnboarded: false,
      role: metadataRole,
      source: "fallback",
      confidence: "low",
      reason: "internal_secret_missing",
    };
  }

  try {
    const url = new URL("/api/internal/user-status", baseUrl);
    url.searchParams.set("clerkId", clerkId);

    const response = await fetch(url.toString(), {
      headers: { "x-internal-secret": internalSecret },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        state: mode === "strict" ? "resolved" : "indeterminate",
        isOnboarded: false,
        role: metadataRole,
        source: "fallback",
        confidence: "low",
        reason: "internal_api_non_ok",
      };
    }

    const data = await response.json();
    return {
      state: "resolved",
      isOnboarded: data.isOnboarded ?? false,
      role: normalizeRole(data.role) ?? metadataRole,
      source: "internal_api",
      confidence: "medium",
      reason: "internal_api_resolved",
    };
  } catch {
    return {
      state: mode === "strict" ? "resolved" : "indeterminate",
      isOnboarded: false,
      role: metadataRole,
      source: "fallback",
      confidence: "low",
      reason: "internal_api_error",
    };
  }
}
