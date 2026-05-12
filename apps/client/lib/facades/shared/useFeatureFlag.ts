/**
 * Feature flag hook for client components.
 * Fetches public settings and returns the value of a feature flag.
 */
import { useQuery } from "@tanstack/react-query";
import { settingsClient } from "./settings-client";

export const featureFlagKeys = {
  all: ["settings", "public"] as const,
};

/**
 * Check if a feature flag is enabled.
 * Supports nested flags e.g. "betaFeatures.aiMatching".
 */
export function useFeatureFlag(flag: string): boolean | undefined {
  const { data } = useQuery({
    queryKey: [...featureFlagKeys.all],
    queryFn: () => settingsClient.getPublic(),
    staleTime: 60_000, // 1 minute
  });

  if (!data?.featureFlags || typeof data.featureFlags !== "object") {
    return undefined;
  }

  const parts = flag.split(".");
  let value: unknown = data.featureFlags;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value === true;
}
