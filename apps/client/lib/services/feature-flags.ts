/**
 * Feature Flags Service
 *
 * Server-side feature flag checks using SystemSettings.
 */
import { isFeatureEnabled as checkFlag } from "@build/db/system-settings";

/**
 * Check if a feature is enabled (server-side).
 * Supports nested flags e.g. "betaFeatures.aiMatching".
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  return checkFlag(flag);
}
