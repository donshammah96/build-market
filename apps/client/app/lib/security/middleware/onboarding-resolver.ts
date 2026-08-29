import { normalizeRole, type AppRole } from "@/app/lib/security/roles";
import { env } from "@/app/lib/infrastructure/env";
import { recordMiddlewareFallback } from "@/app/lib/auth/telemetry-metrics";

const OPERATION_NAME = "resolve_onboarding_status";

function logOnboardingResolverOutcome(
  level: "info" | "warn",
  payload: Record<string, unknown>,
) {
  const logEvent = {
    operationName: OPERATION_NAME,
    ...payload,
  };

  if (level === "warn") {
    console.warn("Onboarding resolver outcome", logEvent);
    return;
  }

  console.info("Onboarding resolver outcome", logEvent);
}

export type OnboardingResolutionMode = "strict" | "lenient";

export type OnboardingStatus = {
  state: "resolved" | "indeterminate";
  isOnboarded: boolean;
  role?: AppRole;
  status?: string;
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
  metadata:
    { isOnboarded?: boolean; role?: string; status?: string } | undefined,
  baseUrl: string,
  mode: OnboardingResolutionMode = "strict",
): Promise<OnboardingStatus> {
  const startedAt = Date.now();
  const metadataRole = normalizeRole(metadata?.role);
  const metadataStatus =
    typeof metadata?.status === "string"
      ? metadata.status.toUpperCase()
      : undefined;
  if (typeof metadata?.isOnboarded === "boolean") {
    return {
      state: "resolved",
      isOnboarded: metadata.isOnboarded,
      role: metadataRole,
      status: metadataStatus,
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    };
  }

  const internalSecret = env.services.internalApiSecret;
  if (!internalSecret) {
    const fallbackResult: OnboardingStatus = {
      state: mode === "strict" ? "resolved" : "indeterminate",
      isOnboarded: false,
      role: metadataRole,
      status: metadataStatus,
      source: "fallback",
      confidence: "low",
      reason: "internal_secret_missing",
    };

    logOnboardingResolverOutcome("warn", {
      outcome: "fallback",
      reason: fallbackResult.reason,
      source: fallbackResult.source,
      state: fallbackResult.state,
      confidence: fallbackResult.confidence,
      mode,
      durationMs: Date.now() - startedAt,
    });
    recordMiddlewareFallback(
      "/middleware/onboarding-resolver",
      `onboarding_fallback_${fallbackResult.reason}`,
    );

    return fallbackResult;
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
      const fallbackResult: OnboardingStatus = {
        state: mode === "strict" ? "resolved" : "indeterminate",
        isOnboarded: false,
        role: metadataRole,
        status: metadataStatus,
        source: "fallback",
        confidence: "low",
        reason: "internal_api_non_ok",
      };

      logOnboardingResolverOutcome("warn", {
        outcome: "fallback",
        reason: fallbackResult.reason,
        source: fallbackResult.source,
        state: fallbackResult.state,
        confidence: fallbackResult.confidence,
        mode,
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
      });
      recordMiddlewareFallback(
        "/middleware/onboarding-resolver",
        `onboarding_fallback_${fallbackResult.reason}`,
      );

      return fallbackResult;
    }

    const data = await response.json();
    const resolvedResult: OnboardingStatus = {
      state: "resolved",
      isOnboarded: data.isOnboarded ?? false,
      role: normalizeRole(data.role) ?? metadataRole,
      status:
        typeof data.status === "string"
          ? data.status.toUpperCase()
          : metadataStatus,
      source: "internal_api",
      confidence: "medium",
      reason: "internal_api_resolved",
    };

    logOnboardingResolverOutcome("info", {
      outcome: "resolved",
      reason: resolvedResult.reason,
      source: resolvedResult.source,
      state: resolvedResult.state,
      confidence: resolvedResult.confidence,
      mode,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
    });

    return resolvedResult;
  } catch {
    const fallbackResult: OnboardingStatus = {
      state: mode === "strict" ? "resolved" : "indeterminate",
      isOnboarded: false,
      role: metadataRole,
      status: metadataStatus,
      source: "fallback",
      confidence: "low",
      reason: "internal_api_error",
    };

    logOnboardingResolverOutcome("warn", {
      outcome: "fallback",
      reason: fallbackResult.reason,
      source: fallbackResult.source,
      state: fallbackResult.state,
      confidence: fallbackResult.confidence,
      mode,
      durationMs: Date.now() - startedAt,
    });
    recordMiddlewareFallback(
      "/middleware/onboarding-resolver",
      `onboarding_fallback_${fallbackResult.reason}`,
    );

    return fallbackResult;
  }
}
